import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { Aabb } from '@/engine/core/math/aabb';
import { clamp } from '@/engine/core/math/scalar';
export type FieldRegion = {
    readonly kind: 'everywhere';
} | {
    readonly kind: 'sphere';
    readonly center: Vec3;
    radius: number;
    falloff: number;
} | {
    readonly kind: 'box';
    readonly center: Vec3;
    readonly halfExtents: Vec3;
    falloff: number;
};
export const EVERYWHERE: FieldRegion = { kind: 'everywhere' };
export function sphereRegion(center: Vec3, radius: number, falloff = 0): FieldRegion {
    return { kind: 'sphere', center: vec3.copy(vec3.create(), center), radius: Math.max(radius, 0), falloff: clamp(falloff, 0, 1) };
}
export function boxRegion(center: Vec3, halfExtents: Vec3, falloff = 0): FieldRegion {
    const extents = vec3.copy(vec3.create(), halfExtents);
    for (let axis = 0; axis < 3; axis++)
        extents[axis] = Math.max(Math.abs(extents[axis]), 0);
    return { kind: 'box', center: vec3.copy(vec3.create(), center), halfExtents: extents, falloff: clamp(falloff, 0, 1) };
}
export function regionWeight(region: FieldRegion, point: Vec3): number {
    switch (region.kind) {
        case 'everywhere':
            return 1;
        case 'sphere': {
            const distance = vec3.distance(point, region.center);
            if (distance >= region.radius)
                return 0;
            const edge = region.radius * region.falloff;
            if (edge <= 0)
                return 1;
            return clamp((region.radius - distance) / edge, 0, 1);
        }
        case 'box': {
            let weight = 1;
            for (let axis = 0; axis < 3; axis++) {
                const half = region.halfExtents[axis];
                const inset = half - Math.abs(point[axis] - region.center[axis]);
                if (inset <= 0)
                    return 0;
                const edge = half * region.falloff;
                if (edge > 0)
                    weight = Math.min(weight, clamp(inset / edge, 0, 1));
            }
            return weight;
        }
    }
}
export function regionTouches(region: FieldRegion, box: Aabb): boolean {
    switch (region.kind) {
        case 'everywhere':
            return true;
        case 'sphere': {
            const c = region.center;
            const x = clamp(c[0], box.min[0], box.max[0]) - c[0];
            const y = clamp(c[1], box.min[1], box.max[1]) - c[1];
            const z = clamp(c[2], box.min[2], box.max[2]) - c[2];
            return x * x + y * y + z * z <= region.radius * region.radius;
        }
        case 'box': {
            for (let axis = 0; axis < 3; axis++) {
                const half = region.halfExtents[axis];
                const c = region.center[axis];
                if (box.max[axis] < c - half || box.min[axis] > c + half)
                    return false;
            }
            return true;
        }
    }
}
