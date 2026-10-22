import * as quat from '@/engine/core/math/quat';
import type { AnimationTrack } from './animation-document';
export function trackComponents(track: Pick<AnimationTrack, 'path'>): number {
    return track.path === 'rotation' ? 4 : 3;
}
export function findKeyframe(times: Float32Array, time: number): number {
    let low = 0;
    let high = times.length - 1;
    if (high < 0 || time < times[0])
        return -1;
    if (time >= times[high])
        return high;
    while (low < high) {
        const mid = (low + high + 1) >> 1;
        if (times[mid] <= time)
            low = mid;
        else
            high = mid - 1;
    }
    return low;
}
function readKey(track: AnimationTrack, key: number, out: Float32Array): void {
    const components = trackComponents(track);
    const stride = track.interpolation === 'cubic' ? components * 3 : components;
    const offset = key * stride + (track.interpolation === 'cubic' ? components : 0);
    for (let i = 0; i < components; i++)
        out[i] = track.values[offset + i];
}
export function sampleTrack(track: AnimationTrack, time: number, out: Float32Array): Float32Array {
    const { times } = track;
    const components = trackComponents(track);
    if (times.length === 0) {
        if (track.path === 'rotation')
            quat.identity(out);
        else
            out.fill(track.path === 'scale' ? 1 : 0);
        return out;
    }
    const key = findKeyframe(times, time);
    if (key < 0) {
        readKey(track, 0, out);
        return out;
    }
    if (key >= times.length - 1 || track.interpolation === 'step') {
        readKey(track, key, out);
        return out;
    }
    const t0 = times[key];
    const t1 = times[key + 1];
    const span = t1 - t0;
    const t = span > 0 ? (time - t0) / span : 0;
    if (track.interpolation === 'cubic') {
        sampleCubic(track, key, t, span, components, out);
        if (track.path === 'rotation')
            quat.normalize(out, out);
        return out;
    }
    const a = scratchA.subarray(0, components);
    const b = scratchB.subarray(0, components);
    readKey(track, key, a);
    readKey(track, key + 1, b);
    if (track.path === 'rotation') {
        quat.nlerp(out, a, b, t);
        return out;
    }
    for (let i = 0; i < components; i++)
        out[i] = a[i] + (b[i] - a[i]) * t;
    return out;
}
const scratchA = new Float32Array(4);
const scratchB = new Float32Array(4);
function sampleCubic(track: AnimationTrack, key: number, t: number, span: number, components: number, out: Float32Array): void {
    const stride = components * 3;
    const base0 = key * stride;
    const base1 = (key + 1) * stride;
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    for (let i = 0; i < components; i++) {
        const p0 = track.values[base0 + components + i];
        const m0 = track.values[base0 + components * 2 + i] * span;
        const p1 = track.values[base1 + components + i];
        const m1 = track.values[base1 + i] * span;
        out[i] = h00 * p0 + h10 * m0 + h01 * p1 + h11 * m1;
    }
}
export function resampleTrack(track: AnimationTrack, duration: number, frameRate: number): AnimationTrack {
    const components = trackComponents(track);
    const frameCount = Math.max(1, Math.round(duration * frameRate) + 1);
    const times = new Float32Array(frameCount);
    const values = new Float32Array(frameCount * components);
    const sample = new Float32Array(components);
    for (let frame = 0; frame < frameCount; frame++) {
        const time = Math.min(frame / frameRate, duration);
        times[frame] = time;
        sampleTrack(track, time, sample);
        values.set(sample, frame * components);
    }
    return { joint: track.joint, path: track.path, interpolation: 'linear', times, values };
}
