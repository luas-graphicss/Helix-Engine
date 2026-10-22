import { encodeFloat32Base64, readFloatField } from './float-codec';
export const ANIMATION_FORMAT_ID = 'helix-animation';
export const ANIMATION_FORMAT_VERSION = 1;
export const ANIMATION_EXTENSION = 'hxanim';
export const ANIMATION_MIME_TYPE = 'application/vnd.helix.animation+json';
export type AnimationPath = 'translation' | 'rotation' | 'scale';
export type AnimationInterpolation = 'linear' | 'step' | 'cubic';
export const ANIMATION_PATHS: readonly AnimationPath[] = ['translation', 'rotation', 'scale'];
export const ANIMATION_INTERPOLATIONS: readonly AnimationInterpolation[] = ['linear', 'step', 'cubic'];
export interface AnimationTrack {
    readonly joint: string;
    readonly path: AnimationPath;
    readonly interpolation: AnimationInterpolation;
    readonly times: Float32Array;
    readonly values: Float32Array;
}
export interface AnimationSkeleton {
    readonly names: readonly string[];
    readonly parents: readonly number[];
    readonly bindPositions: Float32Array | null;
    readonly bindRotations: Float32Array | null;
    readonly bindScales: Float32Array | null;
}
export interface AnimationEvent {
    readonly time: number;
    readonly name: string;
}
export interface AnimationSource {
    readonly file: string;
    readonly format: string;
    readonly clip?: string;
}
export interface AnimationDocument {
    readonly name: string;
    readonly duration: number;
    readonly loop: boolean;
    readonly frameRate: number | null;
    readonly referenceSpeed: number;
    readonly tracks: readonly AnimationTrack[];
    readonly skeleton: AnimationSkeleton | null;
    readonly events: readonly AnimationEvent[];
    readonly source: AnimationSource | null;
    readonly createdAt: number;
}
export interface AnimationStats {
    readonly jointCount: number;
    readonly trackCount: number;
    readonly keyCount: number;
}
export function animationStats(document: AnimationDocument): AnimationStats {
    const joints = new Set<string>();
    let keyCount = 0;
    for (const track of document.tracks) {
        joints.add(track.joint);
        keyCount += track.times.length;
    }
    return { jointCount: joints.size, trackCount: document.tracks.length, keyCount };
}
export function measureDuration(tracks: readonly AnimationTrack[]): number {
    let duration = 0;
    for (const track of tracks)
        if (track.times.length > 0)
            duration = Math.max(duration, track.times[track.times.length - 1]);
    return duration;
}
function componentsOf(path: AnimationPath): 3 | 4 {
    return path === 'rotation' ? 4 : 3;
}
export function validateTrack(track: AnimationTrack): string | null {
    const components = componentsOf(track.path);
    const perKey = track.interpolation === 'cubic' ? components * 3 : components;
    if (track.times.length === 0)
        return `"${track.joint}/${track.path}": sem chaves.`;
    if (track.values.length !== track.times.length * perKey) {
        return `"${track.joint}/${track.path}": ${track.values.length} valores para ${track.times.length} chaves (esperado ${track.times.length * perKey}).`;
    }
    for (let i = 1; i < track.times.length; i++)
        if (track.times[i] < track.times[i - 1])
            return `"${track.joint}/${track.path}": tempos fora de ordem na chave ${i}.`;
    return null;
}
function asString(value: unknown, field: string, fallback?: string): string {
    if (typeof value === 'string')
        return value;
    if (fallback !== undefined && (value === undefined || value === null))
        return fallback;
    throw new Error(`"${field}" deve ser texto.`);
}
function asNumber(value: unknown, field: string, fallback?: number): number {
    if (typeof value === 'number' && Number.isFinite(value))
        return value;
    if (fallback !== undefined && (value === undefined || value === null))
        return fallback;
    throw new Error(`"${field}" deve ser um número.`);
}
function parseSkeleton(raw: unknown): AnimationSkeleton | null {
    if (!raw || typeof raw !== 'object')
        return null;
    const record = raw as Record<string, unknown>;
    if (!Array.isArray(record.names) || !Array.isArray(record.parents))
        throw new Error('"skeleton" precisa de "names" e "parents".');
    const names = record.names.map((name, index) => asString(name, `skeleton.names[${index}]`));
    const parents = record.parents.map((parent, index) => Math.trunc(asNumber(parent, `skeleton.parents[${index}]`)));
    if (parents.length !== names.length)
        throw new Error('"skeleton.parents" deve ter um item por osso.');
    const bind = (record.bind ?? null) as Record<string, unknown> | null;
    const bindField = (key: string, stride: number): Float32Array | null => {
        if (!bind || bind[key] === undefined || bind[key] === null)
            return null;
        const values = readFloatField(bind[key], `skeleton.bind.${key}`);
        if (values.length !== names.length * stride)
            throw new Error(`"skeleton.bind.${key}" deve ter ${stride} valores por osso.`);
        return values;
    };
    return { names, parents, bindPositions: bindField('positions', 3), bindRotations: bindField('rotations', 4), bindScales: bindField('scales', 3) };
}
function parseTrack(raw: unknown, index: number): AnimationTrack {
    if (!raw || typeof raw !== 'object')
        throw new Error(`Faixa ${index} inválida.`);
    const record = raw as Record<string, unknown>;
    const path = asString(record.path, `tracks[${index}].path`);
    if (!(ANIMATION_PATHS as readonly string[]).includes(path))
        throw new Error(`Faixa ${index}: caminho "${path}" desconhecido.`);
    const interpolation = asString(record.interpolation, `tracks[${index}].interpolation`, 'linear');
    if (!(ANIMATION_INTERPOLATIONS as readonly string[]).includes(interpolation))
        throw new Error(`Faixa ${index}: interpolação "${interpolation}" desconhecida.`);
    const track: AnimationTrack = {
        joint: asString(record.joint, `tracks[${index}].joint`),
        path: path as AnimationPath,
        interpolation: interpolation as AnimationInterpolation,
        times: readFloatField(record.times, `tracks[${index}].times`),
        values: readFloatField(record.values, `tracks[${index}].values`),
    };
    const problem = validateTrack(track);
    if (problem)
        throw new Error(problem);
    return track;
}
export function looksLikeAnimationDocument(text: string): boolean {
    const head = text.slice(0, 256);
    return head.includes(ANIMATION_FORMAT_ID);
}
export function parseAnimationDocument(text: string): AnimationDocument {
    let raw: unknown;
    try {
        raw = JSON.parse(text);
    }
    catch {
        throw new Error('O arquivo não é um JSON válido.');
    }
    if (!raw || typeof raw !== 'object')
        throw new Error('O arquivo não descreve uma animação.');
    const record = raw as Record<string, unknown>;
    if (record.format !== ANIMATION_FORMAT_ID)
        throw new Error(`Formato "${String(record.format)}" não é uma animação Helix.`);
    const version = asNumber(record.version, 'version');
    if (version > ANIMATION_FORMAT_VERSION)
        throw new Error(`Versão ${version} é mais nova do que esta engine entende (${ANIMATION_FORMAT_VERSION}).`);
    if (!Array.isArray(record.tracks))
        throw new Error('"tracks" deve ser uma lista.');
    const tracks = record.tracks.map(parseTrack);
    const events: AnimationEvent[] = Array.isArray(record.events)
        ? record.events.map((event, index) => {
            const item = (event ?? {}) as Record<string, unknown>;
            return { time: asNumber(item.time, `events[${index}].time`), name: asString(item.name, `events[${index}].name`) };
        })
        : [];
    const source = record.source && typeof record.source === 'object' ? (record.source as Record<string, unknown>) : null;
    const frameRate = record.frameRate === null || record.frameRate === undefined ? null : asNumber(record.frameRate, 'frameRate');
    return {
        name: asString(record.name, 'name', 'Animação'),
        duration: Math.max(asNumber(record.duration, 'duration', measureDuration(tracks)), 0),
        loop: typeof record.loop === 'boolean' ? record.loop : true,
        frameRate: frameRate !== null && frameRate > 0 ? frameRate : null,
        referenceSpeed: asNumber(record.referenceSpeed, 'referenceSpeed', 0),
        tracks,
        skeleton: parseSkeleton(record.skeleton),
        events,
        source: source ? { file: asString(source.file, 'source.file', ''), format: asString(source.format, 'source.format', ''), clip: typeof source.clip === 'string' ? source.clip : undefined } : null,
        createdAt: asNumber(record.createdAt, 'createdAt', Date.now()),
    };
}
export interface SerializeOptions {
    encoding?: 'binary' | 'readable';
}
function writeFloats(values: Float32Array, encoding: 'binary' | 'readable'): string | number[] {
    return encoding === 'binary' ? encodeFloat32Base64(values) : Array.from(values, (value) => Number(value.toFixed(6)));
}
export function serializeAnimationDocument(document: AnimationDocument, options: SerializeOptions = {}): string {
    const encoding = options.encoding ?? 'binary';
    const skeleton = document.skeleton;
    const payload = {
        format: ANIMATION_FORMAT_ID,
        version: ANIMATION_FORMAT_VERSION,
        name: document.name,
        duration: document.duration,
        loop: document.loop,
        frameRate: document.frameRate,
        referenceSpeed: document.referenceSpeed,
        encoding: encoding === 'binary' ? 'float32-base64' : 'numbers',
        skeleton: skeleton
            ? {
                names: skeleton.names,
                parents: skeleton.parents,
                bind: skeleton.bindPositions || skeleton.bindRotations || skeleton.bindScales
                    ? {
                        positions: skeleton.bindPositions ? writeFloats(skeleton.bindPositions, encoding) : undefined,
                        rotations: skeleton.bindRotations ? writeFloats(skeleton.bindRotations, encoding) : undefined,
                        scales: skeleton.bindScales ? writeFloats(skeleton.bindScales, encoding) : undefined,
                    }
                    : undefined,
            }
            : null,
        tracks: document.tracks.map((track) => ({
            joint: track.joint,
            path: track.path,
            interpolation: track.interpolation,
            times: writeFloats(track.times, encoding),
            values: writeFloats(track.values, encoding),
        })),
        events: document.events,
        source: document.source,
        createdAt: document.createdAt,
    };
    return JSON.stringify(payload, null, encoding === 'readable' ? 2 : 0);
}
export function animationFileName(name: string, extension = ANIMATION_EXTENSION): string {
    const base = name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]+/g, '_')
        .replace(/^_+|_+$/g, '');
    return `${base || 'animacao'}.${extension}`;
}
export function withAnimationFields(document: AnimationDocument, patch: Partial<AnimationDocument>): AnimationDocument {
    return { ...document, ...patch };
}
