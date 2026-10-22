import type { RigidBody } from '@/engine/physics/body/rigid-body';
import type { Manifold } from '@/engine/physics/collision/manifold';
import type { PhysicsSettings } from './physics-settings';
export function wakeTouchingBodies(manifolds: readonly Manifold[]): void {
    let changed = true;
    while (changed) {
        changed = false;
        for (const { bodyA, bodyB } of manifolds) {
            if (bodyA.isActive && bodyB.sleeping && !bodyB.outOfBounds) {
                bodyB.wake();
                changed = true;
            }
            else if (bodyB.isActive && bodyA.sleeping && !bodyA.outOfBounds) {
                bodyA.wake();
                changed = true;
            }
        }
    }
}
export function accumulateSleepTime(body: RigidBody, settings: PhysicsSettings, dt: number): void {
    if (!settings.sleepEnabled || !body.canSleep) {
        body.sleepTime = 0;
        return;
    }
    const v = body.linearVelocity;
    const w = body.angularVelocity;
    const linearLimit = settings.sleepLinearThreshold * settings.sleepLinearThreshold;
    const angularLimit = settings.sleepAngularThreshold * settings.sleepAngularThreshold;
    const linear = v[0] * v[0] + v[1] * v[1] + v[2] * v[2];
    const angular = w[0] * w[0] + w[1] * w[1] + w[2] * w[2];
    body.sleepTime = linear < linearLimit && angular < angularLimit ? body.sleepTime + dt : 0;
}
export class IslandSleeper {
    private parent = new Int32Array(64);
    private minSleepTime = new Float32Array(64);
    apply(bodies: readonly RigidBody[], manifolds: readonly Manifold[], timeToSleep: number, dt: number): number {
        const count = bodies.length;
        if (count === 0)
            return 0;
        this.ensureCapacity(count);
        const parent = this.parent;
        for (let i = 0; i < count; i++)
            parent[i] = i;
        for (const manifold of manifolds) {
            const a = manifold.bodyA.islandSlot;
            const b = manifold.bodyB.islandSlot;
            if (a >= 0 && b >= 0)
                this.union(a, b);
        }
        const minSleepTime = this.minSleepTime;
        for (let i = 0; i < count; i++)
            minSleepTime[i] = Infinity;
        for (let i = 0; i < count; i++) {
            const root = this.find(i);
            const sleepTime = bodies[i].sleepTime;
            if (sleepTime < minSleepTime[root])
                minSleepTime[root] = sleepTime;
        }
        const threshold = Math.max(timeToSleep, dt);
        let slept = 0;
        for (let i = 0; i < count; i++) {
            const body = bodies[i];
            if (!body.isSimulated || minSleepTime[this.find(i)] < threshold)
                continue;
            body.sleep();
            slept++;
        }
        return slept;
    }
    private ensureCapacity(count: number): void {
        if (this.parent.length >= count)
            return;
        let capacity = this.parent.length;
        while (capacity < count)
            capacity *= 2;
        this.parent = new Int32Array(capacity);
        this.minSleepTime = new Float32Array(capacity);
    }
    private find(index: number): number {
        const parent = this.parent;
        while (parent[index] !== index) {
            parent[index] = parent[parent[index]];
            index = parent[index];
        }
        return index;
    }
    private union(a: number, b: number): void {
        const rootA = this.find(a);
        const rootB = this.find(b);
        if (rootA !== rootB)
            this.parent[rootB] = rootA;
    }
}
