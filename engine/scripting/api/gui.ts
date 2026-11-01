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
}
