import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { RigidBody } from '@/engine/physics/body/rigid-body';
import { RegionField, type FieldMode } from './region-field';
export interface DirectionalFieldOptions {
    direction: Vec3;
    strength: number;
    mode?: FieldMode;
}
export class DirectionalField extends RegionField {
    readonly direction = vec3.create(0, 1, 0);
    strength: number;
    mode: FieldMode;
    constructor(options: DirectionalFieldOptions) {
        super();
        this.setDirection(options.direction);
        this.strength = options.strength;
        this.mode = options.mode ?? 'acceleration';
    }
    setDirection(direction: Vec3): void {
        if (vec3.length(direction) < 1e-9)
            return;
        vec3.normalize(this.direction, direction);
    }
    protected movesRestingBodies(): boolean {
        return this.strength !== 0;
    }
    protected applyTo(body: RigidBody, weight: number, h: number): void {
        const delta = this.rate(this.mode, this.strength, body) * weight * h;
        vec3.scaleAndAdd(body.linearVelocity, body.linearVelocity, this.direction, delta);
    }
}
