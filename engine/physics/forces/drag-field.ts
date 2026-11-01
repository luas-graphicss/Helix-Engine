import * as vec3 from '@/engine/core/math/vec3';
import type { RigidBody } from '@/engine/physics/body/rigid-body';
import { RegionField } from './region-field';
export interface DragFieldOptions {
    linear?: number;
    quadratic?: number;
    angular?: number;
}
export class DragField extends RegionField {
    linear: number;
    quadratic: number;
    angular: number;
    constructor(options: DragFieldOptions = {}) {
        super();
        this.linear = Math.max(options.linear ?? 1, 0);
        this.quadratic = Math.max(options.quadratic ?? 0, 0);
        this.angular = Math.max(options.angular ?? 0, 0);
    }
    protected movesRestingBodies(): boolean {
        return false;
    }
    protected applyTo(body: RigidBody, weight: number, h: number): void {
        const scale = weight * h;
        const v = body.linearVelocity;
        const speed = vec3.length(v);
        const factor = 1 / ((1 + this.linear * scale) * (1 + this.quadratic * speed * scale));
        vec3.scale(v, v, factor);
        if (this.angular > 0)
            vec3.scale(body.angularVelocity, body.angularVelocity, 1 / (1 + this.angular * scale));
    }
}
