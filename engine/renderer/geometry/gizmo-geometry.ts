import type { GizmoShape } from '@/engine/renderer/gizmo/gizmo-draw-list';
import type { MeshData } from './mesh-data';
import { createBox, MeshBuilder } from './primitives';
const TWO_PI = Math.PI * 2;
const RING_TUBE_RADIUS = 0.011;
const SHAFT_SIDES = 10;
const TIP_SIDES = 16;
const TUBE_SIDES = 8;
const RING_SEGMENTS = 96;
const ARC_SEGMENTS = 28;
const DISC_SEGMENTS = 64;
function createShaft(): MeshData {
    const builder = new MeshBuilder();
    builder.grid(SHAFT_SIDES, 1, (u, v) => {
        const theta = u * TWO_PI;
        const c = Math.cos(theta);
        const s = Math.sin(theta);
        return { position: [v, c, s], normal: [0, c, s] };
    });
    return builder.build('GizmoHaste');
}
function createTip(): MeshData {
    const builder = new MeshBuilder();
    builder.grid(TIP_SIDES, 1, (u, v) => {
        const theta = u * TWO_PI;
        const c = Math.cos(theta);
        const s = Math.sin(theta);
        const radius = 1 - v;
        return { position: [v, c * radius, s * radius], normal: [Math.SQRT1_2, c * Math.SQRT1_2, s * Math.SQRT1_2] };
    });
    builder.grid(TIP_SIDES, 1, (u, v) => {
        const theta = u * TWO_PI;
        return { position: [0, Math.cos(theta) * v, Math.sin(theta) * v], normal: [-1, 0, 0] };
    });
    return builder.build('GizmoPonta');
}
function createQuad(): MeshData {
    const builder = new MeshBuilder();
    builder.grid(1, 1, (u, v) => ({ position: [u, v, 0], normal: [0, 0, 1] }));
    return builder.build('GizmoPlano');
}
function createTorusArc(name: string, sweep: number, segments: number): MeshData {
    const builder = new MeshBuilder();
    builder.grid(segments, TUBE_SIDES, (u, v) => {
        const theta = u * sweep;
        const phi = v * TWO_PI;
        const ringX = Math.cos(theta);
        const ringY = Math.sin(theta);
        const outward = Math.cos(phi);
        const lift = Math.sin(phi);
        const radius = 1 + outward * RING_TUBE_RADIUS;
        return { position: [ringX * radius, ringY * radius, lift * RING_TUBE_RADIUS], normal: [ringX * outward, ringY * outward, lift] };
    });
    return builder.build(name);
}
function createDisc(): MeshData {
    const builder = new MeshBuilder();
    builder.grid(DISC_SEGMENTS, 1, (u, v) => {
        const theta = u * TWO_PI;
        return { position: [Math.cos(theta) * v, Math.sin(theta) * v, 0], normal: [0, 0, 1] };
    });
    return builder.build('GizmoDisco');
}
export function createGizmoMeshes(): Record<GizmoShape, MeshData> {
    return {
        shaft: createShaft(),
        cone: createTip(),
        cube: createBox(1, 1, 1),
        quad: createQuad(),
        ring: createTorusArc('GizmoAnel', TWO_PI, RING_SEGMENTS),
        arc: createTorusArc('GizmoArco', Math.PI / 2, ARC_SEGMENTS),
        disc: createDisc(),
    };
}
