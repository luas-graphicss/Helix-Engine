import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import * as mat3 from '@/engine/core/math/mat3';
import { clamp } from '@/engine/core/math/scalar';
import type { RigidBody } from '@/engine/physics/body/rigid-body';
import { shapeVolume } from '@/engine/physics/shapes/collider-shape';
import type { ForceField } from '@/engine/physics/world/force-field';
import { FRESH_WATER_DENSITY, type PhysicsSettings } from '@/engine/physics/world/physics-settings';
import { createWaterSample, type WaterSample } from '@/engine/terrain/water/water-surface';
import { SHAPE_SAMPLE_COUNT, sampleShapePoints } from './shape-samples';
import type { WaterVolume } from './water-volume';
const MAX_DRAG_PER_STEP = 0.5;
const VISCOUS_RATE = 1;
const FORM_DRAG_COEFFICIENT = 1;
const WAKE_MARGIN = 0.05;
const CACHE_STRIDE = 4;
const CACHE_PRUNE_INTERVAL = 120;
interface BodySamples {
    volume: WaterVolume | null;
    step: number;
    readonly data: Float32Array;
}
const worldPoint = vec3.create();
const lever = vec3.create();
const pointVelocity = vec3.create();
const relativeVelocity = vec3.create();
const impulse = vec3.create();
const totalImpulse = vec3.create();
const torque = vec3.create();
const angularDelta = vec3.create();
const samplePoints: Vec3[] = Array.from({ length: SHAPE_SAMPLE_COUNT }, () => vec3.create());
export class BuoyancyField implements ForceField {
    private readonly sample: WaterSample = createWaterSample();
    private readonly cache = new Map<RigidBody, BodySamples>();
    private step = 0;
    constructor(private readonly volumes: () => Iterable<WaterVolume>, private readonly settings: PhysicsSettings) { }
    wakeAffected(bodies: readonly RigidBody[]): void {
        for (const body of bodies) {
            if (!body.sleeping || !body.isDynamic || body.outOfBounds)
                continue;
            for (const volume of this.volumes()) {
                if (this.withinReach(body, volume, WAKE_MARGIN)) {
                    body.wake();
                    break;
                }
            }
        }
    }
    beginStep(): void {
        this.step++;
        if (this.step % CACHE_PRUNE_INTERVAL !== 0)
            return;
        for (const [body, samples] of this.cache) {
            if (samples.step < this.step - 1)
                this.cache.delete(body);
        }
    }
    apply(bodies: readonly RigidBody[], h: number, time: number): void {
        const density = Math.max(this.settings.waterDensity, 0);
        const gravity = -this.settings.gravity[1];
        if (density <= 0 || gravity <= 0)
            return;
        for (const body of bodies) {
            if (!body.isSimulated)
                continue;
            for (const volume of this.volumes()) {
                if (this.withinReach(body, volume, 0))
                    this.applyVolume(body, volume, density, gravity, h, time);
            }
        }
    }
    private withinReach(body: RigidBody, volume: WaterVolume, margin: number): boolean {
        if (!volume.containsHorizontally(body.position))
            return false;
        return body.position[1] - body.maxExtent < volume.maxSurfaceHeight(body.position) + margin;
    }
    private samplesFor(body: RigidBody): BodySamples {
        let samples = this.cache.get(body);
        if (!samples) {
            samples = { volume: null, step: -1, data: new Float32Array(SHAPE_SAMPLE_COUNT * CACHE_STRIDE) };
            this.cache.set(body, samples);
        }
        return samples;
    }
    private applyVolume(body: RigidBody, volume: WaterVolume, density: number, gravity: number, h: number, time: number): void {
        const shape = body.shape;
        const totalVolume = shapeVolume(shape);
        if (totalVolume <= 0)
            return;
        const points = sampleShapePoints(samplePoints, shape);
        const pointVolume = totalVolume / points.length;
        const halfEdge = Math.max(Math.cbrt(pointVolume) * 0.5, 0.005);
        const pointArea = 4 * halfEdge * halfEdge;
        const pointMass = body.mass / points.length;
        const drag = Math.max(this.settings.waterDrag, 0);
        const viscous = density * pointVolume * VISCOUS_RATE * drag;
        const form = 0.5 * density * FORM_DRAG_COEFFICIENT * pointArea * drag;
        const samples = this.samplesFor(body);
        const fresh = samples.step !== this.step || samples.volume !== volume;
        if (fresh) {
            samples.step = this.step;
            samples.volume = volume;
            volume.beginBody(body.position, time);
        }
        const data = samples.data;
        const sample = this.sample;
        let submerged = 0;
        vec3.set(totalImpulse, 0, 0, 0);
        vec3.set(torque, 0, 0, 0);
        for (let i = 0; i < points.length; i++) {
            mat3.transformVec3(worldPoint, body.rotation, points[i]);
            vec3.add(worldPoint, worldPoint, body.position);
            const offset = i * CACHE_STRIDE;
            if (fresh) {
                if (volume.sampleAt(sample, worldPoint, time)) {
                    data[offset] = sample.height;
                    data[offset + 1] = sample.velocity[0];
                    data[offset + 2] = sample.velocity[1];
                    data[offset + 3] = sample.velocity[2];
                }
                else {
                    data[offset] = Number.NaN;
                }
            }
            const waterHeight = data[offset];
            if (Number.isNaN(waterHeight))
                continue;
            const coverage = clamp((waterHeight - worldPoint[1] + halfEdge) / (2 * halfEdge), 0, 1);
            if (coverage <= 0)
                continue;
            submerged += coverage;
            vec3.subtract(lever, worldPoint, body.position);
            vec3.cross(pointVelocity, body.angularVelocity, lever);
            vec3.add(pointVelocity, pointVelocity, body.linearVelocity);
            vec3.set(relativeVelocity, pointVelocity[0] - data[offset + 1], pointVelocity[1] - data[offset + 2], pointVelocity[2] - data[offset + 3]);
            const speed = vec3.length(relativeVelocity);
            const dragPerSpeed = coverage * (viscous + form * speed);
            const dragFraction = Math.min(1 - 1 / (1 + (dragPerSpeed * h) / pointMass), MAX_DRAG_PER_STEP);
            const dragImpulse = dragFraction * pointMass;
            impulse[0] = -relativeVelocity[0] * dragImpulse;
            impulse[1] = density * pointVolume * gravity * coverage * h - relativeVelocity[1] * dragImpulse;
            impulse[2] = -relativeVelocity[2] * dragImpulse;
            vec3.add(totalImpulse, totalImpulse, impulse);
            vec3.cross(pointVelocity, lever, impulse);
            vec3.add(torque, torque, pointVelocity);
        }
        if (submerged <= 0)
            return;
        vec3.scaleAndAdd(body.linearVelocity, body.linearVelocity, totalImpulse, body.invMass);
        mat3.transformVec3(angularDelta, body.invInertiaWorld, torque);
        vec3.add(body.angularVelocity, body.angularVelocity, angularDelta);
        const submergedFraction = submerged / points.length;
        const angularRate = Math.max(this.settings.waterAngularDrag, 0) * VISCOUS_RATE * submergedFraction * (density / FRESH_WATER_DENSITY);
        vec3.scale(body.angularVelocity, body.angularVelocity, 1 / (1 + angularRate * h));
        body.sleepTime = 0;
    }
}
