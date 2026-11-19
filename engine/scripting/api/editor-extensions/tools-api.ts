import type { GizmoPainter } from '@/engine/editor/extensions/gizmos/gizmo-painter';
import { GuiSurface } from '@/engine/editor/extensions/gui/gui-surface';
import type { ToolContribution, ToolPointerPhase } from '@/engine/editor/extensions/tools/tool-contribution';
import { HelixArgumentError, HelixError } from '../../runtime/script-errors';
import { requireFunction, requireObject, requireString } from '../../runtime/values';
import { guardedAction, requireContributionId, type ExtensionApiContext } from './extension-api-context';
import { gizmoDrawFor, type GizmoDraw } from './gizmo-draw';
import { createGuiBuilder, type EditorGui } from './gui-api';
import { shortcutOf } from './shortcut-option';
import { createToolEvent, type ToolEvent } from './tool-event';
type Action = () => void;
type PointerHandler = (event: ToolEvent) => void;
const POINTER_HOOK: Readonly<Record<ToolPointerPhase, string>> = { down: 'onPointerDown', move: 'onPointerMove', up: 'onPointerUp' };
const paintNothing = (): void => undefined;
export function createToolsApi(context: ExtensionApiContext) {
    const { host, extensions } = context;
    const { tools, toolController } = extensions;
    const { session } = host;
    const find = (id: unknown, member: string): ToolContribution => {
        const key = requireContributionId(id, member);
        const tool = tools.get(key);
        if (!tool)
            throw new HelixError(`${member}: a ferramenta "${key}" não está registrada.`);
        return tool;
    };
    return {
        register: (id: unknown, options: unknown) => {
            const member = 'helix.editor.tools.register';
            const key = requireContributionId(id, member);
            const settings = requireObject(options, member);
            const optional = <TCallback extends (...args: never[]) => unknown>(name: string): TCallback | null => (settings[name] === undefined ? null : requireFunction<TCallback>(settings[name], member, name));
            const run = optional<Action>('run');
            const onActivate = optional<Action>('onActivate');
            const onDeactivate = optional<Action>('onDeactivate');
            const pointerHandlers: Readonly<Record<ToolPointerPhase, PointerHandler | null>> = {
                down: optional<PointerHandler>('onPointerDown'),
                move: optional<PointerHandler>('onPointerMove'),
                up: optional<PointerHandler>('onPointerUp'),
            };
            const onDraw = optional<(draw: GizmoDraw) => void>('onDraw');
            const onGui = optional<(ui: EditorGui) => void>('onGui');
            const handlesPointer = Object.values(pointerHandlers).some((handler) => handler !== null);
            const isMode = handlesPointer || onActivate !== null || onDeactivate !== null || onDraw !== null || onGui !== null;
            if (run && isMode)
                throw new HelixArgumentError(member, 'uma ferramenta com run é um botão de ação e não aceita onActivate, onDeactivate, onPointer*, onDraw nem onGui.');
            if (!run && !isMode)
                throw new HelixArgumentError(member, 'informe run para um botão de ação ou ao menos um de onActivate, onPointerDown, onPointerMove, onPointerUp, onDraw e onGui.');
            const owner = host.current;
            const label = `ferramenta "${key}"`;
            const guarded = (hook: string, action: Action | null): Action => () => {
                if (action)
                    context.run(owner, `${label} (${hook})`, action);
            };
            const runAction = guarded('run', run);
            const surface = onGui ? new GuiSurface((frame) => onGui(createGuiBuilder(host, frame)), (render) => context.run(owner, `${label} (onGui)`, render)) : null;
            const tool: ToolContribution = {
                id: key,
                title: settings.title === undefined ? key : requireString(settings.title, member, 'o título'),
                icon: settings.icon === undefined ? null : requireString(settings.icon, member, 'o ícone'),
                shortcut: shortcutOf(settings.shortcut, member),
                cursor: settings.cursor === undefined ? null : requireString(settings.cursor, member, 'o cursor'),
                isAction: run !== null,
                handlesPointer,
                surface,
                run: () => {
                    runAction();
                    session.notify();
                },
                activate: guarded('onActivate', onActivate),
                deactivate: guarded('onDeactivate', onDeactivate),
                pointer: (phase, pointer) => {
                    const handler = pointerHandlers[phase];
                    if (!handler)
                        return;
                    context.run(owner, `${label} (${POINTER_HOOK[phase]})`, () => handler(createToolEvent(session, pointer)));
                    if (phase === 'move')
                        return;
                    surface?.requestRepaint();
                    session.notify();
                },
                paint: onDraw ? guardedAction(context, owner, `${label} (onDraw)`, (painter: GizmoPainter) => onDraw(gizmoDrawFor(painter))) : paintNothing,
            };
            const unregister = context.own(tools.register(tool, context.ownerAssetId()));
            return {
                id: key,
                get isActive(): boolean {
                    return toolController.active === tool;
                },
                activate: () => toolController.activate(tool),
                deactivate: () => {
                    if (toolController.active === tool)
                        toolController.deactivate();
                },
                repaint: () => {
                    surface?.requestRepaint();
                    session.notify('view');
                },
                unregister,
            };
        },
        unregister: (id: unknown) => tools.unregister(requireContributionId(id, 'helix.editor.tools.unregister')),
        activate: (id: unknown) => toolController.activate(find(id, 'helix.editor.tools.activate')),
        deactivate: () => {
            toolController.deactivate();
        },
        get active(): string | null {
            return toolController.active?.id ?? null;
        },
        run: (id: unknown) => toolController.trigger(find(id, 'helix.editor.tools.run')),
        list: () => tools.list().map((tool) => ({ id: tool.id, title: tool.title, shortcut: tool.shortcut, kind: tool.isAction ? ('action' as const) : ('mode' as const) })),
    };
}
