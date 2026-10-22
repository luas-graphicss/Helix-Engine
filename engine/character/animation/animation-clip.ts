import * as quat from '@/engine/core/math/quat';
import type { ImportedAnimation, ImportedInterpolation } from '@/engine/assets/import/import-types';
import type { SkeletonTemplate } from '@/engine/character/rig/skeleton';
import type { Pose } from '@/engine/character/rig/pose';
export interface ClipOptions {
    name?: string;
    loop?: boolean;
    referenceSpeed?: number;
}
type TrackPath = 0 | 1 | 2;
const PATH_POSITION: TrackPath = 0;
const PATH_ROTATION: TrackPath = 1;
const PATH_SCALE: TrackPath = 2;
const PATH_INDEX: Record<string, TrackPath> = { translation: PATH_POSITION, rotation: PATH_ROTATION, scale: PATH_SCALE };
interface CompiledTrack {
    readonly joint: number;
    readonly path: TrackPath;
    readonly interpolation: ImportedInterpolation;
    readonly components: 3 | 4;
    readonly times: Float32Array;
    readonly values: Float32Array;
}
const scratchA = new Float32Array(4);
const scratchB = new Float32Array(4);
export class AnimationClip {
    readonly name: string;
    readonly duration: number;
    readonly loop: boolean;
    readonly referenceSpeed: number;
    private readonly tracks: CompiledTrack[] = [];
    constructor(animation: ImportedAnimation, private readonly template: SkeletonTemplate, options: ClipOptions = {}) {
        this.name = options.name ?? animation.name;
        this.duration = Math.max(animation.duration, 1e-3);
        this.loop = options.loop ?? true;
        this.referenceSpeed = options.referenceSpeed ?? 0;
        for (const channel of animation.channels) {
            const joint = template.jointByNode.get(channel.nodeIndex);
            if (joint === undefined || channel.times.length === 0)
                continue;
            const path = PATH_INDEX[channel.path];
            const components = path === PATH_ROTATION ? 4 : 3;
            const perKey = channel.interpolation === 'cubic' ? components * 3 : components;
            if (channel.values.length < channel.times.length * perKey)
                continue;
            this.tracks.push({ joint, path, interpolation: channel.interpolation, components, times: channel.times, values: channel.values });
        }
    }
    evaluate(time: number, out: Pose): void {
        out.copy(this.template.bind);
        const t = this.wrap(time);
        for (const track of this.tracks) {
            const target = track.path === PATH_POSITION ? out.position(track.joint) : track.path === PATH_ROTATION ? out.rotation(track.joint) : out.scale(track.joint);
            this.sample(track, t, target);
        }
    }
    evaluatePhase(phase: number, out: Pose): void {
        this.evaluate(phase * this.duration, out);
    }
    private wrap(time: number): number {
        const { duration } = this;
        if (!this.loop)
            return Math.min(Math.max(time, 0), duration);
        const wrapped = time % duration;
        return wrapped < 0 ? wrapped + duration : wrapped;
    }
    private sample(track: CompiledTrack, t: number, out: Float32Array): void {
        const { times, values, components, interpolation } = track;
        const count = times.length;
        const stride = interpolation === 'cubic' ? components * 3 : components;
        const valueOffset = interpolation === 'cubic' ? components : 0;
        if (t <= times[0] || count === 1) {
            copyKey(out, values, valueOffset, components);
            return;
        }
        if (t >= times[count - 1]) {
            copyKey(out, values, (count - 1) * stride + valueOffset, components);
            return;
        }
        let low = 0;
        let high = count - 1;
        while (high - low > 1) {
            const middle = (low + high) >> 1;
            if (times[middle] <= t)
                low = middle;
            else
                high = middle;
        }
        const span = times[high] - times[low];
        const u = span > 0 ? (t - times[low]) / span : 0;
        const a = low * stride + valueOffset;
        const b = high * stride + valueOffset;
        if (interpolation === 'step') {
            copyKey(out, values, a, components);
            return;
        }
        if (interpolation === 'cubic') {
            cubicSpline(out, values, low, high, stride, components, u, span);
            if (components === 4)
                quat.normalize(out, out);
            return;
        }
        if (components === 4) {
            copyKey(scratchA, values, a, 4);
            copyKey(scratchB, values, b, 4);
            quat.nlerp(out, scratchA, scratchB, u);
            return;
        }
        for (let c = 0; c < 3; c++)
            out[c] = values[a + c] + (values[b + c] - values[a + c]) * u;
    }
}
function copyKey(out: Float32Array, values: Float32Array, offset: number, components: number): void {
    for (let c = 0; c < components; c++)
        out[c] = values[offset + c];
}
function cubicSpline(out: Float32Array, values: Float32Array, low: number, high: number, stride: number, components: number, u: number, span: number): void {
    const u2 = u * u;
    const u3 = u2 * u;
    const h00 = 2 * u3 - 3 * u2 + 1;
    const h10 = u3 - 2 * u2 + u;
    const h01 = -2 * u3 + 3 * u2;
    const h11 = u3 - u2;
    const p0 = low * stride + components;
    const m0 = low * stride + components * 2;
    const p1 = high * stride + components;
    const m1 = high * stride;
    for (let c = 0; c < components; c++) {
        out[c] = h00 * values[p0 + c] + h10 * span * values[m0 + c] + h01 * values[p1 + c] + h11 * span * values[m1 + c];
    }
}
