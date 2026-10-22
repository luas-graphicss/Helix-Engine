import * as quat from '@/engine/core/math/quat';
import * as vec3 from '@/engine/core/math/vec3';
import type { AnimationDocument, AnimationTrack } from './animation-document';
import { measureDuration } from './animation-document';
import { sampleTrack } from './track-sampling';
export const BVH_EXTENSION = 'bvh';
type Axis = 0 | 1 | 2;
interface BvhChannel {
    readonly kind: 'position' | 'rotation';
    readonly axis: Axis;
}
interface BvhJoint {
    readonly name: string;
    readonly parent: number;
    readonly offset: Float32Array;
    readonly channels: BvhChannel[];
    channelStart: number;
}
const AXIS_INDEX: Record<string, Axis> = { x: 0, y: 1, z: 2 };
const AXES: readonly Float32Array[] = [vec3.create(1, 0, 0), vec3.create(0, 1, 0), vec3.create(0, 0, 1)];
const CENTIMETER_HEIGHT_THRESHOLD = 10;
function parseChannel(token: string): BvhChannel {
    const match = /^([xyz])(position|rotation)$/i.exec(token);
    if (!match)
        throw new Error(`Canal BVH desconhecido: "${token}".`);
    return { kind: match[2].toLowerCase() as BvhChannel['kind'], axis: AXIS_INDEX[match[1].toLowerCase()] };
}
interface ParsedHierarchy {
    joints: BvhJoint[];
    channelCount: number;
    nextToken: number;
}
function parseHierarchy(tokens: string[]): ParsedHierarchy {
    const joints: BvhJoint[] = [];
    let position = 0;
    let channelCount = 0;
    const expect = (value: string) => {
        if (tokens[position] !== value)
            throw new Error(`BVH: esperado "${value}", encontrado "${tokens[position] ?? 'fim do arquivo'}".`);
        position++;
    };
    const readNumber = (): number => {
        const value = Number(tokens[position++]);
        if (!Number.isFinite(value))
            throw new Error(`BVH: número inválido "${tokens[position - 1]}".`);
        return value;
    };
    const parseJoint = (parent: number): void => {
        const keyword = tokens[position];
        if (keyword !== 'ROOT' && keyword !== 'JOINT')
            throw new Error(`BVH: esperado ROOT ou JOINT, encontrado "${keyword}".`);
        position++;
        const name = tokens[position++];
        expect('{');
        expect('OFFSET');
        const offset = vec3.create(readNumber(), readNumber(), readNumber());
        const joint: BvhJoint = { name, parent, offset, channels: [], channelStart: channelCount };
        const index = joints.push(joint) - 1;
        if (tokens[position] === 'CHANNELS') {
            position++;
            const count = readNumber();
            for (let i = 0; i < count; i++)
                joint.channels.push(parseChannel(tokens[position++]));
            channelCount += count;
        }
        while (tokens[position] !== '}') {
            if (tokens[position] === 'End' && tokens[position + 1] === 'Site') {
                position += 2;
                expect('{');
                expect('OFFSET');
                readNumber();
                readNumber();
                readNumber();
                expect('}');
            }
            else {
                parseJoint(index);
            }
        }
        expect('}');
    };
    expect('HIERARCHY');
    while (tokens[position] === 'ROOT')
        parseJoint(-1);
    if (joints.length === 0)
        throw new Error('BVH sem ROOT.');
    return { joints, channelCount, nextToken: position };
}
function skeletonExtent(joints: readonly BvhJoint[]): number {
    const world = joints.map(() => vec3.create());
    let min = Infinity;
    let max = -Infinity;
    joints.forEach((joint, index) => {
        if (joint.parent === -1)
            vec3.copy(world[index], joint.offset);
        else
            vec3.add(world[index], world[joint.parent], joint.offset);
        min = Math.min(min, world[index][1]);
        max = Math.max(max, world[index][1]);
    });
    return Number.isFinite(max - min) ? max - min : 0;
}
export interface BvhParseOptions {
    metersPerUnit?: number;
    name?: string;
    sourceFile?: string;
}
export function parseBvh(text: string, options: BvhParseOptions = {}): AnimationDocument {
    const motionAt = text.indexOf('MOTION');
    if (motionAt === -1)
        throw new Error('BVH sem seção MOTION.');
    const hierarchyTokens = text.slice(0, motionAt).split(/\s+/).filter(Boolean);
    const { joints, channelCount } = parseHierarchy(hierarchyTokens);
    const motion = text.slice(motionAt + 'MOTION'.length);
    const framesMatch = /Frames:\s*(\d+)/i.exec(motion);
    const frameTimeMatch = /Frame Time:\s*([\d.eE+-]+)/i.exec(motion);
    if (!framesMatch || !frameTimeMatch)
        throw new Error('BVH sem "Frames:" ou "Frame Time:".');
    const frameCount = Number(framesMatch[1]);
    const frameTime = Number(frameTimeMatch[1]);
    if (!(frameCount > 0) || !(frameTime > 0))
        throw new Error('BVH com contagem de quadros ou tempo de quadro inválidos.');
    const dataStart = motion.indexOf('\n', frameTimeMatch.index) + 1;
    const values = motion
        .slice(dataStart)
        .split(/\s+/)
        .filter(Boolean)
        .map(Number);
    if (values.length < frameCount * channelCount)
        throw new Error(`BVH com ${values.length} valores para ${frameCount} quadros × ${channelCount} canais.`);
    const scale = options.metersPerUnit ?? (skeletonExtent(joints) > CENTIMETER_HEIGHT_THRESHOLD ? 0.01 : 1);
    const times = new Float32Array(frameCount);
    for (let frame = 0; frame < frameCount; frame++)
        times[frame] = frame * frameTime;
    const tracks: AnimationTrack[] = [];
    const rotation = quat.create();
    const step = quat.create();
    const bindPositions = new Float32Array(joints.length * 3);
    const bindRotations = new Float32Array(joints.length * 4);
    const bindScales = new Float32Array(joints.length * 3).fill(1);
    const current = vec3.create();
    joints.forEach((joint, index) => {
        const hasPosition = joint.channels.some((channel) => channel.kind === 'position');
        const hasRotation = joint.channels.some((channel) => channel.kind === 'rotation');
        const positions = hasPosition ? new Float32Array(frameCount * 3) : null;
        const rotations = hasRotation ? new Float32Array(frameCount * 4) : null;
        for (let frame = 0; frame < frameCount; frame++) {
            const base = frame * channelCount + joint.channelStart;
            quat.identity(rotation);
            vec3.copy(current, joint.offset);
            joint.channels.forEach((channel, position) => {
                const value = values[base + position];
                if (channel.kind === 'position') {
                    current[channel.axis] = value;
                }
                else {
                    quat.fromAxisAngle(step, AXES[channel.axis], (value * Math.PI) / 180);
                    quat.multiply(rotation, rotation, step);
                }
            });
            if (positions) {
                positions[frame * 3] = current[0] * scale;
                positions[frame * 3 + 1] = current[1] * scale;
                positions[frame * 3 + 2] = current[2] * scale;
            }
            if (rotations)
                rotations.set(rotation, frame * 4);
        }
        if (positions)
            tracks.push({ joint: joint.name, path: 'translation', interpolation: 'linear', times, values: positions });
        if (rotations)
            tracks.push({ joint: joint.name, path: 'rotation', interpolation: 'linear', times, values: rotations });
        const offsetIsZero = joint.offset[0] === 0 && joint.offset[1] === 0 && joint.offset[2] === 0;
        if (positions && offsetIsZero)
            bindPositions.set(positions.subarray(0, 3), index * 3);
        else {
            bindPositions[index * 3] = joint.offset[0] * scale;
            bindPositions[index * 3 + 1] = joint.offset[1] * scale;
            bindPositions[index * 3 + 2] = joint.offset[2] * scale;
        }
        bindRotations[index * 4 + 3] = 1;
    });
    return {
        name: options.name ?? joints[0].name,
        duration: Math.max((frameCount - 1) * frameTime, measureDuration(tracks)),
        loop: true,
        frameRate: Math.round((1 / frameTime) * 100) / 100,
        referenceSpeed: 0,
        tracks,
        skeleton: { names: joints.map((joint) => joint.name), parents: joints.map((joint) => joint.parent), bindPositions, bindRotations, bindScales },
        events: [],
        source: { file: options.sourceFile ?? '', format: BVH_EXTENSION },
        createdAt: Date.now(),
    };
}
function quatToEulerZXY(q: Float32Array): [
    number,
    number,
    number
] {
    const [x, y, z, w] = q;
    const r01 = 2 * (x * y - w * z);
    const r11 = 1 - 2 * (x * x + z * z);
    const r20 = 2 * (x * z - w * y);
    const r21 = 2 * (y * z + w * x);
    const r22 = 1 - 2 * (x * x + y * y);
    const a = Math.asin(Math.max(-1, Math.min(1, r21)));
    const nearGimbal = Math.abs(r21) > 0.99999;
    const b = nearGimbal ? 0 : Math.atan2(-r20, r22);
    const c = nearGimbal ? Math.atan2(2 * (x * y + w * z), 1 - 2 * (y * y + z * z)) : Math.atan2(-r01, r11);
    const deg = 180 / Math.PI;
    return [c * deg, a * deg, b * deg];
}
export interface BvhWriteOptions {
    frameRate?: number;
    unitScale?: number;
}
function formatNumber(value: number): string {
    const text = value.toFixed(6);
    return text === '-0.000000' ? '0.000000' : text;
}
export function writeBvh(document: AnimationDocument, options: BvhWriteOptions = {}): string {
    const { skeleton } = document;
    if (!skeleton)
        throw new Error('A animação não traz esqueleto; o BVH precisa da hierarquia de ossos.');
    const jointCount = skeleton.names.length;
    const unitScale = options.unitScale ?? 1;
    const frameRate = options.frameRate ?? document.frameRate ?? 30;
    const frameTime = 1 / frameRate;
    const frameCount = Math.max(1, Math.round(document.duration * frameRate) + 1);
    const children = skeleton.names.map(() => [] as number[]);
    const roots: number[] = [];
    skeleton.parents.forEach((parent, joint) => (parent === -1 ? roots.push(joint) : children[parent].push(joint)));
    const trackByJoint = new Map<string, {
        translation?: AnimationTrack;
        rotation?: AnimationTrack;
    }>();
    for (const track of document.tracks) {
        if (track.path === 'scale')
            continue;
        const entry = trackByJoint.get(track.joint) ?? {};
        entry[track.path] = track;
        trackByJoint.set(track.joint, entry);
    }
    const offsetOf = (joint: number): [
        number,
        number,
        number
    ] => {
        const positions = skeleton.bindPositions;
        return positions ? [positions[joint * 3] * unitScale, positions[joint * 3 + 1] * unitScale, positions[joint * 3 + 2] * unitScale] : [0, 0, 0];
    };
    const lines: string[] = ['HIERARCHY'];
    const order: number[] = [];
    const writeJoint = (joint: number, depth: number, keyword: 'ROOT' | 'JOINT') => {
        const indent = '  '.repeat(depth);
        const [ox, oy, oz] = offsetOf(joint);
        order.push(joint);
        lines.push(`${indent}${keyword} ${skeleton.names[joint].replace(/\s+/g, '_')}`);
        lines.push(`${indent}{`);
        lines.push(keyword === 'ROOT' ? `${indent}  OFFSET 0.000000 0.000000 0.000000` : `${indent}  OFFSET ${formatNumber(ox)} ${formatNumber(oy)} ${formatNumber(oz)}`);
        lines.push(keyword === 'ROOT' || trackByJoint.get(skeleton.names[joint])?.translation
            ? `${indent}  CHANNELS 6 Xposition Yposition Zposition Zrotation Xrotation Yrotation`
            : `${indent}  CHANNELS 3 Zrotation Xrotation Yrotation`);
        if (children[joint].length === 0) {
            lines.push(`${indent}  End Site`);
            lines.push(`${indent}  {`);
            lines.push(`${indent}    OFFSET 0.000000 ${formatNumber(Math.max(Math.hypot(ox, oy, oz) * 0.5, 0.01))} 0.000000`);
            lines.push(`${indent}  }`);
        }
        else {
            for (const child of children[joint])
                writeJoint(child, depth + 1, 'JOINT');
        }
        lines.push(`${indent}}`);
    };
    for (const root of roots)
        writeJoint(root, 0, 'ROOT');
    lines.push('MOTION');
    lines.push(`Frames: ${frameCount}`);
    lines.push(`Frame Time: ${formatNumber(frameTime)}`);
    const position = vec3.create();
    const rotation = quat.create();
    for (let frame = 0; frame < frameCount; frame++) {
        const time = Math.min(frame * frameTime, document.duration);
        const row: string[] = [];
        for (const joint of order) {
            const name = skeleton.names[joint];
            const tracks = trackByJoint.get(name);
            const hasTranslation = roots.includes(joint) || tracks?.translation !== undefined;
            if (hasTranslation) {
                if (tracks?.translation)
                    sampleTrack(tracks.translation, time, position);
                else {
                    const [ox, oy, oz] = offsetOf(joint);
                    vec3.set(position, ox / unitScale, oy / unitScale, oz / unitScale);
                }
                row.push(formatNumber(position[0] * unitScale), formatNumber(position[1] * unitScale), formatNumber(position[2] * unitScale));
            }
            if (tracks?.rotation)
                sampleTrack(tracks.rotation, time, rotation);
            else if (skeleton.bindRotations)
                rotation.set(skeleton.bindRotations.subarray(joint * 4, joint * 4 + 4));
            else
                quat.identity(rotation);
            const [rz, rx, ry] = quatToEulerZXY(rotation);
            row.push(formatNumber(rz), formatNumber(rx), formatNumber(ry));
        }
        lines.push(row.join(' '));
    }
    return `${lines.join('\n')}\n`;
}
