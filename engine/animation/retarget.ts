import type { AnimationSkeleton } from '@/engine/core/animation/animation-document';
import { normalizeBoneName } from '@/engine/core/animation/bone-roles';
export interface RetargetSkeleton {
    readonly names: readonly string[];
    readonly bindPositions: Float32Array;
}
export function matchJoint(targetNames: readonly string[], name: string, normalizedTargets: readonly string[] = targetNames.map(normalizeBoneName)): number {
    const exact = targetNames.indexOf(name);
    if (exact !== -1)
        return exact;
    return normalizedTargets.indexOf(normalizeBoneName(name));
}
export function translationScale(source: AnimationSkeleton | null, target: RetargetSkeleton): number {
    if (!source?.bindPositions)
        return 1;
    const normalizedTargets = target.names.map(normalizeBoneName);
    let sourceLength = 0;
    let targetLength = 0;
    source.names.forEach((name, joint) => {
        const match = matchJoint(target.names, name, normalizedTargets);
        if (match === -1)
            return;
        const a = Math.hypot(source.bindPositions![joint * 3], source.bindPositions![joint * 3 + 1], source.bindPositions![joint * 3 + 2]);
        const b = Math.hypot(target.bindPositions[match * 3], target.bindPositions[match * 3 + 1], target.bindPositions[match * 3 + 2]);
        if (a > 1e-6 && b > 1e-6) {
            sourceLength += a;
            targetLength += b;
        }
    });
    if (sourceLength <= 1e-6 || targetLength <= 1e-6)
        return 1;
    const factor = targetLength / sourceLength;
    return Math.abs(factor - 1) < 0.02 ? 1 : factor;
}
