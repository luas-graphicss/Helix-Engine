import { Entity } from '@/engine/core/scene/entity';
import type { Command } from '@/engine/editor/history/command';
import { SetValueCommand } from '@/engine/editor/commands/set-value-command';
import { editorDialogs, type EditorDialogId } from '@/engine/editor/dialogs/editor-dialogs';
import { dockLayoutRegistry } from '@/engine/editor/layout/dock-layout-context';
import { DOCK_AREAS, DOCK_PANEL_IDS, type DockArea, type DockPanelId } from '@/engine/editor/layout/dock-layout';
import { compileProject, openScriptAssetInEditor, runScript, saveActiveScript, saveAllScripts, saveScriptTab } from '@/engine/editor/operations/script-operations';
import type { TransformSpace, TransformTool } from '@/engine/editor/session/editor-session';
import { ENGINE_SETTINGS, type SettingId, type SettingValue } from '@/engine/settings/engine-settings-schema';
import { engineSettings } from '@/engine/settings/engine-settings-store';
import { HelixArgumentError, HelixError } from '../runtime/script-errors';
import type { RuntimeHost } from '../runtime/runtime-host';
import { requireEntity, requireFunction, requireNumber, requireOneOf, requireString } from '../runtime/values';
const DIALOG_IDS: readonly EditorDialogId[] = ['settings', 'shortcuts', 'autosaves', 'beta', 'about', 'exit', 'renameProject', 'baseLanguage'];
const TOOLS: readonly TransformTool[] = ['select', 'translate', 'rotate', 'scale', 'terrain'];
const SPACES: readonly TransformSpace[] = ['global', 'local'];
const SETTING_IDS = Object.keys(ENGINE_SETTINGS) as SettingId[];
export interface ScriptTool {
    readonly id: string;
    readonly label: string;
    readonly shortcut: string | null;
    readonly run: () => void;
}
export function createEditorApi(host: RuntimeHost) {
    const { session, bus } = host;
    const tools = new Map<string, ScriptTool>();
    let groupDepth = 0;
    let groupLabel: string | null = null;
    function settingId(value: unknown, member: string): SettingId {
        const id = requireString(value, member, 'a chave da configuração');
        if (!(id in ENGINE_SETTINGS))
            throw new HelixArgumentError(member, `configuração "${id}" não existe. Chaves: ${SETTING_IDS.slice(0, 10).join(', ')}…`);
        return id as SettingId;
    }
    function layout() {
        const store = dockLayoutRegistry.current;
        if (!store)
            throw new HelixError('helix.editor.panels: o layout do editor não está montado nesta aba.');
        return store;
    }
    function panelId(value: unknown, member: string): DockPanelId {
        return requireOneOf(value, DOCK_PANEL_IDS, member, 'o painel');
    }
    host.disposers.add(() => tools.clear());
    const history = {
        undo: () => session.history.undo(),
        redo: () => session.history.redo(),
        get canUndo() {
            return session.history.canUndo;
        },
        get canRedo() {
            return session.history.canRedo;
        },
        get undoLabel() {
            return session.history.undoLabel;
        },
        get redoLabel() {
            return session.history.redoLabel;
        },
        get revision() {
            return session.history.revision;
        },
        execute: (command: unknown) => {
            const value = command as Partial<Command> | null;
            if (!value || typeof value !== 'object' || typeof value.label !== 'string' || typeof value.execute !== 'function' || typeof value.undo !== 'function') {
                throw new HelixArgumentError('helix.editor.history.execute', 'esperava { label, execute(), undo(), mergeKey? }.');
            }
            const label = groupLabel ?? value.label;
            const mergeKey = groupDepth > 0 ? `script-group:${groupLabel}` : value.mergeKey;
            session.history.execute({ label, mergeKey, execute: () => (value.execute as () => void)(), undo: () => (value.undo as () => void)() });
        },
        set: <T,>(label: unknown, apply: unknown, before: T, after: T) => {
            const text = requireString(label, 'helix.editor.history.set', 'o rótulo');
            const fn = requireFunction<(value: T) => void>(apply, 'helix.editor.history.set', 'a função que aplica');
            session.history.execute(new SetValueCommand(groupLabel ?? text, fn, before, after, groupDepth > 0 ? `script-group:${groupLabel}` : undefined));
        },
        beginGroup: (label: unknown) => {
            if (groupDepth === 0)
                groupLabel = requireString(label, 'helix.editor.history.beginGroup', 'o rótulo');
            groupDepth++;
        },
        endGroup: () => {
            if (groupDepth === 0)
                return;
            groupDepth--;
            if (groupDepth === 0) {
                groupLabel = null;
                session.history.endMerge();
            }
        },
    };
    const panels = {
        ids: () => DOCK_PANEL_IDS.slice(),
        areas: () => DOCK_AREAS.slice(),
        open: (id: unknown, area?: unknown) => layout().open(panelId(id, 'helix.editor.panels.open'), area === undefined ? undefined : requireOneOf(area, DOCK_AREAS, 'helix.editor.panels.open', 'a área')),
        close: (id: unknown) => layout().close(panelId(id, 'helix.editor.panels.close')),
        toggle: (id: unknown) => layout().toggle(panelId(id, 'helix.editor.panels.toggle')),
        reveal: (id: unknown) => layout().reveal(panelId(id, 'helix.editor.panels.reveal')),
        isOpen: (id: unknown) => layout().isOpen(panelId(id, 'helix.editor.panels.isOpen')),
        area: (id: unknown) => layout().area(panelId(id, 'helix.editor.panels.area')),
        move: (id: unknown, area: unknown, index?: unknown) => layout().move(panelId(id, 'helix.editor.panels.move'), requireOneOf(area, DOCK_AREAS, 'helix.editor.panels.move', 'a área') as DockArea, index === undefined ? undefined : requireNumber(index, 'helix.editor.panels.move', 'a posição')),
        maximizeViewport: () => layout().maximizeViewport(),
        restore: () => layout().restorePanels(),
    };
    const dialogs = {
        ids: () => DIALOG_IDS.slice(),
        open: (id: unknown) => editorDialogs.open(requireOneOf(id, DIALOG_IDS, 'helix.editor.dialogs.open', 'o diálogo')),
        close: () => editorDialogs.close(),
        confirm: (message: unknown) => window.confirm(requireString(message, 'helix.editor.dialogs.confirm', 'a mensagem')),
        prompt: (message: unknown, fallback?: unknown) => window.prompt(requireString(message, 'helix.editor.dialogs.prompt', 'a mensagem'), fallback === undefined ? '' : String(fallback)),
        alert: (message: unknown) => window.alert(requireString(message, 'helix.editor.dialogs.alert', 'a mensagem')),
        pickAsset: (kind: unknown) => {
            const list = session.library.byKind(requireOneOf(kind, ['model', 'texture', 'audio', 'animation', 'gui', 'font', 'video', 'vfx', 'script', 'prefab'] as const, 'helix.editor.dialogs.pickAsset', 'o tipo'));
            if (list.length === 0)
                return null;
            const answer = window.prompt(`Escolha um ativo:\n${list.map((asset, index) => `${index + 1}. ${asset.name}`).join('\n')}`, '1');
            if (answer === null)
                return null;
            const index = Number.parseInt(answer, 10) - 1;
            return list[index] ?? list.find((asset) => asset.name === answer.trim()) ?? null;
        },
    };
    const settings = {
        keys: () => SETTING_IDS.slice(),
        get: (key: unknown) => engineSettings.get(settingId(key, 'helix.editor.settings.get')),
        set: (key: unknown, value: unknown) => {
            const id = settingId(key, 'helix.editor.settings.set');
            const definition = ENGINE_SETTINGS[id] as {
                default: unknown;
            };
            if (typeof value !== typeof definition.default)
                throw new HelixArgumentError('helix.editor.settings.set', `"${id}" espera ${typeof definition.default}; recebido ${typeof value}.`);
            engineSettings.set(id, value as SettingValue<typeof id>);
        },
        isDefault: (key: unknown) => engineSettings.isDefault(settingId(key, 'helix.editor.settings.isDefault')),
        reset: (key: unknown) => engineSettings.reset(settingId(key, 'helix.editor.settings.reset')),
        describe: (key: unknown) => ({ ...(ENGINE_SETTINGS[settingId(key, 'helix.editor.settings.describe')] as object) }),
        onChanged: (handler: unknown) => {
            const fn = requireFunction<() => void>(handler, 'helix.editor.settings.onChanged');
            return engineSettings.subscribe(fn);
        },
    };
    const gizmo = {
        get mode() {
            return session.gizmoMode;
        },
        get tool() {
            return session.tool;
        },
        set tool(value: TransformTool) {
            session.setTool(requireOneOf(value, TOOLS, 'helix.editor.gizmo.tool', 'a ferramenta'));
        },
        tools: () => TOOLS.slice(),
        get space() {
            return session.space;
        },
        set space(value: TransformSpace) {
            session.setSpace(requireOneOf(value, SPACES, 'helix.editor.gizmo.space', 'o espaço'));
        },
        toggleSpace: () => session.toggleSpace(),
        get snap() {
            return session.snap;
        },
    };
    const viewport = {
        capture: () => session.capture.request(session.viewportCanvas),
        frame: (entity: unknown) => session.focusEntity(requireEntity(entity, 'helix.editor.viewport.frame')),
        frameSelected: () => session.focusSelected(),
        get camera() {
            return session.camera;
        },
    };
    const code = {
        open: async (asset: unknown, line?: unknown) => {
            const resolved = host.resolveAsset(asset, 'helix.editor.code.open', 'script');
            return openScriptAssetInEditor(session, resolved, { line: line === undefined ? undefined : requireNumber(line, 'helix.editor.code.open', 'a linha') });
        },
        get tabs() {
            return session.code.tabs.map((tab) => ({ assetId: tab.assetId, name: tab.document.name, language: tab.document.language, dirty: session.code.isDirty(tab), active: session.code.activeTab === tab }));
        },
        get active() {
            const tab = session.code.activeTab;
            return tab ? { assetId: tab.assetId, name: tab.document.name, language: tab.document.language } : null;
        },
        save: (asset?: unknown) => (asset === undefined ? saveActiveScript(session) : saveScriptTab(session, host.resolveAsset(asset, 'helix.editor.code.save', 'script').id)),
        saveAll: () => saveAllScripts(session),
        run: (asset?: unknown) => {
            const resolved = asset === undefined ? (session.code.activeTab ? session.library.get(session.code.activeTab.assetId) : null) : host.resolveAsset(asset, 'helix.editor.code.run', 'script');
            if (!resolved)
                throw new HelixError('helix.editor.code.run: nenhum script aberto para executar.');
            return runScript(session, resolved);
        },
        compile: () => compileProject(session),
        get compileState() {
            return { state: session.code.compileState, message: session.code.compileMessage };
        },
    };
    const console = {
        clear: () => session.log.clear(),
        get entries() {
            return session.log.entries.map((entry) => ({ ...entry }));
        },
        get count() {
            return session.log.entries.length;
        },
    };
    return {
        get selection(): Entity[] {
            return session.selectedEntities();
        },
        get selected(): Entity | null {
            return session.selectedEntity;
        },
        select: (value: unknown) => {
            if (value === null) {
                session.select(null);
                return;
            }
            if (Array.isArray(value)) {
                session.setSelection(value.map((item, index) => requireEntity(item, 'helix.editor.select', `o ator ${index + 1}`)));
                return;
            }
            session.select(requireEntity(value, 'helix.editor.select'));
        },
        toggleSelect: (value: unknown) => session.toggleSelection(requireEntity(value, 'helix.editor.toggleSelect')),
        selectAll: () => session.selectAll(),
        clearSelection: () => session.select(null),
        onSelectionChanged: (handler: unknown) => bus.on('editor.selectionChanged', (payload) => requireFunction<(payload: unknown) => void>(handler, 'helix.editor.onSelectionChanged')(payload), host.current),
        history,
        undo: history.undo,
        redo: history.redo,
        execute: history.execute,
        beginGroup: history.beginGroup,
        endGroup: history.endGroup,
        get revision() {
            return session.history.revision;
        },
        panels,
        dialogs,
        settings,
        gizmo,
        viewport,
        code,
        console,
        tools: {
            register: (id: unknown, options: unknown) => {
                const member = 'helix.editor.tools.register';
                const key = requireString(id, member, 'o id');
                const value = (options ?? {}) as Record<string, unknown>;
                const tool: ScriptTool = {
                    id: key,
                    label: typeof value.label === 'string' ? value.label : key,
                    shortcut: typeof value.shortcut === 'string' ? value.shortcut : null,
                    run: requireFunction<() => void>(value.run, member, 'run'),
                };
                tools.set(key, tool);
                bus.emit('editor.toolsChanged', { id: key });
                const unregister = () => {
                    if (tools.get(key) === tool) {
                        tools.delete(key);
                        bus.emit('editor.toolsChanged', { id: key });
                    }
                };
                host.current?.track(unregister);
                return unregister;
            },
            unregister: (id: unknown) => tools.delete(requireString(id, 'helix.editor.tools.unregister', 'o id')),
            list: () => [...tools.values()].map((tool) => ({ id: tool.id, label: tool.label, shortcut: tool.shortcut })),
            run: (id: unknown) => {
                const key = requireString(id, 'helix.editor.tools.run', 'o id');
                const tool = tools.get(key);
                if (!tool)
                    throw new HelixError(`helix.editor.tools.run: ferramenta "${key}" não registrada.`);
                host.invoke(host.current, `tool:${key}`, tool.run);
            },
        },
        notify: () => session.notify(),
    };
}
export type EditorApi = ReturnType<typeof createEditorApi>;
