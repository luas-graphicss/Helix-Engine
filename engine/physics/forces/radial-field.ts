import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { RigidBody } from '@/engine/physics/body/rigid-body';
import { RegionField, type FieldMode } from './region-field';
export type RadialFalloff = 'none' | 'linear' | 'inverse-square';
export interface RadialFieldOptions {
    center: Vec3;
    strength: number;
    radius?: number;
    falloff?: RadialFalloff;
    mode?: FieldMode;
}
const offset = vec3.create();
export class RadialField extends RegionField {
    readonly center = vec3.create();
    strength: number;
    radius: number;
    falloff: RadialFalloff;
    mode: FieldMode;
    constructor(options: RadialFieldOptions) {
        super();
        vec3.copy(this.center, options.center);
        this.strength = options.strength;
        this.radius = Math.max(options.radius ?? 10, 0);
        this.falloff = options.falloff ?? 'linear';
        this.mode = options.mode ?? 'acceleration';
    }
    protected movesRestingBodies(): boolean {
        return this.strength !== 0;
    }
    protected applyTo(body: RigidBody, weight: number, h: number): void {
        vec3.subtract(offset, body.position, this.center);
        const distance = vec3.length(offset);
        if (distance < 1e-6)
            return;
        if (this.radius > 0 && distance > this.radius)
            return;
        let factor = 1;
        if (this.falloff === 'linear')
            factor = this.radius > 0 ? 1 - distance / this.radius : 1;
        else if (this.falloff === 'inverse-square')
            factor = 1 / Math.max(distance * distance, 1);
        const delta = (this.rate(this.mode, this.strength, body) * factor * weight * h) / distance;
        vec3.scaleAndAdd(body.linearVelocity, body.linearVelocity, offset, delta);
    }
}
