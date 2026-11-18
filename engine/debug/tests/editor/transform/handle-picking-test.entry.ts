import * as vec3 from '@/engine/core/math/vec3';
import { Scene } from '@/engine/core/scene/scene';
import { createGizmoFrame, type GizmoFrame } from '@/engine/editor/transform/gizmo/gizmo-frame';
import { GizmoLayout } from '@/engine/editor/transform/gizmo/gizmo-handle';
import { buildGizmoLayout } from '@/engine/editor/transform/gizmo/gizmo-layout';
import { pickHandle } from '@/engine/editor/transform/gizmo/handle-picking';
import type { GizmoTool, TransformSpace } from '@/engine/editor/transform/transform-settings';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import { createBox } from '@/engine/renderer/geometry/primitives';
import { createCheckList } from '../../support/check-list';
import { createCamera, pointerAt, pointerOver, VIEWPORT_SIZE, type Triple } from './transform-fixture';
const TOLERANCE = 1e-4;
const OBLIQUE_VIEW: Triple = [6, 5, 8];
const FRONT_VIEW: Triple = [0, 0, 10];
const SIDE_VIEW: Triple = [10, 0, 0];
const GIZMO_SCREEN_RADIUS_PX = 0.17 * VIEWPORT_SIZE;
const DIAGONAL = Math.SQRT1_2;
const checks = createCheckList('Alças do gizmo sob o ponteiro');
interface Gizmo {
    readonly layout: GizmoLayout;
    readonly frame: GizmoFrame;
    readonly camera: PerspectiveCamera;
    readonly visible: boolean;
}
interface GizmoOptions {
    readonly position?: Triple;
    readonly rotation?: Triple;
    readonly space?: TransformSpace;
}
function buildGizmo(tool: GizmoTool, view: Triple, options: GizmoOptions = {}): Gizmo {
    const scene = new Scene();
    const crate = scene.createEntity({ name: 'Caixote', kind: 'mesh', mesh: createBox(1, 1, 1) });
    vec3.set(crate.transform.position, ...(options.position ?? [0, 0, 0]));
    vec3.set(crate.transform.rotation, ...(options.rotation ?? [0, 0, 0]));
    scene.updateWorldMatrices();
    const camera = createCamera(view);
    const layout = new GizmoLayout();
    const frame = createGizmoFrame();
    const visible = buildGizmoLayout(layout, frame, {
        tool,
        targets: { entities: [crate], active: crate },
        pivotMode: 'pivot',
        space: options.space ?? 'global',
        camera,
        scale: 1,
        frozenAxes: null,
    });
    return { layout, frame, camera, visible };
}
function handleAt({ layout, frame, camera }: Gizmo, x: number, y: number, z: number): string | null {
    const point: Triple = [frame.origin[0] + x * frame.size, frame.origin[1] + y * frame.size, frame.origin[2] + z * frame.size];
    return pickHandle(layout, camera, pointerOver(camera, point))?.id ?? null;
}
function moveHandles(): void {
    const move = buildGizmo('translate', OBLIQUE_VIEW);
    checks.check('a seta X responde ao longo do eixo X', handleAt(move, 0.8, 0, 0) === 'move.x');
    checks.check('a seta Y responde ao longo do eixo Y', handleAt(move, 0, 0.8, 0) === 'move.y');
    checks.check('a seta Z responde ao longo do eixo Z', handleAt(move, 0, 0, 0.8) === 'move.z');
    checks.check('o quadrado entre X e Z move no plano XZ', handleAt(move, 0.39, 0, 0.39) === 'move.xz');
    checks.check('o centro move livre na vista', handleAt(move, 0, 0, 0) === 'move.view');
    checks.check('longe do gizmo nenhuma alça responde', pickHandle(move.layout, move.camera, pointerAt(10, 10)) === null);
}
function edgeOnHandles(): void {
    const { layout } = buildGizmo('translate', SIDE_VIEW);
    checks.check('a seta apontada para a câmera some', layout.find('move.x') === null);
    checks.check('os planos vistos de perfil somem', layout.find('move.xy') === null && layout.find('move.xz') === null);
    checks.check('o plano de frente para a câmera continua', layout.find('move.yz') !== null);
    checks.check('as setas de lado continuam', layout.find('move.y') !== null && layout.find('move.z') !== null);
}
function rotateHandles(): void {
    const front = buildGizmo('rotate', FRONT_VIEW);
    checks.check('o anel de frente para a câmera gira em Z', handleAt(front, DIAGONAL, DIAGONAL, 0) === 'rotate.z');
    checks.check('o anel externo gira em torno da vista', handleAt(front, 1.16 * DIAGONAL, 1.16 * DIAGONAL, 0) === 'rotate.view');
    const oblique = buildGizmo('rotate', OBLIQUE_VIEW);
    checks.check('a metade da frente do anel X responde', handleAt(oblique, 0, 0.53, 0.848) === 'rotate.x');
    checks.check('a metade de trás do anel X não responde', handleAt(oblique, 0, -0.53, -0.848) === null);
}
function scaleHandles(): void {
    const scale = buildGizmo('scale', OBLIQUE_VIEW);
    checks.check('o cubo central escala por igual', handleAt(scale, 0, 0, 0) === 'scale.uniform');
    checks.check('a haste X escala no eixo X', handleAt(scale, 0.8, 0, 0) === 'scale.x');
    checks.check('o quadrado entre X e Y escala os dois eixos', handleAt(scale, 0.39, 0.39, 0) === 'scale.xy');
}
function orientation(): void {
    const turned: GizmoOptions = { rotation: [0, 90, 0] };
    checks.nearAll('Mover em Global usa os eixos do mundo', buildGizmo('translate', OBLIQUE_VIEW, turned).frame.axes[0], [1, 0, 0], TOLERANCE);
    checks.nearAll('Mover em Local usa os eixos do ator', buildGizmo('translate', OBLIQUE_VIEW, { ...turned, space: 'local' }).frame.axes[0], [0, 0, -1], TOLERANCE);
    checks.nearAll('Escalar usa os eixos do ator mesmo em Global', buildGizmo('scale', OBLIQUE_VIEW, turned).frame.axes[0], [0, 0, -1], TOLERANCE);
}
function screenSize(): void {
    for (const distance of [10, 40]) {
        const { frame, camera } = buildGizmo('translate', [0, 0, distance]);
        const tip = pointerOver(camera, [frame.size, 0, 0]);
        checks.near(`a ${distance} m o gizmo ocupa a mesma fração da tela`, tip.x - VIEWPORT_SIZE / 2, GIZMO_SCREEN_RADIUS_PX, 0.5);
    }
    checks.check('atrás da câmera o gizmo não é montado', !buildGizmo('translate', FRONT_VIEW, { position: [0, 0, 20] }).visible);
}
moveHandles();
edgeOnHandles();
rotateHandles();
scaleHandles();
orientation();
screenSize();
checks.finish();
