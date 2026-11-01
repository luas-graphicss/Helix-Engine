import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { RigidBody } from '@/engine/physics/body/rigid-body';
import { RegionField, type FieldMode } from './region-field';
export interface VortexFieldOptions {
    center: Vec3;
    axis?: Vec3;
    strength: number;
    inwardStrength?: number;
    liftStrength?: number;
    radius?: number;
    falloff?: 'none' | 'linear';
    mode?: FieldMode;
}
const offset = vec3.create();
const radial = vec3.create();
const tangent = vec3.create();
export class VortexField extends RegionField {
    readonly center = vec3.create();
    readonly axis = vec3.create(0, 1, 0);
    strength: number;
    inwardStrength: number;
    liftStrength: number;
    radius: number;
    falloff: 'none' | 'linear';
    mode: FieldMode;
    constructor(options: VortexFieldOptions) {
        super();
        vec3.copy(this.center, options.center);
        if (options.axis)
            this.setAxis(options.axis);
        this.strength = options.strength;
        this.inwardStrength = options.inwardStrength ?? 0;
        this.liftStrength = options.liftStrength ?? 0;
        this.radius = Math.max(options.radius ?? 10, 0);
        this.falloff = options.falloff ?? 'linear';
        this.mode = options.mode ?? 'acceleration';
    }
    setAxis(axis: Vec3): void {
        if (vec3.length(axis) < 1e-9)
            return;
        vec3.normalize(this.axis, axis);
    }
    protected movesRestingBodies(): boolean {
        return this.strength !== 0 || this.inwardStrength !== 0 || this.liftStrength !== 0;
    }
    protected applyTo(body: RigidBody, weight: number, h: number): void {
        vec3.subtract(offset, body.position, this.center);
        const along = vec3.dot(offset, this.axis);
        vec3.scaleAndAdd(radial, offset, this.axis, -along);
        const distance = vec3.length(radial);
        if (this.radius > 0 && distance > this.radius)
            return;
        const factor = this.falloff === 'linear' && this.radius > 0 ? 1 - distance / this.radius : 1;
        const scale = factor * weight * h;
        const v = body.linearVelocity;
        if (distance > 1e-6) {
            vec3.scale(radial, radial, 1 / distance);
            vec3.cross(tangent, this.axis, radial);
            vec3.scaleAndAdd(v, v, tangent, this.rate(this.mode, this.strength, body) * scale);
            vec3.scaleAndAdd(v, v, radial, -this.rate(this.mode, this.inwardStrength, body) * scale);
        }
        if (this.liftStrength !== 0)
            vec3.scaleAndAdd(v, v, this.axis, this.rate(this.mode, this.liftStrength, body) * scale);
    }
}
