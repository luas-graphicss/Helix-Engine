import * as quat from '@/engine/core/math/quat';
import { measureDuration, type AnimationDocument, type AnimationInterpolation, type AnimationPath, type AnimationTrack } from './animation-document';
import { sampleTrack, trackComponents } from './track-sampling';
export const KEY_TIME_EPSILON = 1e-4;
export interface KeyRef {
    readonly joint: string;
    readonly path: AnimationPath;
    readonly time: number;
}
export type KeyEasing = 'auto' | 'linear' | 'flat' | 'easeIn' | 'easeOut';
export const KEY_EASINGS: readonly KeyEasing[] = ['auto', 'linear', 'flat', 'easeIn', 'easeOut'];
export const KEY_EASING_LABELS: Record<KeyEasing, string> = {
    auto: 'Suave',
    linear: 'Linear',
    flat: 'Parada',
    easeIn: 'Chegar devagar',
    easeOut: 'Partir devagar',
};
export const INTERPOLATION_LABELS: Record<AnimationInterpolation, string> = {
    cubic: 'Curva suave',
    linear: 'Linear',
    step: 'Degrau',
};
export function keyRefKey(ref: KeyRef): string {
    return `${ref.joint}\u0000${ref.path}\u0000${ref.time.toFixed(4)}`;
}
export function sameKeyRef(a: KeyRef, b: KeyRef): boolean {
    return a.joint === b.joint && a.path === b.path && Math.abs(a.time - b.time) <= KEY_TIME_EPSILON;
}
function strideOf(track: AnimationTrack): number {
    const components = trackComponents(track);
    return track.interpolation === 'cubic' ? components * 3 : components;
}
function valueOffsetOf(track: AnimationTrack): number {
    return track.interpolation === 'cubic' ? trackComponents(track) : 0;
}
export function keyIndexAt(times: Float32Array, time: number, epsilon = KEY_TIME_EPSILON): number {
    let low = 0;
    let high = times.length - 1;
    while (low <= high) {
        const mid = (low + high) >> 1;
        const value = times[mid];
        if (Math.abs(value - time) <= epsilon)
            return mid;
        if (value < time)
            low = mid + 1;
        else
            high = mid - 1;
    }
    return -1;
}
export function insertionIndex(times: Float32Array, time: number): number {
    let low = 0;
    let high = times.length;
    while (low < high) {
        const mid = (low + high) >> 1;
        if (times[mid] <= time)
            low = mid + 1;
        else
            high = mid;
    }
    return low;
}
export function readKeyValue(track: AnimationTrack, index: number, out: Float32Array): Float32Array {
    const components = trackComponents(track);
    const offset = index * strideOf(track) + valueOffsetOf(track);
    for (let i = 0; i < components; i++)
        out[i] = track.values[offset + i];
    return out;
}
export function readKeyTangent(track: AnimationTrack, index: number, which: 'in' | 'out', out: Float32Array): Float32Array {
    const components = trackComponents(track);
    if (track.interpolation !== 'cubic')
        return out.fill(0, 0, components);
    const offset = index * strideOf(track) + (which === 'in' ? 0 : components * 2);
    for (let i = 0; i < components; i++)
        out[i] = track.values[offset + i];
    return out;
}
export function createTrack(joint: string, path: AnimationPath, interpolation: AnimationInterpolation = 'cubic'): AnimationTrack {
    return { joint, path, interpolation, times: new Float32Array(0), values: new Float32Array(0) };
}
function withData(track: AnimationTrack, times: Float32Array, values: Float32Array, interpolation = track.interpolation): AnimationTrack {
    return { joint: track.joint, path: track.path, interpolation, times, values };
}
interface KeyRecord {
    time: number;
    value: Float32Array;
    tangentIn: Float32Array;
    tangentOut: Float32Array;
}
function unpack(track: AnimationTrack): KeyRecord[] {
    const components = trackComponents(track);
    const records: KeyRecord[] = [];
    for (let index = 0; index < track.times.length; index++) {
        records.push({
            time: track.times[index],
            value: readKeyValue(track, index, new Float32Array(components)),
            tangentIn: readKeyTangent(track, index, 'in', new Float32Array(components)),
            tangentOut: readKeyTangent(track, index, 'out', new Float32Array(components)),
        });
    }
    return records;
}
function pack(track: AnimationTrack, records: KeyRecord[], interpolation = track.interpolation): AnimationTrack {
    const components = trackComponents(track);
    const stride = interpolation === 'cubic' ? components * 3 : components;
    const times = new Float32Array(records.length);
    const values = new Float32Array(records.length * stride);
    records.forEach((record, index) => {
        times[index] = record.time;
        const base = index * stride;
        if (interpolation === 'cubic') {
            values.set(record.tangentIn, base);
            values.set(record.value, base + components);
            values.set(record.tangentOut, base + components * 2);
        }
        else {
            values.set(record.value, base);
        }
    });
    return withData(track, times, values, interpolation);
}
function alignHemisphere(path: AnimationPath, value: Float32Array, reference: Float32Array | null): Float32Array {
    if (path !== 'rotation' || !reference)
        return value;
    if (quat.dot(value, reference) >= 0)
        return value;
    const flipped = new Float32Array(4);
    for (let i = 0; i < 4; i++)
        flipped[i] = -value[i];
    return flipped;
}
function autoTangent(records: KeyRecord[], index: number, components: number, out: Float32Array): Float32Array {
    const previous = records[index - 1];
    const next = records[index + 1];
    if (!previous || !next)
        return out.fill(0, 0, components);
    const span = next.time - previous.time;
    if (span <= 1e-6)
        return out.fill(0, 0, components);
    for (let i = 0; i < components; i++)
        out[i] = (next.value[i] - previous.value[i]) / span;
    return out;
}
function chordSlope(records: KeyRecord[], index: number, direction: 1 | -1, components: number, out: Float32Array): Float32Array {
    const other = records[index + direction];
    const self = records[index];
    if (!other)
        return out.fill(0, 0, components);
    const span = Math.abs(other.time - self.time);
    if (span <= 1e-6)
        return out.fill(0, 0, components);
    for (let i = 0; i < components; i++)
        out[i] = ((other.value[i] - self.value[i]) / span) * direction;
    return out;
}
function applyEasingToRecord(records: KeyRecord[], index: number, easing: KeyEasing, components: number): void {
    const record = records[index];
    switch (easing) {
        case 'auto':
            autoTangent(records, index, components, record.tangentIn);
            record.tangentOut.set(record.tangentIn);
            break;
        case 'linear':
            chordSlope(records, index, -1, components, record.tangentIn);
            chordSlope(records, index, 1, components, record.tangentOut);
            break;
        case 'flat':
            record.tangentIn.fill(0);
            record.tangentOut.fill(0);
            break;
        case 'easeIn':
            record.tangentIn.fill(0);
            autoTangent(records, index, components, record.tangentOut);
            break;
        case 'easeOut':
            autoTangent(records, index, components, record.tangentIn);
            record.tangentOut.fill(0);
            break;
    }
}
function autoTangentsAround(records: KeyRecord[], indices: Iterable<number>, components: number): void {
    const touched = new Set<number>();
    for (const index of indices)
        for (let i = index - 1; i <= index + 1; i++)
            if (i >= 0 && i < records.length)
                touched.add(i);
    for (const index of touched)
        applyEasingToRecord(records, index, 'auto', components);
}
export function setKey(track: AnimationTrack, time: number, value: Float32Array, epsilon = KEY_TIME_EPSILON): AnimationTrack {
    const components = trackComponents(track);
    const records = unpack(track);
    let index = keyIndexAt(track.times, time, epsilon);
    const neighbor = index !== -1 ? (records[index - 1] ?? records[index + 1] ?? null) : (records[insertionIndex(track.times, time) - 1] ?? records[insertionIndex(track.times, time)] ?? null);
    const aligned = alignHemisphere(track.path, value.slice(0, components), neighbor?.value ?? null);
    if (index !== -1) {
        records[index].value.set(aligned);
    }
    else {
        index = insertionIndex(track.times, time);
        records.splice(index, 0, { time, value: aligned, tangentIn: new Float32Array(components), tangentOut: new Float32Array(components) });
    }
    if (track.interpolation === 'cubic')
        autoTangentsAround(records, [index], components);
    return pack(track, records);
}
export function removeKeys(track: AnimationTrack, indices: Iterable<number>): AnimationTrack | null {
    const removed = new Set(indices);
    const records = unpack(track).filter((_, index) => !removed.has(index));
    if (records.length === 0)
        return null;
    const components = trackComponents(track);
    if (track.interpolation === 'cubic') {
        const survivors: number[] = [];
        let shift = 0;
        for (let index = 0; index < track.times.length; index++) {
            if (removed.has(index))
                shift++;
            else if (removed.has(index - 1) || removed.has(index + 1))
                survivors.push(index - shift);
        }
        autoTangentsAround(records, survivors, components);
    }
    return pack(track, records);
}
export function moveKeys(track: AnimationTrack, indices: Iterable<number>, delta: number, maxTime = Infinity, epsilon = KEY_TIME_EPSILON): AnimationTrack {
    const moving = new Set(indices);
    if (moving.size === 0 || delta === 0)
        return track;
    const records = unpack(track);
    const moved: KeyRecord[] = [];
    const still: KeyRecord[] = [];
    records.forEach((record, index) => {
        if (moving.has(index)) {
            record.time = Math.min(Math.max(record.time + delta, 0), maxTime);
            moved.push(record);
        }
        else {
            still.push(record);
        }
    });
    const kept = still.filter((record) => !moved.some((other) => Math.abs(other.time - record.time) <= epsilon));
    const merged = [...kept, ...moved].sort((a, b) => a.time - b.time);
    const unique: KeyRecord[] = [];
    for (const record of merged) {
        const last = unique[unique.length - 1];
        if (last && Math.abs(last.time - record.time) <= epsilon)
            unique[unique.length - 1] = record;
        else
            unique.push(record);
    }
    return pack(track, unique);
}
export function setInterpolation(track: AnimationTrack, interpolation: AnimationInterpolation): AnimationTrack {
    if (track.interpolation === interpolation)
        return track;
    const components = trackComponents(track);
    const records = unpack(track);
    if (interpolation === 'cubic')
        records.forEach((_, index) => applyEasingToRecord(records, index, 'auto', components));
    return pack(track, records, interpolation);
}
export function applyEasing(track: AnimationTrack, indices: Iterable<number>, easing: KeyEasing): AnimationTrack {
    const components = trackComponents(track);
    const cubic = track.interpolation === 'cubic' ? track : setInterpolation(track, 'cubic');
    const records = unpack(cubic);
    for (const index of indices)
        if (index >= 0 && index < records.length)
            applyEasingToRecord(records, index, easing, components);
    return pack(cubic, records);
}
export function scaleTrackValues(track: AnimationTrack, factor: number): AnimationTrack {
    if (factor === 1)
        return track;
    const values = new Float32Array(track.values.length);
    for (let i = 0; i < values.length; i++)
        values[i] = track.values[i] * factor;
    return withData(track, track.times, values);
}
export function trackAt(document: AnimationDocument, joint: string, path: AnimationPath): AnimationTrack | undefined {
    return document.tracks.find((track) => track.joint === joint && track.path === path);
}
export function replaceTrack(document: AnimationDocument, joint: string, path: AnimationPath, track: AnimationTrack | null): AnimationDocument {
    const index = document.tracks.findIndex((candidate) => candidate.joint === joint && candidate.path === path);
    const tracks = [...document.tracks];
    if (index !== -1) {
        if (track)
            tracks[index] = track;
        else
            tracks.splice(index, 1);
    }
    else if (track) {
        let insertAt = tracks.length;
        for (let i = tracks.length - 1; i >= 0; i--) {
            if (tracks[i].joint === joint) {
                insertAt = i + 1;
                break;
            }
        }
        tracks.splice(insertAt, 0, track);
    }
    return { ...document, tracks };
}
export function setDocumentKey(document: AnimationDocument, joint: string, path: AnimationPath, time: number, value: Float32Array, interpolation: AnimationInterpolation = 'cubic'): AnimationDocument {
    const track = trackAt(document, joint, path) ?? createTrack(joint, path, interpolation);
    const next = replaceTrack(document, joint, path, setKey(track, time, value));
    return time > next.duration ? { ...next, duration: time } : next;
}
function groupRefs(refs: Iterable<KeyRef>): Map<string, {
    joint: string;
    path: AnimationPath;
    times: number[];
}> {
    const groups = new Map<string, {
        joint: string;
        path: AnimationPath;
        times: number[];
    }>();
    for (const ref of refs) {
        const key = `${ref.joint}\u0000${ref.path}`;
        const group = groups.get(key);
        if (group)
            group.times.push(ref.time);
        else
            groups.set(key, { joint: ref.joint, path: ref.path, times: [ref.time] });
    }
    return groups;
}
function indicesOf(track: AnimationTrack, times: readonly number[]): number[] {
    const indices: number[] = [];
    for (const time of times) {
        const index = keyIndexAt(track.times, time);
        if (index !== -1)
            indices.push(index);
    }
    return indices;
}
export function removeDocumentKeys(document: AnimationDocument, refs: Iterable<KeyRef>): AnimationDocument {
    let next = document;
    for (const group of groupRefs(refs).values()) {
        const track = trackAt(next, group.joint, group.path);
        if (!track)
            continue;
        next = replaceTrack(next, group.joint, group.path, removeKeys(track, indicesOf(track, group.times)));
    }
    return next;
}
export function moveDocumentKeys(document: AnimationDocument, refs: readonly KeyRef[], delta: number): {
    document: AnimationDocument;
    refs: KeyRef[];
} {
    if (delta === 0)
        return { document, refs: [...refs] };
    let next = document;
    const moved: KeyRef[] = [];
    for (const group of groupRefs(refs).values()) {
        const track = trackAt(next, group.joint, group.path);
        if (!track)
            continue;
        next = replaceTrack(next, group.joint, group.path, moveKeys(track, indicesOf(track, group.times), delta));
        for (const time of group.times)
            moved.push({ joint: group.joint, path: group.path, time: Math.max(time + delta, 0) });
    }
    const duration = Math.max(next.duration, measureDuration(next.tracks));
    return { document: duration !== next.duration ? { ...next, duration } : next, refs: moved };
}
export function easeDocumentKeys(document: AnimationDocument, refs: Iterable<KeyRef>, easing: KeyEasing): AnimationDocument {
    let next = document;
    for (const group of groupRefs(refs).values()) {
        const track = trackAt(next, group.joint, group.path);
        if (!track)
            continue;
        next = replaceTrack(next, group.joint, group.path, applyEasing(track, indicesOf(track, group.times), easing));
    }
    return next;
}
export function setDocumentInterpolation(document: AnimationDocument, tracks: Iterable<{
    joint: string;
    path: AnimationPath;
}>, interpolation: AnimationInterpolation): AnimationDocument {
    let next = document;
    for (const target of tracks) {
        const track = trackAt(next, target.joint, target.path);
        if (track)
            next = replaceTrack(next, target.joint, target.path, setInterpolation(track, interpolation));
    }
    return next;
}
export function setDocumentKeyValue(document: AnimationDocument, ref: KeyRef, value: Float32Array): AnimationDocument {
    const track = trackAt(document, ref.joint, ref.path);
    if (!track || keyIndexAt(track.times, ref.time) === -1)
        return document;
    return replaceTrack(document, ref.joint, ref.path, setKey(track, ref.time, value));
}
export function keysInRange(document: AnimationDocument, start: number, end: number, joints?: ReadonlySet<string>): KeyRef[] {
    const refs: KeyRef[] = [];
    const low = Math.min(start, end) - KEY_TIME_EPSILON;
    const high = Math.max(start, end) + KEY_TIME_EPSILON;
    for (const track of document.tracks) {
        if (joints && !joints.has(track.joint))
            continue;
        for (let index = 0; index < track.times.length; index++) {
            const time = track.times[index];
            if (time >= low && time <= high)
                refs.push({ joint: track.joint, path: track.path, time });
        }
    }
    return refs;
}
export function keysAtTime(document: AnimationDocument, time: number, epsilon = KEY_TIME_EPSILON): KeyRef[] {
    return keysInRange(document, time - epsilon, time + epsilon);
}
export function keyTimes(document: AnimationDocument, joints?: ReadonlySet<string>): number[] {
    const seen = new Set<number>();
    for (const track of document.tracks) {
        if (joints && !joints.has(track.joint))
            continue;
        for (let index = 0; index < track.times.length; index++)
            seen.add(Math.round(track.times[index] / KEY_TIME_EPSILON) * KEY_TIME_EPSILON);
    }
    return Array.from(seen).sort((a, b) => a - b);
}
export function adjacentKeyTime(document: AnimationDocument, time: number, direction: 1 | -1): number | null {
    let best: number | null = null;
    for (const track of document.tracks) {
        for (let index = 0; index < track.times.length; index++) {
            const candidate = track.times[index];
            if (direction === 1 ? candidate > time + KEY_TIME_EPSILON : candidate < time - KEY_TIME_EPSILON) {
                if (best === null || (direction === 1 ? candidate < best : candidate > best))
                    best = candidate;
            }
        }
    }
    return best;
}
export function animatedJoints(document: AnimationDocument): string[] {
    const joints: string[] = [];
    for (const track of document.tracks)
        if (!joints.includes(track.joint))
            joints.push(track.joint);
    return joints;
}
export interface KeyClipboard {
    readonly entries: ReadonlyArray<{
        joint: string;
        path: AnimationPath;
        offset: number;
        value: Float32Array;
    }>;
    readonly span: number;
}
export function copyDocumentKeys(document: AnimationDocument, refs: Iterable<KeyRef>): KeyClipboard | null {
    const entries: Array<{
        joint: string;
        path: AnimationPath;
        offset: number;
        value: Float32Array;
    }> = [];
    let first = Infinity;
    let last = -Infinity;
    for (const group of groupRefs(refs).values()) {
        const track = trackAt(document, group.joint, group.path);
        if (!track)
            continue;
        for (const index of indicesOf(track, group.times)) {
            const time = track.times[index];
            first = Math.min(first, time);
            last = Math.max(last, time);
            entries.push({ joint: group.joint, path: group.path, offset: time, value: readKeyValue(track, index, new Float32Array(trackComponents(track))) });
        }
    }
    if (entries.length === 0)
        return null;
    for (const entry of entries)
        entry.offset -= first;
    return { entries, span: last - first };
}
export function pasteDocumentKeys(document: AnimationDocument, clipboard: KeyClipboard, time: number): {
    document: AnimationDocument;
    refs: KeyRef[];
} {
    let next = document;
    const refs: KeyRef[] = [];
    for (const entry of clipboard.entries) {
        const at = time + entry.offset;
        next = setDocumentKey(next, entry.joint, entry.path, at, entry.value, trackAt(next, entry.joint, entry.path)?.interpolation ?? 'cubic');
        refs.push({ joint: entry.joint, path: entry.path, time: at });
    }
    return { document: next, refs };
}
export function sampleDocumentPath(document: AnimationDocument, joint: string, path: AnimationPath, time: number, out: Float32Array): Float32Array | null {
    const track = trackAt(document, joint, path);
    return track ? sampleTrack(track, time, out) : null;
}
export function setDocumentDuration(document: AnimationDocument, duration: number): AnimationDocument {
    const clamped = Math.max(1 / 120, duration);
    return clamped === document.duration ? document : { ...document, duration: clamped };
}
export function stretchDocument(document: AnimationDocument, factor: number): AnimationDocument {
    if (!(factor > 0) || factor === 1)
        return document;
    const tracks = document.tracks.map((track) => {
        const times = new Float32Array(track.times.length);
        for (let i = 0; i < times.length; i++)
            times[i] = track.times[i] * factor;
        if (track.interpolation !== 'cubic')
            return withData(track, times, track.values);
        const components = trackComponents(track);
        const stride = components * 3;
        const values = new Float32Array(track.values.length);
        for (let key = 0; key < times.length; key++) {
            const base = key * stride;
            for (let i = 0; i < components; i++) {
                values[base + i] = track.values[base + i] / factor;
                values[base + components + i] = track.values[base + components + i];
                values[base + components * 2 + i] = track.values[base + components * 2 + i] / factor;
            }
        }
        return withData(track, times, values);
    });
    return {
        ...document,
        tracks,
        duration: document.duration * factor,
        events: document.events.map((event) => ({ ...event, time: event.time * factor })),
    };
}
export function createEmptyDocument(name: string, options: {
    frameRate?: number;
    duration?: number;
    loop?: boolean;
} = {}): AnimationDocument {
    return {
        name,
        duration: options.duration ?? 2,
        loop: options.loop ?? true,
        frameRate: options.frameRate ?? 30,
        referenceSpeed: 0,
        tracks: [],
        skeleton: null,
        events: [],
        source: null,
        createdAt: Date.now(),
    };
}
