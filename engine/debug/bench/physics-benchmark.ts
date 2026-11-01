import * as vec3 from '@/engine/core/math/vec3';
import * as quat from '@/engine/core/math/quat';
import { PhysicsWorld } from '@/engine/physics/world/physics-world';
import { createPhysicsSettings, PHYSICS_QUALITY_PRESETS, type PhysicsQuality } from '@/engine/physics/world/physics-settings';
import { createBoxShape } from '@/engine/physics/shapes/collider-shape';
export interface PhysicsBenchmarkOptions {
    readonly counts?: readonly number[];
    readonly frames?: number;
    readonly quality?: PhysicsQuality;
    readonly warmupFrames?: number;
}
export interface PhysicsBenchmarkRow {
    readonly bodies: number;
    readonly frames: number;
    readonly meanMs: number;
    readonly peakMs: number;
    readonly p50Ms: number;
    readonly p95Ms: number;
    readonly maxMs: number;
    readonly awakeAtEnd: number;
    readonly stepMsAverage: number;
    readonly totalMs: number;
}
const FRAME_DT = 1 / 60;
const PEAK_WINDOW_FRAMES = 120;
function lcg(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 0x100000000;
    };
}
export function buildStackScenario(count: number, quality: PhysicsQuality): PhysicsWorld {
    const world = new PhysicsWorld(createPhysicsSettings({ ...PHYSICS_QUALITY_PRESETS[quality] }));
    const identity = quat.create();
    world.createBody({
        type: 'static',
        shape: createBoxShape(50, 0.5, 50),
        position: vec3.create(0, -0.5, 0),
        orientation: identity,
        mass: 0,
        friction: 0.8,
        restitution: 0,
        linearDamping: 0,
        angularDamping: 0,
        gravityScale: 1,
        canSleep: true,
    });
    const random = lcg(1234 + count);
    const columns = Math.max(1, Math.ceil(Math.cbrt(count)));
    const spacing = 1.15;
    for (let i = 0; i < count; i++) {
        const column = i % (columns * columns);
        const level = Math.floor(i / (columns * columns));
        const x = (column % columns - (columns - 1) / 2) * spacing + (random() - 0.5) * 0.1;
        const z = (Math.floor(column / columns) - (columns - 1) / 2) * spacing + (random() - 0.5) * 0.1;
        const y = 0.5 + level * 1.1 + 0.5;
        const tilt = quat.fromEulerDegrees(quat.create(), vec3.create((random() - 0.5) * 6, random() * 360, (random() - 0.5) * 6));
        world.createBody({
            type: 'dynamic',
            shape: createBoxShape(0.5, 0.5, 0.5),
            position: vec3.create(x, y, z),
            orientation: tilt,
            mass: 1,
            friction: 0.6,
            restitution: 0,
            linearDamping: 0,
            angularDamping: 0.05,
            gravityScale: 1,
            canSleep: true,
        });
    }
    return world;
}
function percentile(sorted: Float64Array, p: number): number {
    if (sorted.length === 0)
        return 0;
    return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))];
}
export function runPhysicsBenchmark(options: PhysicsBenchmarkOptions = {}): PhysicsBenchmarkRow[] {
    const counts = options.counts ?? [7, 50, 100, 200];
    const frames = options.frames ?? 600;
    const quality = options.quality ?? 'medium';
    const warmup = Math.min(options.warmupFrames ?? 30, Math.max(0, frames - 1));
    const rows: PhysicsBenchmarkRow[] = [];
    for (const count of counts) {
        const world = buildStackScenario(count, quality);
        world.stepBudgetMs = Infinity;
        const samples = new Float64Array(frames - warmup);
        let total = 0;
        for (let frame = 0; frame < frames; frame++) {
            world.advance(FRAME_DT);
            const ms = world.stats.advanceMs;
            total += ms;
            if (frame >= warmup)
                samples[frame - warmup] = ms;
        }
        const sorted = samples.slice().sort();
        let sum = 0;
        for (let i = 0; i < sorted.length; i++)
            sum += sorted[i];
        const peakFrames = Math.min(PEAK_WINDOW_FRAMES, samples.length);
        let peakSum = 0;
        for (let i = 0; i < peakFrames; i++)
            peakSum += samples[i];
        let awake = 0;
        for (const body of world.bodies)
            if (body.isSimulated)
                awake++;
        rows.push({
            bodies: count,
            frames,
            meanMs: sorted.length > 0 ? sum / sorted.length : 0,
            peakMs: peakFrames > 0 ? peakSum / peakFrames : 0,
            p50Ms: percentile(sorted, 0.5),
            p95Ms: percentile(sorted, 0.95),
            maxMs: sorted.length > 0 ? sorted[sorted.length - 1] : 0,
            awakeAtEnd: awake,
            stepMsAverage: world.stats.stepMsAverage,
            totalMs: total,
        });
    }
    return rows;
}
export function formatPhysicsBenchmark(rows: readonly PhysicsBenchmarkRow[], quality: PhysicsQuality): string[] {
    const fmt = (value: number, digits = 2) => value.toFixed(digits).padStart(7);
    const lines = [
        `Física · preset ${quality} (${PHYSICS_QUALITY_PRESETS[quality].substeps} subpassos) · ${rows[0]?.frames ?? 0} frames de 1/60 s por cenário`,
        `${'corpos'.padStart(7)} ${'pico'.padStart(7)} ${'média'.padStart(7)} ${'p50'.padStart(7)} ${'p95'.padStart(7)} ${'máx'.padStart(7)} ${'ms/passo'.padStart(9)} ${'acordados'.padStart(9)} ${'total'.padStart(9)}`,
    ];
    for (const row of rows) {
        lines.push(`${String(row.bodies).padStart(7)} ${fmt(row.peakMs)} ${fmt(row.meanMs)} ${fmt(row.p50Ms)} ${fmt(row.p95Ms)} ${fmt(row.maxMs)} ${fmt(row.stepMsAverage, 3).padStart(9)} ${String(row.awakeAtEnd).padStart(9)} ${fmt(row.totalMs, 0).padStart(9)}`);
    }
    lines.push('pico = média dos 2 s após o aquecimento (pilha caindo); média/p50/p95 incluem a pilha já assentada e dormindo.');
    return lines;
}
