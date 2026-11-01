import { clamp } from '@/engine/core/math/scalar';
import { createGradient, createCurve, solidGradient, type VfxColorValue, type VfxCurve, type VfxCurveInterpolation, type VfxGradient, type VfxRgb, type VfxScalar, } from './vfx-curves';
import { allocateVfxId, createBurst, createEmitter, createFlipbook, createInitial, createModule, createRenderer, createShape, createSpawn, createVfxDocument, VFX_BLEND_MODES, VFX_EMITTER_TINTS, VFX_EXTENSION, VFX_FORMAT_VERSION, VFX_MAX_DURATION, VFX_MAX_EMITTERS, VFX_MAX_PARTICLES_PER_EMITTER, VFX_MIME_TYPE, VFX_MODULE_CATALOG, VFX_RENDER_MODES, VFX_SHAPE_KINDS, type VfxBurst, type VfxDocument, type VfxEmitter, type VfxFlipbook, type VfxModule, type VfxRenderer, type VfxShape, type VfxTextureRef, } from './vfx-document';
type Raw = Record<string, unknown>;
const BUILTIN_TEXTURES = new Set(['soft', 'circle', 'ring', 'spark', 'star', 'smoke', 'flare', 'square', 'cross', 'drop', 'shard', 'bokeh', 'noise']);
const MODULE_KINDS = new Set(VFX_MODULE_CATALOG.map((info) => info.kind));
function isRecord(value: unknown): value is Raw {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function num(value: unknown, fallback: number, min = -Infinity, max = Infinity): number {
    return typeof value === 'number' && Number.isFinite(value) ? clamp(value, min, max) : fallback;
}
function bool(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
}
function str(value: unknown, fallback: string): string {
    return typeof value === 'string' ? value : fallback;
}
function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
    return typeof value === 'string' && (options as readonly string[]).includes(value) ? (value as T) : fallback;
}
function vec3(value: unknown, fallback: readonly [
    number,
    number,
    number
]): readonly [
    number,
    number,
    number
] {
    if (!Array.isArray(value) || value.length < 3)
        return fallback;
    return [num(value[0], fallback[0]), num(value[1], fallback[1]), num(value[2], fallback[2])];
}
function vec2(value: unknown, fallback: readonly [
    number,
    number
]): readonly [
    number,
    number
] {
    if (!Array.isArray(value) || value.length < 2)
        return fallback;
    return [num(value[0], fallback[0]), num(value[1], fallback[1])];
}
function rgb(value: unknown, fallback: VfxRgb): VfxRgb {
    if (!Array.isArray(value) || value.length < 3)
        return fallback;
    return [num(value[0], fallback[0], 0, 1), num(value[1], fallback[1], 0, 1), num(value[2], fallback[2], 0, 1)];
}
function curve(value: unknown, fallback: VfxCurve): VfxCurve {
    if (!isRecord(value) || !Array.isArray(value.keys))
        return fallback;
    const keys = value.keys.filter(isRecord).map((key) => ({ t: num(key.t, 0, 0, 1), v: num(key.v, 0) }));
    if (keys.length === 0)
        return fallback;
    return createCurve(keys, oneOf<VfxCurveInterpolation>(value.interpolation, ['linear', 'smooth', 'step'], 'smooth'));
}
function gradient(value: unknown, fallback: VfxGradient): VfxGradient {
    if (!isRecord(value))
        return fallback;
    const colors = Array.isArray(value.colors) ? value.colors.filter(isRecord).map((stop) => ({ t: num(stop.t, 0, 0, 1), color: rgb(stop.color, [1, 1, 1]) })) : [];
    const alphas = Array.isArray(value.alphas) ? value.alphas.filter(isRecord).map((stop) => ({ t: num(stop.t, 0, 0, 1), alpha: num(stop.alpha, 1, 0, 1) })) : [];
    if (colors.length === 0 && alphas.length === 0)
        return fallback;
    return createGradient(colors.length > 0 ? colors : fallback.colors, alphas.length > 0 ? alphas : fallback.alphas);
}
function scalar(value: unknown, fallback: VfxScalar): VfxScalar {
    if (!isRecord(value))
        return fallback;
    switch (value.kind) {
        case 'constant':
            return { kind: 'constant', value: num(value.value, 0) };
        case 'random': {
            const min = num(value.min, 0);
            const max = num(value.max, min);
            return { kind: 'random', min: Math.min(min, max), max: Math.max(min, max) };
        }
        case 'curve':
            return { kind: 'curve', curve: curve(value.curve, createCurve([{ t: 0, v: 1 }])), scale: num(value.scale, 1) };
        case 'randomCurve':
            return { kind: 'randomCurve', min: curve(value.min, createCurve([{ t: 0, v: 0.5 }])), max: curve(value.max, createCurve([{ t: 0, v: 1 }])), scale: num(value.scale, 1) };
        default:
            return fallback;
    }
}
function colorValue(value: unknown, fallback: VfxColorValue): VfxColorValue {
    if (!isRecord(value))
        return fallback;
    switch (value.kind) {
        case 'constant':
            return { kind: 'constant', color: rgb(value.color, [1, 1, 1]), alpha: num(value.alpha, 1, 0, 1) };
        case 'random':
            return { kind: 'random', a: rgb(value.a, [1, 1, 1]), alphaA: num(value.alphaA, 1, 0, 1), b: rgb(value.b, [1, 1, 1]), alphaB: num(value.alphaB, 1, 0, 1) };
        case 'gradient':
            return { kind: 'gradient', gradient: gradient(value.gradient, solidGradient([1, 1, 1])) };
        default:
            return fallback;
    }
}
function textureRef(value: unknown, fallback: VfxTextureRef): VfxTextureRef {
    if (!isRecord(value))
        return fallback;
    if (value.kind === 'asset' && typeof value.assetId === 'string' && value.assetId)
        return { kind: 'asset', assetId: value.assetId };
    if (value.kind === 'builtin' && typeof value.id === 'string' && BUILTIN_TEXTURES.has(value.id))
        return { kind: 'builtin', id: value.id as Extract<VfxTextureRef, {
                kind: 'builtin';
            }>['id'] };
    return fallback;
}
function flipbook(value: unknown): VfxFlipbook | null {
    if (!isRecord(value))
        return null;
    const base = createFlipbook();
    return {
        columns: Math.round(num(value.columns, base.columns, 1, 64)),
        rows: Math.round(num(value.rows, base.rows, 1, 64)),
        fps: num(value.fps, base.fps, 0, 240),
        loop: bool(value.loop, base.loop),
        randomStart: bool(value.randomStart, base.randomStart),
    };
}
function burst(value: Raw): VfxBurst {
    const base = createBurst();
    return {
        id: str(value.id, allocateVfxId('b')),
        time: num(value.time, base.time, 0, VFX_MAX_DURATION),
        count: Math.round(num(value.count, base.count, 0, VFX_MAX_PARTICLES_PER_EMITTER)),
        countMax: Math.round(num(value.countMax, base.countMax, 0, VFX_MAX_PARTICLES_PER_EMITTER)),
        cycles: Math.round(num(value.cycles, base.cycles, 0, 1000)),
        interval: num(value.interval, base.interval, 0.01, VFX_MAX_DURATION),
        probability: num(value.probability, base.probability, 0, 1),
    };
}
function shape(value: unknown): VfxShape {
    const base = createShape();
    if (!isRecord(value))
        return base;
    return {
        kind: oneOf(value.kind, VFX_SHAPE_KINDS, base.kind),
        radius: num(value.radius, base.radius, 0, 1000),
        thickness: num(value.thickness, base.thickness, 0, 1),
        angle: num(value.angle, base.angle, 0, 90),
        length: num(value.length, base.length, 0, 1000),
        size: vec3(value.size, base.size),
        arc: num(value.arc, base.arc, 0, 360),
        emitFrom: oneOf(value.emitFrom, ['volume', 'surface', 'edge'] as const, base.emitFrom),
        randomizeDirection: num(value.randomizeDirection, base.randomizeDirection, 0, 1),
        spherizeDirection: num(value.spherizeDirection, base.spherizeDirection, 0, 1),
        offset: vec3(value.offset, base.offset),
        rotation: vec3(value.rotation, base.rotation),
        scale: vec3(value.scale, base.scale),
    };
}
function renderer(value: unknown): VfxRenderer {
    const base = createRenderer();
    if (!isRecord(value))
        return base;
    return {
        mode: oneOf(value.mode, VFX_RENDER_MODES, base.mode),
        blend: oneOf(value.blend, VFX_BLEND_MODES, base.blend),
        texture: textureRef(value.texture, base.texture),
        flipbook: flipbook(value.flipbook),
        sort: oneOf(value.sort, ['none', 'distance', 'oldest', 'youngest'] as const, base.sort),
        lighting: oneOf(value.lighting, ['unlit', 'lit'] as const, base.lighting),
        intensity: num(value.intensity, base.intensity, 0, 64),
        softness: num(value.softness, base.softness, 0, 50),
        stretch: num(value.stretch, base.stretch, 0, 10),
        stretchMinimum: num(value.stretchMinimum, base.stretchMinimum, 0, 10),
        pivot: vec2(value.pivot, base.pivot),
        fadeNearCamera: num(value.fadeNearCamera, base.fadeNearCamera, 0, 100),
        alphaCutoff: num(value.alphaCutoff, base.alphaCutoff, 0, 1),
    };
}
function module(value: Raw): VfxModule | null {
    if (typeof value.kind !== 'string' || !MODULE_KINDS.has(value.kind as VfxModule['kind']))
        return null;
    const base = createModule(value.kind as VfxModule['kind'], str(value.id, allocateVfxId('m')));
    const enabled = bool(value.enabled, true);
    switch (base.kind) {
        case 'sizeOverLife':
            return { ...base, enabled, curve: curve(value.curve, base.curve), separateAxes: bool(value.separateAxes, false), curveY: curve(value.curveY, base.curveY) };
        case 'colorOverLife':
            return { ...base, enabled, gradient: gradient(value.gradient, base.gradient) };
        case 'velocityOverLife':
            return { ...base, enabled, speedCurve: curve(value.speedCurve, base.speedCurve), linear: vec3(value.linear, base.linear), space: oneOf(value.space, ['local', 'world'] as const, base.space) };
        case 'limitVelocity':
            return { ...base, enabled, speed: num(value.speed, base.speed, 0, 1000), dampen: num(value.dampen, base.dampen, 0, 1) };
        case 'gravity':
            return { ...base, enabled, scale: num(value.scale, base.scale, -10, 10) };
        case 'force':
            return { ...base, enabled, force: vec3(value.force, base.force), randomize: num(value.randomize, base.randomize, 0, 1), space: oneOf(value.space, ['local', 'world'] as const, base.space) };
        case 'drag':
            return { ...base, enabled, coefficient: num(value.coefficient, base.coefficient, 0, 50), curve: curve(value.curve, base.curve) };
        case 'noise':
            return {
                ...base,
                enabled,
                strength: num(value.strength, base.strength, 0, 100),
                frequency: num(value.frequency, base.frequency, 0.01, 20),
                scrollSpeed: num(value.scrollSpeed, base.scrollSpeed, 0, 20),
                octaves: Math.round(num(value.octaves, base.octaves, 1, 4)),
                curve: curve(value.curve, base.curve),
            };
        case 'vortex':
            return { ...base, enabled, axis: vec3(value.axis, base.axis), strength: num(value.strength, base.strength, -100, 100), pull: num(value.pull, base.pull, -50, 50) };
        case 'attractor':
            return { ...base, enabled, position: vec3(value.position, base.position), strength: num(value.strength, base.strength, -100, 100), radius: num(value.radius, base.radius, 0, 100), kill: bool(value.kill, base.kill) };
        case 'orbit':
            return { ...base, enabled, speed: num(value.speed, base.speed, -50, 50), radial: num(value.radial, base.radial, -50, 50), axis: vec3(value.axis, base.axis) };
        case 'rotationOverLife':
            return { ...base, enabled, curve: curve(value.curve, base.curve), alignToVelocity: bool(value.alignToVelocity, base.alignToVelocity) };
        case 'collision':
            return {
                ...base,
                enabled,
                planeHeight: num(value.planeHeight, base.planeHeight, -1000, 1000),
                bounce: num(value.bounce, base.bounce, 0, 1),
                friction: num(value.friction, base.friction, 0, 1),
                lifetimeLoss: num(value.lifetimeLoss, base.lifetimeLoss, 0, 1),
                killOnCollide: bool(value.killOnCollide, base.killOnCollide),
            };
        case 'sizeBySpeed':
            return { ...base, enabled, curve: curve(value.curve, base.curve), speedMin: num(value.speedMin, base.speedMin, 0, 1000), speedMax: num(value.speedMax, base.speedMax, 0, 1000) };
        case 'colorBySpeed':
            return { ...base, enabled, gradient: gradient(value.gradient, base.gradient), speedMin: num(value.speedMin, base.speedMin, 0, 1000), speedMax: num(value.speedMax, base.speedMax, 0, 1000) };
    }
}
function emitter(value: Raw, index: number): VfxEmitter {
    const base = createEmitter({}, str(value.id, allocateVfxId('e')));
    const spawnRaw = isRecord(value.spawn) ? value.spawn : {};
    const initialRaw = isRecord(value.initial) ? value.initial : {};
    const baseSpawn = createSpawn();
    const baseInitial = createInitial();
    return {
        ...base,
        name: str(value.name, `Emissor ${index + 1}`),
        enabled: bool(value.enabled, true),
        delay: num(value.delay, 0, 0, VFX_MAX_DURATION),
        duration: num(value.duration, 0, 0, VFX_MAX_DURATION),
        loop: bool(value.loop, true),
        maxParticles: Math.round(num(value.maxParticles, base.maxParticles, 1, VFX_MAX_PARTICLES_PER_EMITTER)),
        space: oneOf(value.space, ['local', 'world'] as const, base.space),
        spawn: {
            rate: scalar(spawnRaw.rate, baseSpawn.rate),
            rateOverDistance: num(spawnRaw.rateOverDistance, 0, 0, 10000),
            bursts: Array.isArray(spawnRaw.bursts) ? spawnRaw.bursts.filter(isRecord).map(burst) : [],
        },
        shape: shape(value.shape),
        initial: {
            lifetime: scalar(initialRaw.lifetime, baseInitial.lifetime),
            speed: scalar(initialRaw.speed, baseInitial.speed),
            size: scalar(initialRaw.size, baseInitial.size),
            aspect: num(initialRaw.aspect, 1, 0.05, 20),
            rotation: scalar(initialRaw.rotation, baseInitial.rotation),
            angularVelocity: scalar(initialRaw.angularVelocity, baseInitial.angularVelocity),
            color: colorValue(initialRaw.color, baseInitial.color),
            inheritVelocity: num(initialRaw.inheritVelocity, 0, -2, 2),
        },
        modules: Array.isArray(value.modules) ? value.modules.filter(isRecord).map(module).filter((item): item is VfxModule => item !== null) : [],
        renderer: renderer(value.renderer),
        tint: rgb(value.tint, VFX_EMITTER_TINTS[index % VFX_EMITTER_TINTS.length]),
    };
}
