import type { Entity } from '@/engine/core/scene/entity';
import { SetValueCommand } from '@/engine/editor/commands/set-value-command';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { applyTransformSnapshot, snapshotTransform, type TransformSnapshot } from './transform-operations';
type JointPose = TransformSnapshot[];
function snapshotJoints(joints: readonly Entity[]): JointPose {
    return joints.map(snapshotTransform);
}
export function applyRigBindPose(session: EditorSession, owner: Entity): void {
    const rig = owner.rig;
    if (!rig)
        return;
    const before = snapshotJoints(rig.joints);
    rig.applyBindPose();
    const after = snapshotJoints(rig.joints);
    rig.joints.forEach((joint, index) => applyTransformSnapshot(joint, before[index]));
    session.history.execute(new SetValueCommand<JointPose>(`Pose de repouso de ${owner.name}`, (pose) => rig.joints.forEach((joint, index) => applyTransformSnapshot(joint, pose[index])), before, after));
}
