import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import { clamp, DEG_TO_RAD } from '@/engine/core/math/scalar';
import { valueNoise3 } from '@/engine/core/noise/value-noise';
import { sampleColorValue, sampleCurve, sampleGradient, sampleScalar } from '@/engine/vfx/document/vfx-curves';
import { emitterDuration, type VfxDocument, type VfxEmitter, type VfxModule } from '@/engine/vfx/document/vfx-document';
import { sampleShape } from './emitter-shapes';
import { ParticlePool, VfxRandom } from './particle-pool';
export interface EmitterFrame {
    readonly worldMatrix: Float32Array;
    readonly inverseWorldMatrix: Float32Array | null;
    readonly actorVelocity: Float32Array;
    readonly actorDistance: number;
    readonly scale: number;
    readonly gravity: Float32Array;
    readonly time: number;
    readonly clock: number;
}
interface BurstState {
    nextTime: number;
    remaining: number;
}
const spawnPosition = new Float32Array(3);
const spawnDirection = new Float32Array(3);
const spawnColor = new Float32Array(4);
const sample = new Float32Array(4);
const scratch = vec3.create();
const scratchB = vec3.create();
const localDirection = vec3.create();
function extractRotation(out: Float32Array, m: Float32Array): void {
    for (let column = 0; column < 3; column++) {
        const x = m[column * 4];
        const y = m[column * 4 + 1];
        const z = m[column * 4 + 2];
        const length = Math.hypot(x, y, z) || 1;
        out[column * 3] = x / length;
        out[column * 3 + 1] = y / length;
        out[column * 3 + 2] = z / length;
    }
}
function noiseField(x: number, y: number, z: number, out: Float32Array): void {
    const seed = 7;
    out[0] = valueNoise3(x, y + 31.7, z, seed) - valueNoise3(x, y, z + 17.3, seed + 3);
    out[1] = valueNoise3(x, y, z + 17.3, seed + 5) - valueNoise3(x + 23.1, y, z, seed + 7);
    out[2] = valueNoise3(x + 23.1, y, z, seed + 11) - valueNoise3(x, y + 31.7, z, seed + 13);
}
export class EmitterSimulator {
    pool: ParticlePool;
    readonly rng: VfxRandom;
    time = -Infinity;
    private readonly bursts: BurstState[] = [];
    private requestedBurst = 0;
    private rateAccumulator = 0;
    private distanceAccumulator = 0;
    private cyclesStarted = 0;
    private emitting = false;
    private readonly rotation = new Float32Array(9);
    private readonly worldToLocal = new Float32Array(3);
    private readonly noise = new Float32Array(3);
    private readonly seed: number;
    constructor(public emitter: VfxEmitter, seed: number) {
        this.seed = seed;
        this.rng = new VfxRandom(seed);
        this.pool = new ParticlePool(emitter.maxParticles);
        this.resetCycle();
    }
    setEmitter(emitter: VfxEmitter): void {
        const capacityChanged = emitter.maxParticles !== this.pool.capacity;
        this.emitter = emitter;
        if (capacityChanged) {
            const previous = this.pool;
            this.pool = new ParticlePool(emitter.maxParticles);
            this.copyAlive(previous);
        }
        const wasEmitting = this.emitting;
        this.resetBursts();
        this.emitting = wasEmitting;
    }
    private copyAlive(previous: ParticlePool): void {
        const { pool } = this;
        const count = Math.min(previous.count, pool.capacity);
        pool.position.set(previous.position.subarray(0, count * 3));
        pool.velocity.set(previous.velocity.subarray(0, count * 3));
        pool.age.set(previous.age.subarray(0, count));
        pool.lifetime.set(previous.lifetime.subarray(0, count));
        pool.size0.set(previous.size0.subarray(0, count));
        pool.size.set(previous.size.subarray(0, count * 2));
        pool.rotation.set(previous.rotation.subarray(0, count));
        pool.angularVelocity.set(previous.angularVelocity.subarray(0, count));
        pool.color0.set(previous.color0.subarray(0, count * 4));
        pool.color.set(previous.color.subarray(0, count * 4));
        pool.seed.set(previous.seed.subarray(0, count));
        pool.seed2.set(previous.seed2.subarray(0, count));
        pool.frame.set(previous.frame.subarray(0, count));
        pool.count = count;
    }
    reset(): void {
        this.pool.clear();
        this.rng.reseed(this.seed);
        this.time = -Infinity;
        this.cyclesStarted = 0;
        this.rateAccumulator = 0;
        this.distanceAccumulator = 0;
        this.resetCycle();
    }
    resetCycle(): void {
        this.resetBursts();
        this.rateAccumulator = 0;
        this.emitting = false;
    }
    private resetBursts(): void {
        this.bursts.length = 0;
        for (const burst of this.emitter.spawn.bursts)
            this.bursts.push({ nextTime: burst.time, remaining: burst.cycles });
    }
    burst(count: number): void {
        this.requestedBurst += Math.max(0, Math.floor(count));
    }
    get alive(): number {
        return this.pool.count;
    }
    get active(): boolean {
        return this.emitting;
    }
    step(dt: number, frame: EmitterFrame, document: VfxDocument, cycle: number): void {
        const { emitter } = this;
        extractRotation(this.rotation, frame.worldMatrix);
        this.update(dt, frame, document);
        if (!emitter.enabled) {
            this.emitting = false;
            this.requestedBurst = 0;
            return;
        }
        const duration = emitterDuration(document, emitter);
        const localTime = frame.time - emitter.delay;
        const previousTime = this.time;
        this.time = localTime;
        this.emitting = localTime >= 0 && localTime <= duration && (emitter.loop || cycle === 0);
        const progress = duration > 0 ? clamp(localTime / duration, 0, 1) : 0;
        if (this.requestedBurst > 0) {
            const count = this.requestedBurst;
            this.requestedBurst = 0;
            for (let i = 0; i < count && !this.pool.full; i++)
                this.spawn(frame, progress, 0);
        }
        if (!this.emitting)
            return;
        if (cycle !== this.cyclesStarted)
            this.cyclesStarted = cycle;
        const rate = Math.max(0, sampleScalar(emitter.spawn.rate, progress, 0.5));
        this.rateAccumulator += rate * dt;
        this.distanceAccumulator += frame.actorDistance * emitter.spawn.rateOverDistance;
        let births = Math.floor(this.rateAccumulator) + Math.floor(this.distanceAccumulator);
        this.rateAccumulator -= Math.floor(this.rateAccumulator);
        this.distanceAccumulator -= Math.floor(this.distanceAccumulator);
        const since = Number.isFinite(previousTime) ? previousTime : -Infinity;
        for (let i = 0; i < emitter.spawn.bursts.length; i++) {
            const burst = emitter.spawn.bursts[i];
            const state = this.bursts[i];
            if (!state)
                continue;
            while ((burst.cycles === 0 || state.remaining > 0) && state.nextTime > since - 1e-6 && state.nextTime <= localTime) {
                if (this.rng.next() <= burst.probability) {
                    births += burst.countMax > burst.count ? this.rng.int(burst.count, burst.countMax) : burst.count;
                }
                state.nextTime += Math.max(burst.interval, 1e-3);
                if (burst.cycles > 0)
                    state.remaining--;
            }
        }
        if (births <= 0)
            return;
        const spread = dt / births;
        for (let i = 0; i < births && !this.pool.full; i++) {
            this.spawn(frame, progress, dt - spread * (i + 1));
        }
    }
    private spawn(frame: EmitterFrame, progress: number, ageOffset: number): void {
        const { emitter, pool, rng } = this;
        const index = pool.allocate();
        if (index === -1)
            return;
        const { initial, shape } = emitter;
        const seed = rng.next();
        const seed2 = rng.next();
        const scale = frame.scale;
        sampleShape(shape, rng, scale, spawnPosition, 0, spawnDirection, 0);
        const lifetime = Math.max(0.01, sampleScalar(initial.lifetime, progress, seed));
        const speed = sampleScalar(initial.speed, progress, seed2) * scale;
        const size = Math.max(0, sampleScalar(initial.size, progress, seed)) * scale;
        const rotation = sampleScalar(initial.rotation, progress, seed2) * DEG_TO_RAD;
        const angular = sampleScalar(initial.angularVelocity, progress, seed) * DEG_TO_RAD;
        sampleColorValue(initial.color, progress, seed, spawnColor);
        const p3 = index * 3;
        if (emitter.space === 'world') {
            mat4.transformPoint(scratch, frame.worldMatrix, spawnPosition as Float32Array);
            pool.position[p3] = scratch[0];
            pool.position[p3 + 1] = scratch[1];
            pool.position[p3 + 2] = scratch[2];
            this.rotateToWorld(spawnDirection, scratchB);
            vec3.normalize(scratchB, scratchB);
            pool.velocity[p3] = scratchB[0] * speed + frame.actorVelocity[0] * initial.inheritVelocity;
            pool.velocity[p3 + 1] = scratchB[1] * speed + frame.actorVelocity[1] * initial.inheritVelocity;
            pool.velocity[p3 + 2] = scratchB[2] * speed + frame.actorVelocity[2] * initial.inheritVelocity;
        }
        else {
            pool.position[p3] = spawnPosition[0];
            pool.position[p3 + 1] = spawnPosition[1];
            pool.position[p3 + 2] = spawnPosition[2];
            this.rotateToLocal(frame.actorVelocity, scratchB);
            pool.velocity[p3] = spawnDirection[0] * speed + scratchB[0] * initial.inheritVelocity;
            pool.velocity[p3 + 1] = spawnDirection[1] * speed + scratchB[1] * initial.inheritVelocity;
            pool.velocity[p3 + 2] = spawnDirection[2] * speed + scratchB[2] * initial.inheritVelocity;
        }
        pool.age[index] = Math.max(0, ageOffset);
        pool.lifetime[index] = lifetime;
        pool.size0[index] = size;
        pool.size[index * 2] = size * initial.aspect;
        pool.size[index * 2 + 1] = size;
        pool.rotation[index] = rotation;
        pool.angularVelocity[index] = angular;
        for (let c = 0; c < 4; c++) {
            pool.color0[index * 4 + c] = spawnColor[c];
            pool.color[index * 4 + c] = spawnColor[c];
        }
        pool.seed[index] = seed;
        pool.seed2[index] = seed2;
        pool.frame[index] = emitter.renderer.flipbook?.randomStart ? rng.next() * emitter.renderer.flipbook.columns * emitter.renderer.flipbook.rows : 0;
        if (ageOffset > 0) {
            pool.position[p3] += pool.velocity[p3] * ageOffset;
            pool.position[p3 + 1] += pool.velocity[p3 + 1] * ageOffset;
            pool.position[p3 + 2] += pool.velocity[p3 + 2] * ageOffset;
        }
    }
    private rotateToWorld(local: Float32Array, out: Float32Array): Float32Array {
        const r = this.rotation;
        const x = local[0];
        const y = local[1];
        const z = local[2];
        out[0] = r[0] * x + r[3] * y + r[6] * z;
        out[1] = r[1] * x + r[4] * y + r[7] * z;
        out[2] = r[2] * x + r[5] * y + r[8] * z;
        return out;
    }
    private rotateToLocal(world: Float32Array, out: Float32Array): void {
        const r = this.rotation;
        const x = world[0];
        const y = world[1];
        const z = world[2];
        out[0] = r[0] * x + r[1] * y + r[2] * z;
        out[1] = r[3] * x + r[4] * y + r[5] * z;
        out[2] = r[6] * x + r[7] * y + r[8] * z;
    }
    private toSimulationSpace(world: Float32Array, out: Float32Array): Float32Array {
        if (this.emitter.space === 'world') {
            out[0] = world[0];
            out[1] = world[1];
            out[2] = world[2];
            return out;
        }
        this.rotateToLocal(world, out);
        return out;
    }
    private update(dt: number, frame: EmitterFrame, document: VfxDocument): void {
        const { pool, emitter } = this;
        if (pool.count === 0)
            return;
        const { modules } = emitter;
        const isWorld = emitter.space === 'world';
        const { position, velocity, age, lifetime, size, size0, rotation, angularVelocity, color, color0, seed, frame: frames } = pool;
        const flipbook = emitter.renderer.flipbook;
        const frameCount = flipbook ? flipbook.columns * flipbook.rows : 0;
        const aspect = emitter.initial.aspect;
        const gravity = this.toSimulationSpace(frame.gravity, this.worldToLocal);
        const gx = gravity[0];
        const gy = gravity[1];
        const gz = gravity[2];
        const scale = frame.scale;
    }
}
