import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import * as aabb from '@/engine/core/math/aabb';
import { clamp } from '@/engine/core/math/scalar';
import type { RigidBody } from '@/engine/physics/body/rigid-body';
import type { PhysicsWorld } from '@/engine/physics/world/physics-world';
import type { RadialFalloff } from './radial-field';
export interface ExplosionOptions {
    falloff?: RadialFalloff;
    upwardBias?: number;
    mode?: 'impulse' | 'velocity';
}
const box = aabb.create();
const closest = vec3.create();
const direction = vec3.create();
const impulse = vec3.create();
export function applyExplosion(world: PhysicsWorld, center: Vec3, radius: number, strength: number, options: ExplosionOptions = {}): number {
    if (!(radius > 0) || strength === 0)
        return 0;
    const falloff = options.falloff ?? 'linear';
    const upward = clamp(options.upwardBias ?? 0, 0, 1);
    const perMass = options.mode === 'velocity';
    vec3.set(box.min, center[0] - radius, center[1] - radius, center[2] - radius);
    vec3.set(box.max, center[0] + radius, center[1] + radius, center[2] + radius);
    let hit = 0;
    world.queryAabb(box, null, (body: RigidBody) => {
        if (!body.isDynamic)
            return;
        vec3.set(closest, clamp(center[0], body.aabb.min[0], body.aabb.max[0]), clamp(center[1], body.aabb.min[1], body.aabb.max[1]), clamp(center[2], body.aabb.min[2], body.aabb.max[2]));
        const distance = vec3.distance(closest, center);
        if (distance > radius)
            return;
        vec3.subtract(direction, body.position, center);
        if (vec3.length(direction) < 1e-6)
            vec3.set(direction, 0, 1, 0);
        vec3.normalize(direction, direction);
        if (upward > 0) {
            direction[1] += upward;
            vec3.normalize(direction, direction);
        }
        let factor = 1;
        if (falloff === 'linear')
            factor = 1 - distance / radius;
        else if (falloff === 'inverse-square')
            factor = 1 / Math.max(distance * distance, 1);
        const magnitude = strength * factor * (perMass ? body.mass : 1);
        vec3.scale(impulse, direction, magnitude);
        body.applyImpulseAtPoint(impulse, closest);
        hit++;
    });
    return hit;
}
