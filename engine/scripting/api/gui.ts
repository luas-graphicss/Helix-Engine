import { createGuiDocument, createGuiNode, GUI_ELEMENT_KINDS, type GuiDocument, type GuiElementKind, type GuiNode, } from '@/engine/gui/document/gui-document';
import { findGuiNode, insertGuiNode, removeGuiNodes, updateGuiNode, walkGui } from '@/engine/gui/document/gui-tree';
import type { GuiRuntimeEvent } from '@/engine/gui/runtime/gui-runtime';
import { loadGuiAsset } from '@/engine/editor/operations/gui-operations';
import { HelixArgumentError, HelixError, HelixNotImplementedError } from '../runtime/script-errors';
import type { RuntimeHost } from '../runtime/runtime-host';
import { requireEntity, requireFunction, requireNumber, requireObject, requireOneOf, requireString } from '../runtime/values';
import type { MountOptions, WebActionEvent } from '../web/web-ui-host';
interface ScreenState {
    key: string;
    document: GuiDocument;
    shown: boolean;
}
function isDocumentLike(value: unknown): value is GuiDocument {
    if (!value || typeof value !== 'object')
        return false;
    const candidate = value as Partial<GuiDocument>;
    return typeof candidate.name === 'string' && typeof candidate.root === 'object' && candidate.root !== null && typeof candidate.root.id === 'string';
}
export function createGuiApi(host: RuntimeHost) {
    const { session } = host;
    const { hud, guiWorld } = session;
    const states = new Map<string, ScreenState>();
    const byDocument = new WeakMap<GuiDocument, ScreenState>();
    function track(state: ScreenState, document: GuiDocument): GuiDocument {
        state.document = document;
        byDocument.set(document, state);
        return document;
    }
    function commit(state: ScreenState, document: GuiDocument): GuiDocument {
        track(state, document);
        if (state.shown)
            hud.showDocument(state.key, document);
        return document;
    }
    function release(state: ScreenState): void {
        if (state.shown)
            hud.hideDocument(state.key);
        state.shown = false;
        if (states.get(state.key) === state)
            states.delete(state.key);
    }
    function adopt(document: GuiDocument, key: string = document.name): ScreenState {
        const previous = states.get(key);
        if (previous)
            release(previous);
        const state: ScreenState = { key, document, shown: false };
        states.set(key, state);
        byDocument.set(document, state);
        return state;
    }
    function rekey(state: ScreenState, key: string): void {
        const occupant = states.get(key);
        if (occupant && occupant !== state)
            release(occupant);
        if (state.shown)
            hud.hideDocument(state.key);
        if (states.get(state.key) === state)
            states.delete(state.key);
        state.key = key;
        states.set(key, state);
    }
    function stateByName(name: string): ScreenState | null {
        const byKey = states.get(name);
        if (byKey)
            return byKey;
        for (const state of states.values())
            if (state.document.name === name)
                return state;
        return null;
    }
    function stateOf(value: unknown, member: string): ScreenState | null {
        if (typeof value === 'string')
            return stateByName(value);
        if (value && typeof value === 'object') {
            const known = byDocument.get(value as GuiDocument);
            if (known)
                return known;
            const name = (value as Partial<GuiDocument>).name;
            return typeof name === 'string' ? stateByName(name) : null;
        }
        throw new HelixArgumentError(member, 'esperava a chave da tela (string) ou o documento devolvido por helix.gui.create/show.');
    }
    function requireState(value: unknown, member: string): ScreenState {
        const state = stateOf(value, member);
        if (state)
            return state;
        if (isDocumentLike(value))
            return adopt(value);
        throw new HelixArgumentError(member, `tela desconhecida${typeof value === 'string' ? ` "${value}"` : ''}: crie com helix.gui.create ou mostre com helix.gui.show primeiro.`);
    }
    function requireShownState(value: unknown, member: string): ScreenState {
        const state = requireState(value, member);
        if (!state.shown)
            throw new HelixArgumentError(member, `a tela "${state.document.name}" não está sendo mostrada (helix.gui.show primeiro).`);
        return state;
    }
    function nodeByName(document: GuiDocument, nameOrId: string, member: string): GuiNode {
        const byId = findGuiNode(document.root, nameOrId);
        if (byId)
            return byId;
        let found: GuiNode | null = null;
        walkGui(document.root, (node) => {
            if (!found && node.name === nameOrId)
                found = node;
        });
        if (!found)
            throw new HelixArgumentError(member, `a tela "${document.name}" não tem um elemento chamado "${nameOrId}".`);
        return found;
    }
    function patchNode(value: unknown, nameOrId: unknown, member: string, update: (node: GuiNode) => GuiNode): GuiDocument {
        const state = requireState(value, member);
        const node = nodeByName(state.document, requireString(nameOrId, member, 'o nome do elemento'), member);
        return commit(state, { ...state.document, root: updateGuiNode(state.document.root, node.id, update) });
    }
    function sourceOf(value: unknown, member: string, language: 'html' | 'css' | 'svg'): string {
        if (typeof value === 'string' && (language === 'css' ? /[{}:;]/.test(value) : value.includes('<')))
            return value;
        const asset = host.resolveAsset(value, member, 'script');
        const details = asset.details.kind === 'script' ? asset.details : null;
        if (details?.language !== language)
            throw new HelixArgumentError(member, `"${asset.name}" não é um script ${language.toUpperCase()}.`);
        return host.scriptSource(asset, member);
    }
    function mountOptions(options: unknown, member: string): MountOptions {
        if (options === undefined)
            return {};
        const extra = requireObject(options, member);
        return {
            id: typeof extra.id === 'string' ? extra.id : undefined,
            replace: extra.replace === undefined ? undefined : Boolean(extra.replace),
            className: typeof extra.className === 'string' ? extra.className : undefined,
        };
    }
    const surfaces = {
        get system() {
            return guiWorld.system;
        },
        settingsOf: (value: unknown) => requireEntity(value, 'helix.gui.surfaces.settingsOf').guiSurface,
        reset: () => guiWorld.reset(),
    };
    const api = {
        get visible() {
            return hud.visible;
        },
        get interactive() {
            return hud.interactive;
        },
        get hasFocusedInput() {
            return hud.hasFocusedInput;
        },
        screens: () => hud.loadedDocuments.map((document) => ({ name: document.name, enabled: document.enabled, displayOrder: document.displayOrder })),
        show: async (value: unknown, key?: unknown) => {
            let state = stateOf(value, 'helix.gui.show');
            let document: GuiDocument;
            if (state)
                document = state.document;
            else if (isDocumentLike(value))
                document = value;
            else
                document = await loadGuiAsset(session, host.resolveAsset(value, 'helix.gui.show', 'gui'));
            if (!host.running)
                return document;
            const resolvedKey = key === undefined ? (state?.key ?? document.name) : requireString(key, 'helix.gui.show', 'a chave');
            if (!state)
                state = adopt(document, resolvedKey);
            else if (state.key !== resolvedKey)
                rekey(state, resolvedKey);
            state.shown = true;
            return commit(state, { ...document, enabled: true });
        },
        hide: (value: unknown) => {
            const state = stateOf(value, 'helix.gui.hide');
            if (!state?.shown)
                return false;
            state.shown = false;
            return hud.hideDocument(state.key);
        },
        isShown: (value: unknown) => stateOf(value, 'helix.gui.isShown')?.shown ?? false,
        create: (name?: unknown, options?: unknown) => {
            const extra = options === undefined ? {} : requireObject(options, 'helix.gui.create');
            let document = createGuiDocument(typeof name === 'string' && name ? name : 'Tela de script');
            if (extra.referenceSize && typeof extra.referenceSize === 'object') {
                const size = extra.referenceSize as {
                    x?: unknown;
                    y?: unknown;
                };
                document = { ...document, referenceSize: { x: requireNumber(size.x, 'helix.gui.create', 'referenceSize.x'), y: requireNumber(size.y, 'helix.gui.create', 'referenceSize.y') } };
            }
            return adopt(document).document;
        },
        kinds: () => GUI_ELEMENT_KINDS.slice(),
        add: (value: unknown, kindValue: unknown, options?: unknown, parentNameOrId?: unknown) => {
            const kind = requireOneOf(kindValue, GUI_ELEMENT_KINDS, 'helix.gui.add', 'o tipo do elemento') as GuiElementKind;
            const extra = options === undefined ? {} : requireObject(options, 'helix.gui.add');
            let node = createGuiNode(kind, { name: typeof extra.name === 'string' ? extra.name : undefined });
            if (typeof extra.text === 'string' && node.text)
                node = { ...node, text: { ...node.text, content: extra.text } };
            if (extra.rect && typeof extra.rect === 'object')
                node = { ...node, rect: { ...node.rect, ...(extra.rect as object) } };
            if (extra.appearance && typeof extra.appearance === 'object')
                node = { ...node, appearance: { ...node.appearance, ...(extra.appearance as object) } };
            if (extra.visible !== undefined)
                node = { ...node, visible: Boolean(extra.visible) };
            const state = requireState(value, 'helix.gui.add');
            const { document } = state;
            const parentId = parentNameOrId === undefined ? document.root.id : nodeByName(document, requireString(parentNameOrId, 'helix.gui.add', 'o pai'), 'helix.gui.add').id;
            return { document: commit(state, { ...document, root: insertGuiNode(document.root, parentId, node) }), node };
        },
        remove: (value: unknown, nameOrId: unknown) => {
            const state = requireState(value, 'helix.gui.remove');
            const node = nodeByName(state.document, requireString(nameOrId, 'helix.gui.remove', 'o elemento'), 'helix.gui.remove');
            return commit(state, { ...state.document, root: removeGuiNodes(state.document.root, new Set([node.id])) });
        },
        find: (value: unknown, nameOrId: unknown) => {
            const { document } = requireState(value, 'helix.gui.find');
            return nodeByName(document, requireString(nameOrId, 'helix.gui.find', 'o elemento'), 'helix.gui.find');
        },
        setText: (value: unknown, nameOrId: unknown, text: unknown) => patchNode(value, nameOrId, 'helix.gui.setText', (node) => {
            if (!node.text)
                throw new HelixArgumentError('helix.gui.setText', `"${node.name}" não tem texto.`);
            return { ...node, text: { ...node.text, content: String(text) } };
        }),
        setVisible: (value: unknown, nameOrId: unknown, visible: unknown) => patchNode(value, nameOrId, 'helix.gui.setVisible', (node) => ({ ...node, visible: Boolean(visible) })),
        setInteractable: (value: unknown, nameOrId: unknown, interactable: unknown) => patchNode(value, nameOrId, 'helix.gui.setInteractable', (node) => ({ ...node, interactable: Boolean(interactable) })),
        setRect: (value: unknown, nameOrId: unknown, rect: unknown) => patchNode(value, nameOrId, 'helix.gui.setRect', (node) => ({ ...node, rect: { ...node.rect, ...requireObject(rect, 'helix.gui.setRect', 'o rect') } })),
        setAppearance: (value: unknown, nameOrId: unknown, appearance: unknown) => patchNode(value, nameOrId, 'helix.gui.setAppearance', (node) => ({ ...node, appearance: { ...node.appearance, ...requireObject(appearance, 'helix.gui.setAppearance', 'a aparência') } })),
        setStyle: (value: unknown, nameOrId: unknown, style: unknown) => patchNode(value, nameOrId, 'helix.gui.setStyle', (node) => {
            if (!node.text)
                throw new HelixArgumentError('helix.gui.setStyle', `"${node.name}" não tem texto.`);
            return { ...node, text: { ...node.text, ...requireObject(style, 'helix.gui.setStyle', 'o estilo') } };
        }),
        value: (value: unknown, nameOrId: unknown) => {
            const { document } = requireState(value, 'helix.gui.value');
            const node = nodeByName(document, requireString(nameOrId, 'helix.gui.value', 'o elemento'), 'helix.gui.value');
            const live = hud.runtime.valueOf(node.id);
            if (live !== undefined)
                return live;
            const control = node.control as {
                value?: unknown;
                checked?: unknown;
                text?: unknown;
            } | null;
            return control?.value ?? control?.checked ?? control?.text ?? null;
        },
        setValue: (value: unknown, nameOrId: unknown, next: unknown) => {
            const { document } = requireShownState(value, 'helix.gui.setValue');
            const node = nodeByName(document, requireString(nameOrId, 'helix.gui.setValue', 'o elemento'), 'helix.gui.setValue');
            if (typeof next !== 'number' && typeof next !== 'string' && typeof next !== 'boolean')
                throw new HelixArgumentError('helix.gui.setValue', 'o valor precisa ser número, texto ou booleano.');
            hud.runtime.setValue(node.id, next);
        },
        onEvent: (handler: unknown) => {
            const fn = requireFunction<(event: GuiRuntimeEvent) => void>(handler, 'helix.gui.onEvent');
            const owner = host.current;
            const remove = hud.onHudEvent((event) => {
                if (owner && !owner.active)
                    return;
                host.invoke(owner, 'helix.gui.onEvent', () => fn(event));
            });
            owner?.track(remove);
            return remove;
        },
        onActivate: (nameOrId: unknown, handler: unknown) => {
            const wanted = requireString(nameOrId, 'helix.gui.onActivate', 'o elemento');
            const fn = requireFunction<(event: GuiRuntimeEvent) => void>(handler, 'helix.gui.onActivate');
            return api.onEvent((event: GuiRuntimeEvent) => {
                if (event.type === 'activate' && (event.nodeName === wanted || event.nodeId === wanted))
                    fn(event);
            });
        },
        onChange: (nameOrId: unknown, handler: unknown) => {
            const wanted = requireString(nameOrId, 'helix.gui.onChange', 'o elemento');
            const fn = requireFunction<(value: unknown, event: GuiRuntimeEvent) => void>(handler, 'helix.gui.onChange');
            return api.onEvent((event: GuiRuntimeEvent) => {
                if (event.type === 'change' && (event.nodeName === wanted || event.nodeId === wanted))
                    fn(event.value, event);
            });
        },
        get cursor() {
            return hud.cursor;
        },
        documents: () => [...states.values()].map(({ key, document, shown }) => ({ key, document, shown })),
        surfaces,
        templates: {
            list: () => {
                throw new HelixNotImplementedError('helix.gui.templates.list', 'os modelos de tela ainda não são listados por script; crie telas no designer ou com helix.gui.create/add.');
            },
        },
        ensureRunning: () => {
            if (!host.running)
                throw new HelixError('helix.gui: a HUD só existe com o jogo em andamento.');
        },
        get domRoot() {
            return host.web.root;
        },
        html: (markup: unknown, options?: unknown) => host.web.mount(sourceOf(markup, 'helix.gui.html', 'html'), mountOptions(options, 'helix.gui.html'), host.current),
        css: (text: unknown) => host.web.addStyle(sourceOf(text, 'helix.gui.css', 'css'), host.current),
        svg: (markup: unknown, options?: unknown) => host.web.mountSvg(sourceOf(markup, 'helix.gui.svg', 'svg'), mountOptions(options, 'helix.gui.svg'), host.current),
        element: (id: unknown) => host.web.query(requireString(id, 'helix.gui.element', 'o seletor ou id')),
        elements: (selector: unknown) => host.web.queryAll(requireString(selector, 'helix.gui.elements', 'o seletor')),
        bind: (name: unknown, value: unknown) => host.web.bind(requireString(name, 'helix.gui.bind', 'o nome do data-bind'), value),
        onAction: (action: unknown, handler: unknown) => {
            const fn = requireFunction<(event: WebActionEvent) => void>(handler, 'helix.gui.onAction');
            return host.web.onAction(requireString(action, 'helix.gui.onAction', 'o nome da ação'), fn, host.current);
        },
        clear: () => host.web.clear(),
        get canvas2d() {
            return host.web.canvas2d();
        },
        get size() {
            return host.web.size;
        },
        set pointerEvents(value: boolean) {
            host.web.setPointerEvents(Boolean(value));
        },
        get pointerEvents() {
            return host.web.pointerEvents;
        },
    };
    return api;
}
