import type { Vec3 } from '@/engine/core/math/vec3';
import type { ColliderShape } from '@/engine/physics/shapes/collider-shape';
export function computeLocalInertia(out: Vec3, shape: ColliderShape, mass: number): Vec3 {
    switch (shape.kind) {
        case 'box': {
            const w = 2 * shape.halfExtents[0];
            const h = 2 * shape.halfExtents[1];
            const d = 2 * shape.halfExtents[2];
            const k = mass / 12;
            out[0] = k * (h * h + d * d);
            out[1] = k * (w * w + d * d);
            out[2] = k * (w * w + h * h);
            return out;
        }
        case 'sphere': {
            const i = 0.4 * mass * shape.radius * shape.radius;
            out[0] = i;
            out[1] = i;
            out[2] = i;
            return out;
        }
        case 'capsule': {
            const r = shape.radius;
            const hh = shape.halfHeight;
            const cylinderVolume = Math.PI * r * r * (2 * hh);
            const hemisphereVolume = (2 / 3) * Math.PI * r * r * r;
            const totalVolume = cylinderVolume + 2 * hemisphereVolume;
            const cylinderMass = (mass * cylinderVolume) / totalVolume;
            const hemisphereMass = (mass * hemisphereVolume) / totalVolume;
            const axial = cylinderMass * r * r * 0.5 + 2 * hemisphereMass * 0.4 * r * r;
            const transverse = cylinderMass * (r * r * 0.25 + (hh * hh) / 3) + 2 * hemisphereMass * (0.4 * r * r + hh * hh + 0.75 * hh * r);
            out[0] = transverse;
            out[1] = axial;
            out[2] = transverse;
            return out;
        }
    }
}
