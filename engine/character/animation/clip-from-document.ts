import type { ImportedAnimation, ImportedAnimationChannel } from '@/engine/assets/import/import-types';
import type { AnimationDocument } from '@/engine/core/animation/animation-document';
import { normalizeBoneName } from '@/engine/core/animation/bone-roles';
import { scaleTrackValues } from '@/engine/core/animation/track-editing';
import { matchJoint, translationScale } from '@/engine/animation/retarget';
import type { SkeletonTemplate } from '@/engine/character/rig/skeleton';
import { AnimationClip, type ClipOptions } from './animation-clip';
export function clipFromDocument(document: AnimationDocument, template: SkeletonTemplate, options: ClipOptions = {}): AnimationClip {
    const nodeByJoint = new Map<number, number>();
    for (const [nodeIndex, joint] of template.jointByNode)
        nodeByJoint.set(joint, nodeIndex);
    const scale = translationScale(document.skeleton, { names: template.names, bindPositions: template.bind.positions });
    const normalizedNames = template.names.map(normalizeBoneName);
    const channels: ImportedAnimationChannel[] = [];
    for (const track of document.tracks) {
        const joint = matchJoint(template.names, track.joint, normalizedNames);
        if (joint === -1)
            continue;
        const nodeIndex = nodeByJoint.get(joint);
        if (nodeIndex === undefined)
            continue;
        const values = track.path === 'translation' ? scaleTrackValues(track, scale).values : track.values;
        channels.push({ nodeIndex, path: track.path, interpolation: track.interpolation, times: track.times, values });
    }
    const animation: ImportedAnimation = { name: document.name, duration: document.duration, channels };
    return new AnimationClip(animation, template, { loop: document.loop, referenceSpeed: document.referenceSpeed, ...options });
}
