import type { AnimationDocument, AnimationPath, AnimationTrack } from '@/engine/core/animation/animation-document';
import { sampleTrack } from '@/engine/core/animation/track-sampling';
import type { Rig } from '@/engine/core/scene/rig';
import { Pose } from '@/engine/character/rig/pose';
import { translationScale } from './retarget';
interface BoundTrack {
    readonly joint: number;
    readonly path: AnimationPath;
    readonly track: AnimationTrack;
}
const sample = new Float32Array(4);
export class SkeletonClip {
    readonly name: string;
    readonly duration: number;
    readonly loop: boolean;
    readonly unresolvedJoints: readonly string[];
    readonly translationScale: number;
    private readonly tracks: BoundTrack[] = [];
    constructor(readonly document: AnimationDocument, readonly rig: Rig) {
        this.name = document.name;
        this.duration = Math.max(document.duration, 1e-3);
        this.loop = document.loop;
        this.translationScale = translationScale(document.skeleton, { names: rig.names, bindPositions: rig.bindPositions });
        const unresolved = new Set<string>();
        for (const track of document.tracks) {
            const joint = rig.jointByName(track.joint);
            if (joint === -1) {
                unresolved.add(track.joint);
                continue;
            }
            if (track.times.length === 0)
                continue;
            this.tracks.push({ joint, path: track.path, track });
        }
        this.unresolvedJoints = Array.from(unresolved);
    }
    get trackCount(): number {
        return this.tracks.length;
    }
    animates(joint: number): boolean {
        return this.tracks.some((bound) => bound.joint === joint);
    }
    wrap(time: number): number {
        const { duration } = this;
        if (!this.loop)
            return Math.min(Math.max(time, 0), duration);
        const wrapped = time % duration;
        return wrapped < 0 ? wrapped + duration : wrapped;
    }
    evaluate(time: number, out: Pose, wrapTime = true): void {
        out.positions.set(this.rig.bindPositions);
        out.rotations.set(this.rig.bindRotations);
        out.scales.set(this.rig.bindScales);
        this.evaluateOver(time, out, wrapTime);
    }
    evaluateOver(time: number, out: Pose, wrapTime = true): void {
        const t = wrapTime ? this.wrap(time) : time;
        for (const bound of this.tracks) {
            sampleTrack(bound.track, t, sample);
            switch (bound.path) {
                case 'translation': {
                    const target = out.position(bound.joint);
                    target[0] = sample[0] * this.translationScale;
                    target[1] = sample[1] * this.translationScale;
                    target[2] = sample[2] * this.translationScale;
                    break;
                }
                case 'rotation':
                    out.rotation(bound.joint).set(sample);
                    break;
                case 'scale':
                    out.scale(bound.joint).set(sample.subarray(0, 3));
                    break;
            }
        }
    }
    createPose(): Pose {
        return new Pose(this.rig.jointCount);
    }
}
