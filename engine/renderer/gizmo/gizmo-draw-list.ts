import * as mat4 from '@/engine/core/math/mat4';
import type { Mat4 } from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
export type GizmoShape = 'shaft' | 'cone' | 'cube' | 'quad' | 'ring' | 'arc' | 'disc';
export const FULL_SWEEP = Math.PI * 2;
export interface GizmoDrawItem {
    shape: GizmoShape;
    readonly model: Mat4;
    readonly color: Vec3;
    alpha: number;
    dimBack: boolean;
    sweep: number;
}
export class GizmoDrawList {
    readonly origin = vec3.create();
    private readonly items: GizmoDrawItem[] = [];
    private used = 0;
    get count(): number {
        return this.used;
    }
    reset(origin: Vec3): void {
        vec3.copy(this.origin, origin);
        this.used = 0;
    }
    add(shape: GizmoShape): GizmoDrawItem {
        if (this.used === this.items.length)
            this.items.push({ shape, model: mat4.create(), color: vec3.create(1, 1, 1), alpha: 1, dimBack: false, sweep: FULL_SWEEP });
        const item = this.items[this.used++];
        item.shape = shape;
        item.alpha = 1;
        item.dimBack = false;
        item.sweep = FULL_SWEEP;
        return item;
    }
    at(index: number): GizmoDrawItem {
        return this.items[index];
    }
}
