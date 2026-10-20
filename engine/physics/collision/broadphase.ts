import type { RigidBody } from '@/engine/physics/body/rigid-body';
export type PairVisitor = (a: RigidBody, b: RigidBody) => void;
export class Broadphase {
    private readonly sorted: RigidBody[] = [];
    add(body: RigidBody): void {
        this.sorted.push(body);
    }
    remove(body: RigidBody): void {
        const index = this.sorted.indexOf(body);
        if (index !== -1)
            this.sorted.splice(index, 1);
    }
    clear(): void {
        this.sorted.length = 0;
    }
    findPairs(visit: PairVisitor): void {
        const { sorted } = this;
        for (let i = 1; i < sorted.length; i++) {
            const body = sorted[i];
            const minX = body.aabb.min[0];
            let j = i - 1;
            while (j >= 0 && sorted[j].aabb.min[0] > minX) {
                sorted[j + 1] = sorted[j];
                j--;
            }
            sorted[j + 1] = body;
        }
        for (let i = 0; i < sorted.length; i++) {
            const a = sorted[i];
            const aabbA = a.aabb;
            const maxX = aabbA.max[0];
            for (let j = i + 1; j < sorted.length; j++) {
                const b = sorted[j];
                const aabbB = b.aabb;
                if (aabbB.min[0] > maxX)
                    break;
                if (a.isResting && b.isResting)
                    continue;
                if (aabbA.min[1] > aabbB.max[1] || aabbB.min[1] > aabbA.max[1])
                    continue;
                if (aabbA.min[2] > aabbB.max[2] || aabbB.min[2] > aabbA.max[2])
                    continue;
                visit(a, b);
            }
        }
    }
}
