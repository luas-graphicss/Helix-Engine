import * as mat4 from '@/engine/core/math/mat4';
import * as quat from '@/engine/core/math/quat';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { clamp } from '@/engine/core/math/scalar';
import type { AnimationDocument, AnimationInterpolation, AnimationPath } from '@/engine/core/animation/animation-document';
import { boneSide } from '@/engine/core/animation/bone-roles';
import { copyDocumentKeys, createEmptyDocument, easeDocumentKeys, keyRefKey, keysAtTime, moveDocumentKeys, pasteDocumentKeys, removeDocumentKeys, sameKeyRef, setDocumentDuration, setDocumentInterpolation, setDocumentKey, setDocumentKeyValue, stretchDocument, trackAt, type KeyClipboard, type KeyEasing, type KeyRef, } from '@/engine/core/animation/track-editing';
import type { Entity } from '@/engine/core/scene/entity';
import type { Rig } from '@/engine/core/scene/rig';
import { SkeletonClip } from '@/engine/animation/skeleton-clip';
import { AnimationPlayer } from '@/engine/animation/playback/animation-player';
import { LIMB_IDS, LIMBS, resolveLimb, type LimbId } from '@/engine/animation/ik/limb-chains';
import { solveTwoBoneIk } from '@/engine/animation/ik/two-bone-ik';
import { changedPaths, readJointPath, readSnapshotPath } from '@/engine/animation/pose/joint-keys';
import type { SkeletonOverlayRequest, SkeletonOverlayRig } from '@/engine/renderer/passes/skeleton-pass';
import { SetValueCommand } from '@/engine/editor/commands/set-value-command';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { applyTransformSnapshot, snapshotTransform, type TransformSnapshot } from '@/engine/editor/operations/transform-operations';
export type AnimationView = 'dopesheet' | 'curves';
export type PerformerSource = {
    readonly kind: 'clip';
} | {
    readonly kind: 'asset';
    readonly assetId: string;
};
export interface Performer {
    readonly entity: Entity;
    readonly rig: Rig;
    readonly player: AnimationPlayer;
    source: PerformerSource;
    document: AnimationDocument | null;
    readonly restore: TransformSnapshot[];
    readonly overlay: SkeletonOverlayRig;
}
interface IkDrag {
    readonly performer: Performer;
    readonly limb: LimbId;
    readonly chain: {
        upper: Entity;
        lower: Entity;
        end: Entity;
    };
    readonly target: Vec3;
    readonly hint: Vec3;
}
interface KeyDrag {
    readonly base: AnimationDocument;
    readonly refs: readonly KeyRef[];
    readonly baseTime: number;
}
type Listener = () => void;
export const DEFAULT_FRAME_RATE = 30;
export const PLAYBACK_SPEEDS: readonly number[] = [0.1, 0.25, 0.5, 1, 1.5, 2];
const LOG_SOURCE = 'Animação';
const FOCUS_DISTANCE_FACTOR = 6;
const FOCUS_MIN_DISTANCE = 0.6;
const scratchPosition = vec3.create();
const scratchOther = vec3.create();
const scratchForward = vec3.create();
export function rigDisplayName(owner: Entity): string {
    return owner.parent?.character ? owner.parent.name : owner.name;
}
export function riggedEntities(session: EditorSession): Entity[] {
    const found: Entity[] = [];
    session.scene.traverse((entity) => {
        if (entity.rig)
            found.push(entity);
    });
    return found;
}
export function rigOwnerOf(entity: Entity): Entity | null {
    if (entity.rig)
        return entity;
    for (let current: Entity | null = entity; current; current = current.parent)
        if (current.rig)
            return current;
    const stack = [...entity.children];
    while (stack.length > 0) {
        const child = stack.pop() as Entity;
        if (child.rig)
            return child;
        stack.push(...child.children);
    }
    return null;
}
function isAttached(entity: Entity, root: Entity): boolean {
    let current: Entity | null = entity;
    while (current.parent)
        current = current.parent;
    return current === root;
}
