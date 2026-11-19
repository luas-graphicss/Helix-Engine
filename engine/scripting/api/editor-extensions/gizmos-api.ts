import type { Entity } from '@/engine/core/scene/entity';
import { GIZMO_VISIBILITIES, type GizmoContribution } from '@/engine/editor/extensions/gizmos/gizmo-contribution';
import type { GizmoPainter } from '@/engine/editor/extensions/gizmos/gizmo-painter';
import { HelixArgumentError } from '../../runtime/script-errors';
import { requireFunction, requireObject, requireOneOf } from '../../runtime/values';
import { entityFilterOf } from './entity-filter-options';
import { guardedAction, requireContributionId, type ExtensionApiContext } from './extension-api-context';
import { gizmoDrawFor, type GizmoDraw } from './gizmo-draw';
type ActorDraw = (draw: GizmoDraw, actor: Entity, selected: boolean) => void;
type SceneDraw = (draw: GizmoDraw) => void;
const paintNothing = (): void => undefined;
export function createGizmosApi(context: ExtensionApiContext) {
    const { host, extensions } = context;
    const { gizmos, gizmoLayer } = extensions;
    return {
        register: (id: unknown, options: unknown) => {
            const member = 'helix.editor.gizmos.register';
            const key = requireContributionId(id, member);
            const settings = requireObject(options, member);
            const onDraw = settings.onDraw === undefined ? null : requireFunction<ActorDraw>(settings.onDraw, member, 'onDraw');
            const onDrawScene = settings.onDrawScene === undefined ? null : requireFunction<SceneDraw>(settings.onDrawScene, member, 'onDrawScene');
            if (!onDraw && !onDrawScene)
                throw new HelixArgumentError(member, 'informe onDraw, onDrawScene ou os dois.');
            const owner = host.current;
            const label = `gizmo "${key}"`;
            const gizmo: GizmoContribution = {
                ...entityFilterOf(context, owner, settings, member, label),
                id: key,
                visibility: settings.when === undefined ? 'always' : requireOneOf(settings.when, GIZMO_VISIBILITIES, member, 'quando desenhar'),
                drawsActors: onDraw !== null,
                paintActor: onDraw ? guardedAction(context, owner, `${label} (onDraw)`, (painter: GizmoPainter, actor: Entity, selected: boolean) => onDraw(gizmoDrawFor(painter), actor, selected)) : paintNothing,
                paintScene: onDrawScene ? guardedAction(context, owner, `${label} (onDrawScene)`, (painter: GizmoPainter) => onDrawScene(gizmoDrawFor(painter))) : paintNothing,
            };
            const unregister = context.own(gizmos.register(gizmo, context.ownerAssetId()));
            return { id: key, unregister };
        },
        unregister: (id: unknown) => gizmos.unregister(requireContributionId(id, 'helix.editor.gizmos.unregister')),
        repaint: () => gizmoLayer.requestRepaint(),
        get visible(): boolean {
            return gizmoLayer.visible;
        },
        set visible(value: boolean) {
            gizmoLayer.setVisible(value === true);
        },
        list: () => gizmos.list().map((gizmo) => ({ id: gizmo.id, when: gizmo.visibility })),
    };
}
