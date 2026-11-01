import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import { scalarPeak } from '@/engine/vfx/document/vfx-curves';
import type { VfxDocument, VfxEmitter } from '@/engine/vfx/document/vfx-document';
import { shapeExtent } from './emitter-shapes';
import { EmitterSimulator, type EmitterFrame } from './emitter-simulator';
import { hashSeed } from './particle-pool';
const MAX_STEP = 1 / 30;
const MAX_SUBSTEPS = 4;
const TELEPORT_DISTANCE = 25;
export type VfxInstanceState = 'stopped' | 'playing' | 'paused' | 'finished';
export interface VfxPlayback {
    readonly loop: boolean | null;
    readonly scale: number;
    readonly timeScale: number;
}
type MutableFrame = {
    -readonly [K in keyof EmitterFrame]: EmitterFrame[K];
};
const extentCache = new WeakMap<VfxDocument, number>();
export function vfxDocumentExtent(document: VfxDocument): number {
    if (document.cullRadius > 0)
        return document.cullRadius;
    let extent = extentCache.get(document);
    if (extent === undefined) {
        extent = 0.5;
        for (const emitter of document.emitters) {
            if (!emitter.enabled)
                continue;
            const reach = shapeExtent(emitter.shape) + scalarPeak(emitter.initial.speed) * scalarPeak(emitter.initial.lifetime) + scalarPeak(emitter.initial.size);
            if (reach > extent)
                extent = reach;
        }
        extent *= document.scale;
        extentCache.set(document, extent);
    }
    return extent;
}
export class VfxInstance {
    document: VfxDocument;
    readonly simulators: EmitterSimulator[] = [];
    state: VfxInstanceState = 'stopped';
    time = 0;
    clock = 0;
    cycle = 0;
    private seed: number;
    private readonly frame: MutableFrame;
    private readonly inverse = mat4.create();
    private readonly previousPosition = vec3.create();
    private hasPreviousPosition = false;
    constructor(document: VfxDocument, seed: number) {
        this.document = document;
        this.seed = seed >>> 0;
        this.frame = {
            worldMatrix: mat4.create(),
            inverseWorldMatrix: null,
            actorVelocity: vec3.create(),
            actorDistance: 0,
            scale: document.scale,
            gravity: vec3.create(0, -9.81, 0),
            time: 0,
            clock: 0,
        };
        this.setDocument(document);
    }
    private emitterSeed(emitter: VfxEmitter): number {
        return (this.seed ^ hashSeed(emitter.id)) >>> 0;
    }
    setDocument(document: VfxDocument): void {
        this.document = document;
        const previous = new Map(this.simulators.map((simulator) => [simulator.emitter.id, simulator]));
        const next: EmitterSimulator[] = [];
        for (const emitter of document.emitters) {
            const existing = previous.get(emitter.id);
            if (existing) {
                if (existing.emitter !== emitter)
                    existing.setEmitter(emitter);
                next.push(existing);
            }
            else {
                next.push(new EmitterSimulator(emitter, this.emitterSeed(emitter)));
            }
        }
        this.simulators.splice(0, this.simulators.length, ...next);
    }
    reseed(seed: number): void {
        this.seed = seed >>> 0;
    }
    get alive(): number {
        let total = 0;
        for (const simulator of this.simulators)
            total += simulator.alive;
        return total;
    }
    get emitting(): boolean {
        for (const simulator of this.simulators)
            if (simulator.active)
                return true;
        return false;
    }
    get animating(): boolean {
        return this.state === 'playing' && (this.alive > 0 || this.emitting || this.time <= this.document.duration);
    }
    play(playback: VfxPlayback): void {
        this.restart(playback);
    }
    restart(playback: VfxPlayback): void {
        this.time = 0;
        this.clock = 0;
        this.cycle = 0;
        this.hasPreviousPosition = false;
        const simulators = this.document.emitters.map((emitter) => new EmitterSimulator(emitter, this.emitterSeed(emitter)));
        this.simulators.splice(0, this.simulators.length, ...simulators);
        this.state = 'playing';
        if (this.document.prewarm > 0)
            this.prewarm(this.document.prewarm, playback);
    }
    pause(): void {
        if (this.state === 'playing')
            this.state = 'paused';
    }
    resume(): void {
        if (this.state === 'paused')
            this.state = 'playing';
    }
    stop(): void {
        for (const simulator of this.simulators)
            simulator.reset();
        this.state = 'stopped';
        this.time = 0;
        this.clock = 0;
        this.cycle = 0;
        this.hasPreviousPosition = false;
    }
    private prewarm(seconds: number, playback: VfxPlayback): void {
        const steps = Math.min(Math.ceil(seconds / MAX_STEP), 600);
        const dt = seconds / steps;
        const frame = this.frame;
        frame.actorDistance = 0;
        vec3.set(frame.actorVelocity, 0, 0, 0);
        for (let i = 0; i < steps; i++)
            this.advance(dt, playback);
    }
    step(deltaSeconds: number, worldMatrix: Float32Array, gravity: Float32Array, playback: VfxPlayback): void {
        if (this.state !== 'playing' && this.state !== 'finished')
            return;
        const frame = this.frame;
        mat4.copy(frame.worldMatrix, worldMatrix);
        frame.inverseWorldMatrix = mat4.invert(this.inverse, worldMatrix);
        vec3.copy(frame.gravity, gravity);
        frame.scale = this.document.scale * playback.scale;
        const px = worldMatrix[12];
        const py = worldMatrix[13];
        const pz = worldMatrix[14];
        let distance = 0;
        if (this.hasPreviousPosition && deltaSeconds > 0) {
            const dx = px - this.previousPosition[0];
            const dy = py - this.previousPosition[1];
            const dz = pz - this.previousPosition[2];
            distance = Math.hypot(dx, dy, dz);
            if (distance > TELEPORT_DISTANCE) {
                distance = 0;
                vec3.set(frame.actorVelocity, 0, 0, 0);
            }
            else {
                vec3.set(frame.actorVelocity, dx / deltaSeconds, dy / deltaSeconds, dz / deltaSeconds);
            }
        }
        else {
            vec3.set(frame.actorVelocity, 0, 0, 0);
        }
        vec3.set(this.previousPosition, px, py, pz);
        this.hasPreviousPosition = true;
        const total = Math.min(deltaSeconds * playback.timeScale, MAX_STEP * MAX_SUBSTEPS);
        if (total <= 0)
            return;
        const substeps = Math.min(MAX_SUBSTEPS, Math.max(1, Math.ceil(total / MAX_STEP)));
        const dt = total / substeps;
        frame.actorDistance = distance / substeps;
        for (let i = 0; i < substeps; i++)
            this.advance(dt, playback);
    }
    private advance(dt: number, playback: VfxPlayback): void {
        const { document, frame } = this;
        const loop = playback.loop ?? document.loop;
        this.time += dt;
        this.clock += dt;
        if (loop && this.time >= document.duration && document.duration > 0) {
            this.time -= document.duration * Math.floor(this.time / document.duration);
            this.cycle++;
            for (const simulator of this.simulators)
                simulator.resetCycle();
        }
        frame.time = this.time;
        frame.clock = this.clock;
        for (const simulator of this.simulators)
            simulator.step(dt, frame, document, this.cycle);
        if (!loop && this.time > document.duration) {
            this.state = this.alive > 0 ? 'playing' : 'finished';
        }
    }
}
