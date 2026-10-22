import type { RigidBody } from '@/engine/physics/body/rigid-body';
export interface ForceField {
    wakeAffected(bodies: readonly RigidBody[], time: number): void;
    beginStep?(time: number): void;
    apply(bodies: readonly RigidBody[], h: number, time: number): void;
}
