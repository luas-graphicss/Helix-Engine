import type { Aabb } from '@/engine/core/math/aabb';
import type { Vec3 } from '@/engine/core/math/vec3';
import { shapeVolume } from '@/engine/physics/shapes/collider-shape';
import { createShapeFromSettings, DEFAULT_DENSITY, type RigidBodySettings } from './rigid-body-settings';
const FLAT_THRESHOLD = 0.02;
const FLAT_SLAB_THICKNESS = 0.5;
export function fitColliderToBounds(settings: RigidBodySettings, bounds: Aabb): void {
    const sizeX = Math.max(bounds.max[0] - bounds.min[0], 0);
    const sizeY = Math.max(bounds.max[1] - bounds.min[1], 0);
    const sizeZ = Math.max(bounds.max[2] - bounds.min[2], 0);
    const centerX = (bounds.min[0] + bounds.max[0]) * 0.5;
    let centerY = (bounds.min[1] + bounds.max[1]) * 0.5;
    const centerZ = (bounds.min[2] + bounds.max[2]) * 0.5;
    switch (settings.collider) {
        case 'box': {
            let height = sizeY;
            if (sizeY < FLAT_THRESHOLD) {
                height = FLAT_SLAB_THICKNESS;
                centerY = bounds.max[1] - FLAT_SLAB_THICKNESS * 0.5;
            }
            settings.boxSize[0] = sizeX;
            settings.boxSize[1] = height;
            settings.boxSize[2] = sizeZ;
            break;
        }
        case 'sphere':
            settings.radius = Math.max(sizeX, sizeY, sizeZ) * 0.5;
            break;
        case 'capsule': {
            const radius = Math.max(sizeX, sizeZ) * 0.5;
            settings.radius = radius;
            settings.height = Math.max(sizeY, 2 * radius);
            break;
        }
    }
    settings.center[0] = centerX;
    settings.center[1] = centerY;
    settings.center[2] = centerZ;
}
export function defaultMassForSettings(settings: RigidBodySettings, scale: Vec3): number {
    const volume = shapeVolume(createShapeFromSettings(settings, scale));
    return Math.max(Number((DEFAULT_DENSITY * volume).toFixed(2)), 0.01);
}
