import type { RigidBody } from '@/engine/physics/body/rigid-body';
import type { ForceField } from '@/engine/physics/world/force-field';
import { EVERYWHERE, regionTouches, regionWeight, type FieldRegion } from './field-region';
export type FieldMode = 'acceleration' | 'force';
export abstract class RegionField implements ForceField {
    enabled = true;
    region: FieldRegion = EVERYWHERE;
    private detach: (() => void) | null = null;
    attach(detach: () => void): void {
        this.detach = detach;
    }
    remove(): void {
        const detach = this.detach;
        this.detach = null;
        detach?.();
    }
    get attached(): boolean {
        return this.detach !== null;
    }
    wakeAffected(bodies: readonly RigidBody[]): void {
        if (!this.enabled || !this.movesRestingBodies())
            return;
        for (const body of bodies) {
            if (!body.sleeping || !body.isDynamic || body.outOfBounds)
                continue;
            if (regionTouches(this.region, body.aabb))
                body.wake();
        }
    }
    apply(bodies: readonly RigidBody[], h: number, time: number): void {
        if (!this.enabled)
            return;
        for (const body of bodies) {
            if (!body.isDynamic || body.outOfBounds)
                continue;
            const weight = regionWeight(this.region, body.position);
            if (weight <= 0)
                continue;
            this.applyTo(body, weight, h, time);
        }
    }
    protected rate(mode: FieldMode, strength: number, body: RigidBody): number {
        return mode === 'force' ? strength * body.invMass : strength;
    }
    protected abstract movesRestingBodies(): boolean;
    protected abstract applyTo(body: RigidBody, weight: number, h: number, time: number): void;
}
