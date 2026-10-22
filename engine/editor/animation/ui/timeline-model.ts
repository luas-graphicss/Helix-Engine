import * as quat from '@/engine/core/math/quat';
import * as vec3 from '@/engine/core/math/vec3';
import { ANIMATION_PATHS, type AnimationDocument, type AnimationInterpolation, type AnimationPath, type AnimationTrack } from '@/engine/core/animation/animation-document';
import { keysAtTime, readKeyValue, trackAt, type KeyRef } from '@/engine/core/animation/track-editing';
import type { AnimationEditor } from '../animation-editor';
export const ROW_HEIGHT = 20;
export const RULER_HEIGHT = 22;
export const TIME_PAD_LEFT = 10;
export const TIME_PAD_RIGHT = 14;
export const KEY_HIT_RADIUS = 6;
export const DRAG_THRESHOLD_PX = 3;
export const PATH_LABELS: Record<AnimationPath, string> = { translation: 'Translação', rotation: 'Rotação', scale: 'Escala' };
export const PATH_SHORT_LABELS: Record<AnimationPath, string> = { translation: 'Pos', rotation: 'Rot', scale: 'Esc' };
export const COMPONENT_LABELS = ['X', 'Y', 'Z'] as const;
export interface BoneRow {
    readonly kind: 'bone';
    readonly id: string;
    readonly name: string;
    readonly depth: number;
    readonly hasChildren: boolean;
    readonly collapsed: boolean;
    readonly animated: boolean;
    readonly selected: boolean;
    readonly keyTimes: readonly number[];
}
export interface TrackRow {
    readonly kind: 'track';
    readonly id: string;
    readonly joint: string;
    readonly path: AnimationPath;
    readonly depth: number;
    readonly keyTimes: readonly number[];
    readonly interpolation: AnimationInterpolation;
}
export type TimelineRow = BoneRow | TrackRow;
function unionTimes(tracks: readonly AnimationTrack[]): number[] {
    if (tracks.length === 1)
        return Array.from(tracks[0].times);
    const times = new Set<number>();
    for (const track of tracks)
        for (const time of track.times)
            times.add(time);
    return Array.from(times).sort((a, b) => a - b);
}
export function buildTimelineRows(editor: AnimationEditor): TimelineRow[] {
    const { rig, document } = editor;
    if (!rig || !document)
        return [];
    const filter = editor.boneFilter.trim().toLowerCase();
    const flat = filter.length > 0 || editor.onlyAnimated;
    const tracksByJoint = new Map<string, AnimationTrack[]>();
    for (const track of document.tracks) {
        const list = tracksByJoint.get(track.joint);
        if (list)
            list.push(track);
        else
            tracksByJoint.set(track.joint, [track]);
    }
    const selected = new Set(editor.selectedBones);
    const rows: TimelineRow[] = [];
    const pushBone = (index: number, depth: number) => {
        const name = rig.names[index];
        const tracks = tracksByJoint.get(name) ?? [];
        rows.push({
            kind: 'bone',
            id: `bone:${name}`,
            name,
            depth,
            hasChildren: !flat && rig.childrenOf(index).length > 0,
            collapsed: editor.collapsedBones.has(name),
            animated: tracks.length > 0,
            selected: selected.has(name),
            keyTimes: unionTimes(tracks),
        });
        if (!selected.has(name))
            return;
        for (const path of ANIMATION_PATHS) {
            const track = trackAt(document, name, path);
            if (track)
                rows.push({ kind: 'track', id: `track:${name}/${path}`, joint: name, path, depth: depth + 1, keyTimes: Array.from(track.times), interpolation: track.interpolation });
        }
    };
    const visit = (index: number, depth: number) => {
        const name = rig.names[index];
        if (flat) {
            const matches = (filter.length === 0 || name.toLowerCase().includes(filter)) && (!editor.onlyAnimated || tracksByJoint.has(name));
            if (matches)
                pushBone(index, 0);
            for (const child of rig.childrenOf(index))
                visit(child, 0);
            return;
        }
        pushBone(index, depth);
        if (editor.collapsedBones.has(name))
            return;
        for (const child of rig.childrenOf(index))
            visit(child, depth + 1);
    };
    for (const root of rig.rootJoints())
        visit(root, 0);
    return rows;
}
export function rowKeyRefs(document: AnimationDocument, row: TimelineRow, time: number): KeyRef[] {
    if (row.kind === 'track')
        return [{ joint: row.joint, path: row.path, time }];
    return keysAtTime(document, time).filter((ref) => ref.joint === row.name);
}
export function rowJoint(row: TimelineRow): string {
    return row.kind === 'bone' ? row.name : row.joint;
}
export function timeSpan(width: number): number {
    return Math.max(1, width - TIME_PAD_LEFT - TIME_PAD_RIGHT);
}
export function timeToX(time: number, duration: number, width: number): number {
    return TIME_PAD_LEFT + (duration > 0 ? time / duration : 0) * timeSpan(width);
}
export function xToTime(x: number, duration: number, width: number): number {
    return ((x - TIME_PAD_LEFT) / timeSpan(width)) * duration;
}
export interface RulerTick {
    readonly time: number;
    readonly frame: number;
    readonly major: boolean;
}
const FRAME_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800];
const MIN_LABEL_SPACING_PX = 56;
const MIN_MINOR_SPACING_PX = 6;
export function rulerTicks(duration: number, frameRate: number, width: number): RulerTick[] {
    const frames = Math.max(1, Math.round(duration * frameRate));
    const pxPerFrame = timeSpan(width) / frames;
    const major = FRAME_STEPS.find((step) => step * pxPerFrame >= MIN_LABEL_SPACING_PX) ?? FRAME_STEPS[FRAME_STEPS.length - 1];
    const minor = major === 1 ? 0 : FRAME_STEPS.filter((step) => step < major && major % step === 0 && step * pxPerFrame >= MIN_MINOR_SPACING_PX).pop() ?? 0;
    const ticks: RulerTick[] = [];
    const step = minor || major;
    for (let frame = 0; frame <= frames; frame += step) {
        ticks.push({ time: frame / frameRate, frame, major: frame % major === 0 });
    }
    return ticks;
}
export function formatSeconds(time: number): string {
    return `${time.toFixed(2)} s`;
}
export function formatFrame(time: number, frameRate: number): string {
    return String(Math.round(time * frameRate));
}
const scratchQuat = quat.create();
const scratchEuler = vec3.create();
export function keyDisplayValue(track: AnimationTrack, index: number, out = new Float32Array(3)): Float32Array {
    if (track.path !== 'rotation')
        return readKeyValue(track, index, out);
    readKeyValue(track, index, scratchQuat);
    quat.toEulerDegrees(scratchEuler, scratchQuat);
    out[0] = scratchEuler[0];
    out[1] = scratchEuler[1];
    out[2] = scratchEuler[2];
    return out;
}
export function rawValueFromDisplay(path: AnimationPath, display: Float32Array, out?: Float32Array): Float32Array {
    if (path !== 'rotation') {
        const result = out ?? new Float32Array(3);
        result.set(display.subarray(0, 3));
        return result;
    }
    const result = out ?? new Float32Array(4);
    vec3.set(scratchEuler, display[0], display[1], display[2]);
    quat.fromEulerDegrees(scratchQuat, scratchEuler);
    result.set(scratchQuat);
    return result;
}
export function displayFromSample(path: AnimationPath, sample: Float32Array, out: Float32Array): Float32Array {
    if (path !== 'rotation') {
        out[0] = sample[0];
        out[1] = sample[1];
        out[2] = sample[2];
        return out;
    }
    quat.toEulerDegrees(scratchEuler, sample);
    out[0] = scratchEuler[0];
    out[1] = scratchEuler[1];
    out[2] = scratchEuler[2];
    return out;
}
export function displayUnit(path: AnimationPath): string {
    return path === 'rotation' ? '°' : path === 'translation' ? 'm' : '×';
}
export function formatDisplayValue(path: AnimationPath, value: number): string {
    if (path === 'rotation')
        return `${value.toFixed(1)}°`;
    if (path === 'translation')
        return `${value.toFixed(3)} m`;
    return `${value.toFixed(3)}×`;
}
