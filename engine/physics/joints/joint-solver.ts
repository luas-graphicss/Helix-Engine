import type { Joint } from './joint';
import type { JointSolverContext } from './joint-math';
export function prepareJoints(all: readonly Joint[], out: Joint[], context: JointSolverContext): void {
    out.length = 0;
    for (const joint of all) {
        if (!joint.isActive)
            continue;
        joint.prepare(context);
        out.push(joint);
    }
}
export function warmStartJoints(joints: readonly Joint[], context: JointSolverContext): void {
    for (const joint of joints)
        joint.warmStart(context);
}
export function solveJoints(joints: readonly Joint[], context: JointSolverContext, useBias: boolean): void {
    for (const joint of joints)
        joint.solve(context, useBias);
}
export function finalizeJoints(joints: readonly Joint[], context: JointSolverContext, broken: Joint[]): void {
    for (const joint of joints) {
        joint.finalize(context);
        if (joint.broken)
            broken.push(joint);
    }
}
