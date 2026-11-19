import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import type { NavAgent } from '@/engine/navigation/agent/nav-agent';
import type { NavMesh } from '@/engine/navigation/mesh/nav-mesh';
import { axisScale } from '@/engine/navigation/scene/navigation-poses';
import type { ScriptDebugLine, ScriptRenderRequest } from '@/engine/renderer/script-hooks';
import { DebugLineBuffer } from './debug-line-buffer';
import { drawArc, drawBox, drawCircle, drawCylinder } from './nav-gizmo-shapes';
import { buildNavMeshLines, NAV_AREA_COLORS } from './nav-mesh-lines';
import { OverlayRenderRequest } from './overlay-render-request';
interface MeshLines {
    readonly version: number;
    readonly buffer: DebugLineBuffer;
}
const SURFACE_COLOR = vec3.create(0.2, 0.65, 1);
const AGENT_COLOR = vec3.create(0.45, 0.95, 0.6);
const OBSTACLE_COLOR = vec3.create(1, 0.45, 0.2);
const LINK_COLOR = vec3.create(1, 0.8, 0.25);
const DISABLED_COLOR = vec3.create(0.55, 0.55, 0.58);
const PATH_COLOR = vec3.create(1, 1, 1);
const SELECTED_ALPHA = 0.95;
const UNSELECTED_ALPHA = 0.5;
const PATH_ALPHA = 0.85;
const LINK_ENDPOINT_RADIUS = 0.2;
const LINK_ARC_PER_METER = 0.2;
const PATH_LIFT = 0.08;
const base = vec3.create();
const start = vec3.create();
const end = vec3.create();
const lifted = vec3.create();
const nextLifted = vec3.create();
const NO_MESHES: readonly NavMesh[] = [];
function liftPoint(out: Vec3, point: Vec3): Vec3 {
    return vec3.set(out, point[0], point[1] + PATH_LIFT, point[2]);
}
export class NavigationOverlay {
    private readonly meshLines = new WeakMap<NavMesh, MeshLines>();
    private readonly gizmos = new DebugLineBuffer();
    private readonly lines: ScriptDebugLine[] = [];
    private readonly request = new OverlayRenderRequest();
    decorate(session: EditorSession, selection: ReadonlySet<number> | null, scripts: ScriptRenderRequest | null): ScriptRenderRequest | null {
        return this.request.wrap(scripts, this.collect(session, selection));
    }
    private collect(session: EditorSession, selection: ReadonlySet<number> | null): readonly ScriptDebugLine[] {
        const { helpers } = session.navigation;
        const runtime = session.playtest.navigation;
        const showsEverything = helpers === 'all' && session.playtest.state !== 'playing';
        let followsSelection = false;
        this.lines.length = 0;
        this.gizmos.reset();
        if (helpers === 'off')
            return this.lines;
        for (const entity of session.scene.entities) {
            const isSelected = selection?.has(entity.id) ?? false;
            if (!showsEverything && !isSelected)
                continue;
            this.drawComponents(entity, isSelected ? SELECTED_ALPHA : UNSELECTED_ALPHA);
            const agent = runtime?.agentOf(entity);
            if (agent)
                this.drawPath(agent);
            followsSelection ||= isSelected && (entity.navSurface !== null || entity.navAgent !== null);
        }
        const runtimeMeshes = showsEverything || followsSelection ? runtime?.world.meshes : NO_MESHES;
        for (const mesh of runtimeMeshes ?? session.navigation.previewMeshes(showsEverything ? null : selection))
            this.appendMesh(mesh);
        for (const line of this.gizmos.lines)
            this.lines.push(line);
        return this.lines;
    }
    private appendMesh(mesh: NavMesh): void {
        let cached = this.meshLines.get(mesh);
        if (!cached || cached.version !== mesh.version) {
            cached = { version: mesh.version, buffer: buildNavMeshLines(mesh) };
            this.meshLines.set(mesh, cached);
        }
        for (const line of cached.buffer.lines)
            this.lines.push(line);
    }
    private drawComponents(entity: Entity, alpha: number): void {
        const { navSurface, navAgent, navObstacle, navLink, navModifier } = entity;
        const world = entity.worldMatrix;
        if (navSurface?.collect === 'volume')
            drawBox(this.gizmos, world, navSurface.volumeCenter, navSurface.volumeSize, SURFACE_COLOR, alpha);
        if (navAgent) {
            mat4.getTranslation(base, world);
            base[1] -= navAgent.baseOffset;
            drawCylinder(this.gizmos, base, navAgent.radius, navAgent.height, AGENT_COLOR, alpha);
        }
        if (navObstacle?.shape === 'box')
            drawBox(this.gizmos, world, navObstacle.center, navObstacle.size, OBSTACLE_COLOR, alpha);
        if (navObstacle?.shape === 'capsule') {
            const height = navObstacle.size[1] * axisScale(entity, 1);
            mat4.transformPoint(base, world, navObstacle.center);
            base[1] -= height / 2;
            drawCylinder(this.gizmos, base, (navObstacle.size[0] / 2) * Math.max(axisScale(entity, 0), axisScale(entity, 2)), height, OBSTACLE_COLOR, alpha);
        }
        if (navLink) {
            const color = navLink.enabled ? LINK_COLOR : DISABLED_COLOR;
            mat4.transformPoint(start, world, navLink.start);
            mat4.transformPoint(end, world, navLink.end);
            drawCircle(this.gizmos, start, LINK_ENDPOINT_RADIUS, color, alpha);
            drawCircle(this.gizmos, end, navLink.bidirectional ? LINK_ENDPOINT_RADIUS : LINK_ENDPOINT_RADIUS / 2, color, alpha);
            drawArc(this.gizmos, start, end, vec3.distance(start, end) * LINK_ARC_PER_METER, color, alpha);
        }
        if (navModifier?.mode === 'volume')
            drawBox(this.gizmos, world, navModifier.center, navModifier.size, NAV_AREA_COLORS[navModifier.area], alpha);
    }
    private drawPath(agent: NavAgent): void {
        const { path } = agent;
        if (!path || agent.hasArrived)
            return;
        liftPoint(lifted, agent.position);
        for (let corner = agent.cornerIndex; corner < path.corners.length; corner++) {
            liftPoint(nextLifted, path.corners[corner]);
            this.gizmos.segment(lifted, nextLifted, PATH_COLOR, PATH_ALPHA);
            vec3.copy(lifted, nextLifted);
        }
        drawCircle(this.gizmos, lifted, agent.settings.radius, PATH_COLOR, PATH_ALPHA);
    }
}
