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
        const m = frame.worldMatrix;
        const inverse = frame.inverseWorldMatrix;
        for (let i = 0; i < pool.count;) {
            const nextAge = age[i] + dt;
            if (nextAge >= lifetime[i]) {
                pool.kill(i);
                continue;
            }
            age[i] = nextAge;
            const life = nextAge / lifetime[i];
            const p = i * 3;
            let vx = velocity[p];
            let vy = velocity[p + 1];
            let vz = velocity[p + 2];
            let speedMultiplier = 1;
            let addX = 0;
            let addY = 0;
            let addZ = 0;
            let sizeX = size0[i] * aspect;
            let sizeY = size0[i];
            let spin = angularVelocity[i];
            let alignToVelocity = false;
            let killed = false;
            let r = color0[i * 4];
            let g = color0[i * 4 + 1];
            let b = color0[i * 4 + 2];
            let a = color0[i * 4 + 3];
            const px = position[p];
            const py = position[p + 1];
            const pz = position[p + 2];
            for (let k = 0; k < modules.length; k++) {
                const module = modules[k];
                if (!module.enabled)
                    continue;
                switch (module.kind) {
                    case 'gravity': {
                        vx += gx * module.scale * dt;
                        vy += gy * module.scale * dt;
                        vz += gz * module.scale * dt;
                        break;
                    }
                    case 'force': {
                        const variation = 1 + module.randomize * (seed[i] * 2 - 1);
                        scratch[0] = module.force[0] * variation * scale;
                        scratch[1] = module.force[1] * variation * scale;
                        scratch[2] = module.force[2] * variation * scale;
                        const force = module.space === 'world' ? this.toSimulationSpace(scratch, scratchB) : isWorld ? this.rotateToWorld(scratch, scratchB) : scratch;
                        vx += force[0] * dt;
                        vy += force[1] * dt;
                        vz += force[2] * dt;
                        break;
                    }
                    case 'drag': {
                        const factor = Math.max(0, 1 - module.coefficient * sampleCurve(module.curve, life) * dt);
                        vx *= factor;
                        vy *= factor;
                        vz *= factor;
                        break;
                    }
                    case 'noise': {
                        const frequency = module.frequency / Math.max(scale, 1e-3);
                        const t = frame.clock * module.scrollSpeed;
                        let nx = 0;
                        let ny = 0;
                        let nz = 0;
                        let amplitude = 1;
                        let octaveFrequency = frequency;
                        for (let octave = 0; octave < module.octaves; octave++) {
                            noiseField(px * octaveFrequency + t, py * octaveFrequency + t * 0.7, pz * octaveFrequency - t * 0.4, this.noise);
                            nx += this.noise[0] * amplitude;
                            ny += this.noise[1] * amplitude;
                            nz += this.noise[2] * amplitude;
                            amplitude *= 0.5;
                            octaveFrequency *= 2;
                        }
                        const strength = module.strength * sampleCurve(module.curve, life) * scale * dt * 2;
                        vx += nx * strength;
                        vy += ny * strength;
                        vz += nz * strength;
                        break;
                    }
                    case 'vortex': {
                        const cx = isWorld ? m[12] : 0;
                        const cy = isWorld ? m[13] : 0;
                        const cz = isWorld ? m[14] : 0;
                        scratch[0] = module.axis[0];
                        scratch[1] = module.axis[1];
                        scratch[2] = module.axis[2];
                        const axis = isWorld ? this.rotateToWorld(scratch, scratchB) : scratch;
                        const axisLength = Math.hypot(axis[0], axis[1], axis[2]) || 1;
                        const ax = axis[0] / axisLength;
                        const ay = axis[1] / axisLength;
                        const az = axis[2] / axisLength;
                        const rx = px - cx;
                        const ry = py - cy;
                        const rz = pz - cz;
                        const along = rx * ax + ry * ay + rz * az;
                        const qx = rx - ax * along;
                        const qy = ry - ay * along;
                        const qz = rz - az * along;
                        const radius = Math.hypot(qx, qy, qz);
                        if (radius > 1e-4) {
                            const tx = ay * qz - az * qy;
                            const ty = az * qx - ax * qz;
                            const tz = ax * qy - ay * qx;
                            const tangential = module.strength * scale * dt;
                            const pull = (module.pull * scale * dt) / radius;
                            vx += (tx / radius) * tangential - qx * pull;
                            vy += (ty / radius) * tangential - qy * pull;
                            vz += (tz / radius) * tangential - qz * pull;
                        }
                        break;
                    }
                    case 'attractor': {
                        scratch[0] = module.position[0] * scale;
                        scratch[1] = module.position[1] * scale;
                        scratch[2] = module.position[2] * scale;
                        const target = isWorld ? mat4.transformPoint(scratchB, m, scratch) : scratch;
                        const dx = target[0] - px;
                        const dy = target[1] - py;
                        const dz = target[2] - pz;
                        const distance = Math.hypot(dx, dy, dz);
                        if (distance <= module.radius * scale) {
                            if (module.kill) {
                                killed = true;
                                break;
                            }
                            vx *= 0.9;
                            vy *= 0.9;
                            vz *= 0.9;
                        }
                        else {
                            const pull = (module.strength * scale * dt) / Math.max(distance, 0.05);
                            vx += dx * pull;
                            vy += dy * pull;
                            vz += dz * pull;
                        }
                        break;
                    }
                    case 'orbit': {
                        const cx = isWorld ? m[12] : 0;
                        const cy = isWorld ? m[13] : 0;
                        const cz = isWorld ? m[14] : 0;
                        scratch[0] = module.axis[0];
                        scratch[1] = module.axis[1];
                        scratch[2] = module.axis[2];
                        const axis = isWorld ? this.rotateToWorld(scratch, scratchB) : scratch;
                        vec3.normalize(axis, axis);
                        scratch[0] = px - cx;
                        scratch[1] = py - cy;
                        scratch[2] = pz - cz;
                        vec3.rotateAroundAxis(localDirection, scratch, axis, module.speed * dt);
                        const along = vec3.dot(localDirection, axis);
                        const qx = localDirection[0] - axis[0] * along;
                        const qy = localDirection[1] - axis[1] * along;
                        const qz = localDirection[2] - axis[2] * along;
                        const radius = Math.hypot(qx, qy, qz);
                        const radial = radius > 1e-4 ? (module.radial * scale * dt) / radius : 0;
                        addX += (localDirection[0] - scratch[0] + qx * radial) / dt;
                        addY += (localDirection[1] - scratch[1] + qy * radial) / dt;
                        addZ += (localDirection[2] - scratch[2] + qz * radial) / dt;
                        break;
                    }
                    case 'velocityOverLife': {
                        speedMultiplier *= sampleCurve(module.speedCurve, life);
                        scratch[0] = module.linear[0] * scale;
                        scratch[1] = module.linear[1] * scale;
                        scratch[2] = module.linear[2] * scale;
                        const linear = module.space === 'world' ? this.toSimulationSpace(scratch, scratchB) : isWorld ? this.rotateToWorld(scratch, scratchB) : scratch;
                        addX += linear[0];
                        addY += linear[1];
                        addZ += linear[2];
                        break;
                    }
                    case 'limitVelocity': {
                        const limit = module.speed * scale;
                        const current = Math.hypot(vx, vy, vz);
                        if (current > limit && current > 1e-6) {
                            const target = limit / current;
                            const factor = 1 + (target - 1) * clamp(module.dampen * dt * 10, 0, 1);
                            vx *= factor;
                            vy *= factor;
                            vz *= factor;
                        }
                        break;
                    }
                    case 'sizeOverLife': {
                        sizeX *= sampleCurve(module.curve, life);
                        sizeY *= module.separateAxes ? sampleCurve(module.curveY, life) : sampleCurve(module.curve, life);
                        break;
                    }
                    case 'sizeBySpeed': {
                        const current = Math.hypot(vx, vy, vz) / Math.max(scale, 1e-3);
                        const t = module.speedMax > module.speedMin ? clamp((current - module.speedMin) / (module.speedMax - module.speedMin), 0, 1) : 1;
                        const factor = sampleCurve(module.curve, t);
                        sizeX *= factor;
                        sizeY *= factor;
                        break;
                    }
                    case 'colorOverLife': {
                        sampleGradient(module.gradient, life, sample);
                        r *= sample[0];
                        g *= sample[1];
                        b *= sample[2];
                        a *= sample[3];
                        break;
                    }
                    case 'colorBySpeed': {
                        const current = Math.hypot(vx, vy, vz) / Math.max(scale, 1e-3);
                        const t = module.speedMax > module.speedMin ? clamp((current - module.speedMin) / (module.speedMax - module.speedMin), 0, 1) : 1;
                        sampleGradient(module.gradient, t, sample);
                        r *= sample[0];
                        g *= sample[1];
                        b *= sample[2];
                        a *= sample[3];
                        break;
                    }
                    case 'rotationOverLife': {
                        if (module.alignToVelocity)
                            alignToVelocity = true;
                        else
                            spin = sampleCurve(module.curve, life) * DEG_TO_RAD;
                        break;
                    }
                    case 'collision':
                        break;
                }
                if (killed)
                    break;
            }
            if (killed) {
                pool.kill(i);
                continue;
            }
            velocity[p] = vx;
            velocity[p + 1] = vy;
            velocity[p + 2] = vz;
            let nx = px + (vx * speedMultiplier + addX) * dt;
            let ny = py + (vy * speedMultiplier + addY) * dt;
            let nz = pz + (vz * speedMultiplier + addZ) * dt;
        }
    }
}
