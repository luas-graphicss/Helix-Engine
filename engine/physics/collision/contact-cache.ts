import type { RigidBody } from '@/engine/physics/body/rigid-body';
import { Manifold, pairKey } from './manifold';
export class ContactCache {
    private readonly manifolds = new Map<number, Manifold>();
    private stamp = 0;
    get size(): number {
        return this.manifolds.size;
    }
    beginStep(): void {
        this.stamp++;
    }
    acquire(a: RigidBody, b: RigidBody): Manifold {
        const key = pairKey(a, b);
        let manifold = this.manifolds.get(key);
        if (!manifold || manifold.bodyA !== a || manifold.bodyB !== b) {
            manifold = new Manifold(a, b);
            this.manifolds.set(key, manifold);
        }
        manifold.stamp = this.stamp;
        return manifold;
    }
    forEach(visit: (manifold: Manifold) => void): void {
        for (const manifold of this.manifolds.values())
            visit(manifold);
    }
    endStep(): void {
        for (const [key, manifold] of this.manifolds) {
            if (manifold.stamp === this.stamp)
                continue;
            if (manifold.bodyA.isResting && manifold.bodyB.isResting)
                continue;
            this.manifolds.delete(key);
        }
    }
    removeBody(body: RigidBody): void {
        for (const [key, manifold] of this.manifolds) {
            if (manifold.bodyA === body || manifold.bodyB === body)
                this.manifolds.delete(key);
        }
    }
    clear(): void {
        this.manifolds.clear();
    }
}
