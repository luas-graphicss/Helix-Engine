import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { ColliderShape } from '@/engine/physics/shapes/collider-shape';
export const SHAPE_SAMPLE_COUNT = 27;
const GRID = 3;
const LAYERS = 3;
const POINTS_PER_LAYER = SHAPE_SAMPLE_COUNT / LAYERS;
const LAYER_OFFSET = 0.5;
const OUTER_RING = 0.5;
const MIDDLE_RING = 0.7;
export function sampleShapePoints(out: Vec3[], shape: ColliderShape): Vec3[] {
    switch (shape.kind) {
        case 'box': {
            const h = shape.halfExtents;
            let index = 0;
            for (let ix = 0; ix < GRID; ix++) {
                for (let iy = 0; iy < GRID; iy++) {
                    for (let iz = 0; iz < GRID; iz++) {
                        vec3.set(out[index++], gridCoordinate(ix) * h[0], gridCoordinate(iy) * h[1], gridCoordinate(iz) * h[2]);
                    }
                }
            }
            return out;
        }
        case 'sphere':
            return fillLayeredPoints(out, shape.radius, 0);
        case 'capsule':
            return fillLayeredPoints(out, shape.radius, shape.halfHeight);
        case 'heightfield':
            return out.slice(0, 0);
        case 'mesh': {
            const { min, max } = shape.localBounds;
            let index = 0;
            for (let ix = 0; ix < GRID; ix++) {
                for (let iy = 0; iy < GRID; iy++) {
                    for (let iz = 0; iz < GRID; iz++) {
                        vec3.set(out[index++], min[0] + ((ix + 0.5) / GRID) * (max[0] - min[0]), min[1] + ((iy + 0.5) / GRID) * (max[1] - min[1]), min[2] + ((iz + 0.5) / GRID) * (max[2] - min[2]));
                    }
                }
            }
            return out;
        }
    }
}
function gridCoordinate(index: number): number {
    return ((index + 0.5) / GRID) * 2 - 1;
}
function fillLayeredPoints(out: Vec3[], radius: number, halfHeight: number): Vec3[] {
    let index = 0;
    for (let layer = 0; layer < LAYERS; layer++) {
        const side = layer - 1;
        const y = side * (halfHeight + radius * LAYER_OFFSET);
        const ringRadius = radius * (side === 0 ? MIDDLE_RING : OUTER_RING);
        const phase = side === 0 ? 0 : Math.PI / (POINTS_PER_LAYER - 1);
        vec3.set(out[index++], 0, y, 0);
        for (let i = 1; i < POINTS_PER_LAYER; i++) {
            const angle = ((i - 1) / (POINTS_PER_LAYER - 1)) * Math.PI * 2 + phase;
            vec3.set(out[index++], Math.cos(angle) * ringRadius, y, Math.sin(angle) * ringRadius);
        }
    }
    return out;
}
