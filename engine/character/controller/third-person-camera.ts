import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import * as aabb from '@/engine/core/math/aabb';
import { clamp, DEG_TO_RAD } from '@/engine/core/math/scalar';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import type { PhysicsWorld } from '@/engine/physics/world/physics-world';
import type { RigidBody } from '@/engine/physics/body/rigid-body';
import { createSphereShape } from '@/engine/physics/shapes/collider-shape';
import { ContactResult } from '@/engine/physics/collision/manifold';
import { collideSphereWithBody } from '@/engine/physics/collision/narrowphase';
import { createPlayerCameraSettings, type PlayerCameraSettings } from '@/engine/character/player-settings';
import type { TerrainCollider } from './terrain-collider';
const ZOOM_RATE = 0.0012;
const PROBE_RADIUS = 0.22;
const PROBE_STEPS = 12;
const PIVOT_RATE = 10;
const RETREAT_RATE = 4;
export class ThirdPersonCamera {
    yaw = 0;
    pitch: number;
    distance: number;
    private currentDistance: number;
    private pivotHeight = 1.5;
    private readonly pivot = vec3.create();
    private readonly forward = vec3.create();
    private readonly probe = vec3.create();
    private readonly probeNormal = vec3.create();
    private readonly probeBox = aabb.create();
    private readonly sphere = createSphereShape(PROBE_RADIUS);
    private readonly result = new ContactResult();
    private except: RigidBody | null = null;
    private blocked = false;
    constructor(private readonly settings: PlayerCameraSettings = createPlayerCameraSettings()) {
        this.pitch = clamp(settings.pitch, settings.minPitch, settings.maxPitch);
        this.distance = clamp(settings.distance, settings.minDistance, settings.maxDistance);
        this.currentDistance = this.distance;
    }
    rotate(deltaX: number, deltaY: number): void {
        const { sensitivity, invertY, minPitch, maxPitch } = this.settings;
        this.yaw -= deltaX * sensitivity;
        const pitchDelta = deltaY * sensitivity * (invertY ? 1 : -1);
        this.pitch = clamp(this.pitch + pitchDelta, minPitch, maxPitch);
    }
    zoom(deltaWheel: number): void {
        if (deltaWheel === 0)
            return;
        const { minDistance, maxDistance } = this.settings;
        this.distance = clamp(this.distance * Math.exp(deltaWheel * ZOOM_RATE), minDistance, maxDistance);
    }
    moveBasis(outForward: Vec3, outRight: Vec3): void {
        const yaw = this.yaw * DEG_TO_RAD;
        const sin = Math.sin(yaw);
        const cos = Math.cos(yaw);
        vec3.set(outForward, sin, 0, cos);
        vec3.set(outRight, -cos, 0, sin);
    }
    update(dt: number, feet: Vec3, characterHeight: number, world: PhysicsWorld, except: RigidBody, terrain: TerrainCollider, camera: PerspectiveCamera): void {
        const { settings } = this;
        this.pitch = clamp(this.pitch, settings.minPitch, settings.maxPitch);
        this.distance = clamp(this.distance, settings.minDistance, settings.maxDistance);
        const targetPivot = characterHeight * settings.pivotHeight;
        this.pivotHeight += (targetPivot - this.pivotHeight) * (1 - Math.exp(-PIVOT_RATE * dt));
        vec3.set(this.pivot, feet[0], feet[1] + this.pivotHeight, feet[2]);
        const yaw = this.yaw * DEG_TO_RAD;
        const pitch = this.pitch * DEG_TO_RAD;
        const cosPitch = Math.cos(pitch);
        vec3.set(this.forward, Math.sin(yaw) * cosPitch, Math.sin(pitch), Math.cos(yaw) * cosPitch);
        this.except = except;
        let free = this.distance;
        for (let step = 1; step <= PROBE_STEPS; step++) {
            const reach = (this.distance * step) / PROBE_STEPS;
            vec3.scaleAndAdd(this.probe, this.pivot, this.forward, -reach);
            if (this.isBlocked(world, terrain)) {
                free = Math.max((this.distance * (step - 1)) / PROBE_STEPS, settings.minDistance * 0.5);
                break;
            }
        }
        if (free < this.currentDistance)
            this.currentDistance = free;
        else
            this.currentDistance += (free - this.currentDistance) * (1 - Math.exp(-RETREAT_RATE * dt));
        vec3.scaleAndAdd(camera.position, this.pivot, this.forward, -this.currentDistance);
        vec3.copy(camera.target, this.pivot);
    }
    private isBlocked(world: PhysicsWorld, terrain: TerrainCollider): boolean {
        const p = this.probe;
        const height = terrain.sample(p[0], p[2], this.probeNormal);
        if (height !== null && p[1] - PROBE_RADIUS < height)
            return true;
        const box = this.probeBox;
        vec3.set(box.min, p[0] - PROBE_RADIUS, p[1] - PROBE_RADIUS, p[2] - PROBE_RADIUS);
        vec3.set(box.max, p[0] + PROBE_RADIUS, p[1] + PROBE_RADIUS, p[2] + PROBE_RADIUS);
        this.blocked = false;
        world.queryAabb(box, this.except, this.visitBody);
        return this.blocked;
    }
    private readonly visitBody = (body: RigidBody): void => {
        if (this.blocked || body.isDynamic || body.shape.kind === 'heightfield')
            return;
        if (!collideSphereWithBody(this.probe, this.sphere, body, 0, this.result))
            return;
        for (let i = 0; i < this.result.count; i++) {
            if (this.result.points[i].separation < 0) {
                this.blocked = true;
                return;
            }
        }
    };
}
