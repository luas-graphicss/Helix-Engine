import { distanceSquared, type Vector3Tuple } from '../sync/transform-state';
import type { NetworkObject } from './network-object';
export type Relevance = {
    readonly mode: 'always';
} | {
    readonly mode: 'owner';
} | {
    readonly mode: 'distance';
    readonly radius: number;
};
export const ALWAYS_RELEVANT: Relevance = { mode: 'always' };
const LEAVE_RADIUS_FACTOR = 1.15;
export function isRelevantTo(object: NetworkObject, clientId: number, observers: readonly Vector3Tuple[], currentlyVisible: boolean): boolean {
    const { relevance } = object;
    if (relevance.mode === 'always' || object.ownerId === clientId)
        return true;
    if (relevance.mode === 'owner')
        return false;
    if (observers.length === 0)
        return true;
    const radius = relevance.radius * (currentlyVisible ? LEAVE_RADIUS_FACTOR : 1);
    return observers.some((observer) => distanceSquared(observer, object.transform.position) <= radius * radius);
}
