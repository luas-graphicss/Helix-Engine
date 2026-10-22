import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import * as quat from '@/engine/core/math/quat';
import * as mat3 from '@/engine/core/math/mat3';
import * as aabb from '@/engine/core/math/aabb';
import { clamp, DEG_TO_RAD, RAD_TO_DEG } from '@/engine/core/math/scalar';
import type { PhysicsWorld } from '@/engine/physics/world/physics-world';
import type { RigidBody } from '@/engine/physics/body/rigid-body';
import { createCapsuleShape, type CapsuleShape } from '@/engine/physics/shapes/collider-shape';
import { ContactResult } from '@/engine/physics/collision/manifold';
import { collideCapsuleWithBody } from '@/engine/physics/collision/narrowphase';
import type { CharacterSettings } from '../character-settings';
import type { TerrainCollider } from './terrain-collider';
export interface CharacterIntent {
    readonly move: Vec3;
    run: boolean;
    crouch: boolean;
    jump: boolean;
}
interface Contact {
    readonly normal: Vec3;
    separation: number;
    body: RigidBody | null;
}
const SKIN = 0.015;
const RESOLVE_ITERATIONS = 4;
const GROUND_SNAP = 0.3;
const STEP_PROBE_EXTRA = 0.05;
const COYOTE_TIME = 0.12;
const JUMP_BUFFER_TIME = 0.15;
const MIN_GRAVITY = 0.5;
const TERMINAL_SPEED = 55;
const CEILING_COSINE = -0.3;
const MAX_CONTACTS = 24;
const PUSH_MIN_HORIZONTAL = 0.3;
const PUSH_RESPONSE = 0.35;
const PUSH_ACCELERATION = 12;
const PUSH_REACH = SKIN * 3;
const UPRIGHT = mat3.create();
function approachAngle(current: number, target: number, maxDelta: number): number {
    let delta = (target - current) % 360;
    if (delta > 180)
        delta -= 360;
    else if (delta < -180)
        delta += 360;
    return current + clamp(delta, -maxDelta, maxDelta);
}
export class CharacterController {
    readonly position = vec3.create();
    readonly previousPosition = vec3.create();
    readonly velocity = vec3.create();
    readonly groundNormal = vec3.create(0, 1, 0);
    yaw = 0;
    previousYaw = 0;
    grounded = false;
    crouching = false;
    jumped = false;
    landed = false;
    landingSpeed = 0;
    readonly intent: CharacterIntent = { move: vec3.create(), run: false, crouch: false, jump: false };
    private body: RigidBody;
    private capsule: CapsuleShape;
    private readonly standingCapsule: CapsuleShape;
    private readonly crouchingCapsule: CapsuleShape;
    private coyoteTime = 0;
    private jumpBufferTime = 0;
    private queryMargin = 0;
    private contactCount = 0;
    private stepDuration = 0;
    private readonly contacts: Contact[] = [];
    private readonly result = new ContactResult();
    private readonly queryBox = aabb.create();
    private readonly orientation = quat.create();
    private readonly center = vec3.create();
    private readonly start = vec3.create();
    private readonly trial = vec3.create();
    private readonly terrainNormal = vec3.create();
    private readonly probeNormal = vec3.create();
    private readonly scratch = vec3.create();
    private readonly desiredVelocity = vec3.create();
    private readonly pushImpulse = vec3.create();
    constructor(private readonly world: PhysicsWorld, readonly settings: CharacterSettings, private readonly terrain: TerrainCollider, position: Vec3, yaw: number) {
        vec3.copy(this.position, position);
        vec3.copy(this.previousPosition, position);
        this.yaw = this.previousYaw = yaw;
        this.standingCapsule = this.makeCapsule(settings.height);
        this.crouchingCapsule = this.makeCapsule(settings.crouchHeight);
        this.capsule = this.standingCapsule;
        for (let i = 0; i < MAX_CONTACTS; i++)
            this.contacts.push({ normal: vec3.create(), separation: 0, body: null });
        this.body = this.createBody();
    }
    get height(): number {
        return 2 * (this.capsule.halfHeight + this.capsule.radius);
    }
    get rigidBody(): RigidBody {
        return this.body;
    }
    get horizontalSpeed(): number {
        return Math.hypot(this.velocity[0], this.velocity[2]);
    }
    dispose(): void {
        this.world.removeBody(this.body);
    }
    consumeEvents(): void {
        this.jumped = false;
        this.landed = false;
    }
    step(h: number): void {
        const { settings, intent, velocity } = this;
        vec3.copy(this.previousPosition, this.position);
        this.previousYaw = this.yaw;
        this.stepDuration = h;
        let jumpedNow = false;
        const wasGrounded = this.grounded;
        const g = Math.max(-this.world.settings.gravity[1], MIN_GRAVITY);
        if (intent.crouch !== this.crouching && (intent.crouch || this.hasHeadroom()))
            this.setCrouching(intent.crouch);
        if (intent.jump) {
            this.jumpBufferTime = JUMP_BUFFER_TIME;
            intent.jump = false;
        }
        else {
            this.jumpBufferTime = Math.max(this.jumpBufferTime - h, 0);
        }
        this.coyoteTime = wasGrounded ? COYOTE_TIME : Math.max(this.coyoteTime - h, 0);
        const move = intent.move;
        const hasInput = Math.hypot(move[0], move[2]) > 0.01;
        const maxSpeed = this.crouching ? settings.crouchSpeed : intent.run ? settings.runSpeed : settings.walkSpeed;
        const rate = wasGrounded ? (hasInput ? settings.acceleration : settings.braking) : hasInput ? settings.acceleration * settings.airControl : 0;
        vec3.set(this.desiredVelocity, move[0] * maxSpeed, 0, move[2] * maxSpeed);
        const dx = this.desiredVelocity[0] - velocity[0];
        const dz = this.desiredVelocity[2] - velocity[2];
        const delta = Math.hypot(dx, dz);
        if (delta > 0 && rate > 0) {
            const fraction = Math.min(1, (rate * h) / delta);
            velocity[0] += dx * fraction;
            velocity[2] += dz * fraction;
        }
        if (hasInput)
            this.yaw = approachAngle(this.yaw, Math.atan2(move[0], move[2]) * RAD_TO_DEG, settings.rotationRate * h);
        if (this.jumpBufferTime > 0 && (wasGrounded || this.coyoteTime > 0)) {
            if (this.crouching && this.hasHeadroom())
                this.setCrouching(false);
            if (!this.crouching) {
                velocity[1] = Math.sqrt(2 * g * Math.max(settings.jumpHeight, 0));
                this.grounded = false;
                this.coyoteTime = 0;
                this.jumpBufferTime = 0;
                this.jumped = jumpedNow = true;
            }
        }
        if (this.grounded)
            velocity[1] = 0;
        else
            velocity[1] = Math.max(velocity[1] - g * h, -TERMINAL_SPEED);
        this.moveHorizontal(velocity[0] * h, velocity[2] * h, wasGrounded);
        if (!this.grounded)
            this.moveVertical(velocity[1] * h);
        const fallingSpeed = -velocity[1];
        if (jumpedNow || velocity[1] > 0)
            this.grounded = false;
        else
            this.probeGround(wasGrounded ? GROUND_SNAP : SKIN * 2);
        if (this.grounded) {
            if (!wasGrounded) {
                this.landed = true;
                this.landingSpeed = Math.max(fallingSpeed, 0);
            }
            velocity[1] = 0;
        }
        this.capsuleCenter(this.position, this.center);
        this.body.moveKinematic(this.center, this.orientation, h);
    }
    private makeCapsule(height: number): CapsuleShape {
        const { radius } = this.settings;
        return createCapsuleShape(radius, Math.max(height, 2 * radius + 0.01) / 2 - radius);
    }
    private capsuleCenter(feet: Vec3, out: Vec3): Vec3 {
        return vec3.set(out, feet[0], feet[1] + this.capsule.halfHeight + this.capsule.radius, feet[2]);
    }
    private createBody(): RigidBody {
        this.capsuleCenter(this.position, this.center);
        return this.world.createBody({
            type: 'kinematic',
            shape: this.capsule,
            position: this.center,
            orientation: this.orientation,
            mass: this.settings.mass,
            friction: 0.2,
            restitution: 0,
            linearDamping: 0,
            angularDamping: 0,
            gravityScale: 0,
            canSleep: false,
        });
    }
    private setCrouching(crouching: boolean): void {
        this.crouching = crouching;
        this.capsule = crouching ? this.crouchingCapsule : this.standingCapsule;
        this.world.removeBody(this.body);
        this.body = this.createBody();
    }
    private hasHeadroom(): boolean {
        const current = this.capsule;
        this.capsule = this.standingCapsule;
        this.gatherContacts(this.position, 0);
        this.capsule = current;
        for (let i = 0; i < this.contactCount; i++) {
            const contact = this.contacts[i];
            if (contact.separation < 0 && contact.normal[1] < 0.5)
                return false;
        }
        return true;
    }
    private moveHorizontal(dx: number, dz: number, canStep: boolean): void {
        let px = dx;
        let py = 0;
        let pz = dz;
        const n = this.groundNormal;
        if (this.grounded && n[1] > 0.001) {
            const into = dx * n[0] + dz * n[2];
            px = dx - n[0] * into;
            py = -n[1] * into;
            pz = dz - n[2] * into;
            const length = Math.hypot(px, py, pz);
            const wanted = Math.hypot(dx, dz);
            if (length > 1e-9) {
                const scale = wanted / length;
                px *= scale;
                py *= scale;
                pz *= scale;
            }
        }
        const position = this.position;
        vec3.copy(this.start, position);
        position[0] += px;
        position[1] += py;
        position[2] += pz;
        const hitWall = this.resolve(position, true);
        if (!hitWall || !canStep || this.settings.stepHeight <= 0)
            return;
        const stepHeight = this.settings.stepHeight;
        const trial = this.trial;
        vec3.set(trial, this.start[0] + px, this.start[1] + py + stepHeight, this.start[2] + pz);
        if (this.resolve(trial, false))
            return;
        const gap = this.groundGap(trial, stepHeight + STEP_PROBE_EXTRA);
        if (gap === null)
            return;
        const landingY = trial[1] - (gap - SKIN);
        if (landingY < this.start[1] - 1e-3)
            return;
        const slidProgress = (position[0] - this.start[0]) * dx + (position[2] - this.start[2]) * dz;
        const trialProgress = (trial[0] - this.start[0]) * dx + (trial[2] - this.start[2]) * dz;
        if (trialProgress <= slidProgress + 1e-6)
            return;
        vec3.set(position, trial[0], landingY, trial[2]);
    }
    private moveVertical(dy: number): void {
        const maxChunk = this.settings.radius * 0.5;
        let remaining = dy;
        while (Math.abs(remaining) > 1e-6) {
            const chunk = clamp(remaining, -maxChunk, maxChunk);
            this.position[1] += chunk;
            remaining -= chunk;
            this.resolve(this.position, true);
            if ((chunk < 0 && this.velocity[1] >= 0) || (chunk > 0 && this.velocity[1] <= 0))
                break;
        }
    }
    private resolve(feet: Vec3, adjustVelocity: boolean): boolean {
        const cosSlope = Math.cos(this.settings.maxSlopeDegrees * DEG_TO_RAD);
        let hitWall = false;
        for (let iteration = 0; iteration < RESOLVE_ITERATIONS; iteration++) {
            this.gatherContacts(feet, Math.max(SKIN, PUSH_REACH));
            if (iteration === 0 && adjustVelocity)
                this.pushBodies();
            let deepest: Contact | null = null;
            for (let i = 0; i < this.contactCount; i++) {
                const contact = this.contacts[i];
                if (deepest === null || contact.separation < deepest.separation)
                    deepest = contact;
            }
            const bodyPenetration = deepest ? SKIN - deepest.separation : 0;
            const terrainPenetration = this.terrainPenetration(feet) ?? 0;
            if (bodyPenetration <= 1e-4 && terrainPenetration <= 1e-4)
                break;
            if (terrainPenetration > bodyPenetration) {
                const n = this.terrainNormal;
                if (n[1] >= cosSlope)
                    feet[1] += terrainPenetration / n[1];
                else
                    vec3.scaleAndAdd(feet, feet, n, terrainPenetration);
                if (adjustVelocity)
                    this.removeVelocityInto(n);
            }
            else if (deepest) {
                const n = deepest.normal;
                vec3.scaleAndAdd(feet, feet, n, bodyPenetration);
                if (adjustVelocity)
                    this.removeVelocityInto(n);
                if (n[1] < cosSlope && n[1] > CEILING_COSINE)
                    hitWall = true;
            }
        }
        return hitWall;
    }
    private removeVelocityInto(normal: Vec3): void {
        const v = this.velocity;
        const into = vec3.dot(v, normal);
        if (into < 0)
            vec3.scaleAndAdd(v, v, normal, -into);
    }
    private pushBodies(): void {
        const desired = this.desiredVelocity;
        if (desired[0] === 0 && desired[2] === 0)
            return;
        const maxImpulse = this.settings.mass * PUSH_ACCELERATION * this.stepDuration;
        const impulse = this.pushImpulse;
        for (let i = 0; i < this.contactCount; i++) {
            const contact = this.contacts[i];
            const { body, normal } = contact;
            if (!body || contact.separation > PUSH_REACH)
                continue;
            let px = -normal[0];
            let pz = -normal[2];
            const horizontal = Math.hypot(px, pz);
            if (horizontal < PUSH_MIN_HORIZONTAL)
                continue;
            px /= horizontal;
            pz /= horizontal;
            const approach = desired[0] * px + desired[2] * pz - (body.linearVelocity[0] * px + body.linearVelocity[2] * pz);
            if (approach <= 0)
                continue;
            const magnitude = Math.min(body.mass * approach * PUSH_RESPONSE, maxImpulse);
            body.applyImpulse(vec3.set(impulse, px * magnitude, 0, pz * magnitude));
        }
    }
    private terrainPenetration(feet: Vec3): number | null {
        if (this.terrain.isEmpty)
            return null;
        const radius = this.capsule.radius;
        const n = this.terrainNormal;
        if (this.terrain.sample(feet[0], feet[2], n) === null)
            return null;
        const contactX = feet[0] - n[0] * radius;
        const contactY = feet[1] + radius - n[1] * radius;
        const contactZ = feet[2] - n[2] * radius;
        const surface = this.terrain.sample(contactX, contactZ, this.scratch);
        if (surface === null)
            return null;
        vec3.copy(n, this.scratch);
        return (surface - contactY) * n[1] + SKIN;
    }
    private groundGap(feet: Vec3, maxDistance: number): number | null {
        const cosSlope = Math.cos(this.settings.maxSlopeDegrees * DEG_TO_RAD);
        let gap: number | null = null;
        this.gatherContacts(feet, maxDistance);
        for (let i = 0; i < this.contactCount; i++) {
            const contact = this.contacts[i];
            if (contact.normal[1] < cosSlope)
                continue;
            const vertical = contact.separation / contact.normal[1];
            if (gap === null || vertical < gap) {
                gap = vertical;
                vec3.copy(this.probeNormal, contact.normal);
            }
        }
        const penetration = this.terrainPenetration(feet);
        if (penetration !== null && this.terrainNormal[1] >= cosSlope) {
            const terrainGap = (SKIN - penetration) / this.terrainNormal[1];
            if (terrainGap <= maxDistance && (gap === null || terrainGap < gap)) {
                gap = terrainGap;
                vec3.copy(this.probeNormal, this.terrainNormal);
            }
        }
        return gap !== null && gap <= maxDistance ? gap : null;
    }
    private probeGround(maxDistance: number): void {
        const gap = this.groundGap(this.position, maxDistance);
        if (gap === null) {
            this.grounded = false;
            return;
        }
        this.position[1] -= gap - SKIN;
        this.grounded = true;
        vec3.copy(this.groundNormal, this.probeNormal);
    }
    private gatherContacts(feet: Vec3, margin: number): void {
        this.capsuleCenter(feet, this.center);
        const { capsule, center, queryBox } = this;
        const lateral = capsule.radius + margin;
        const vertical = capsule.halfHeight + capsule.radius + margin;
        vec3.set(queryBox.min, center[0] - lateral, center[1] - vertical, center[2] - lateral);
        vec3.set(queryBox.max, center[0] + lateral, center[1] + vertical, center[2] + lateral);
        this.queryMargin = margin;
        this.contactCount = 0;
        this.world.queryAabb(queryBox, this.body, this.visitBody);
    }
    private readonly visitBody = (other: RigidBody): void => {
        if (this.contactCount >= MAX_CONTACTS)
            return;
        if (other.shape.kind === 'heightfield')
            return;
        const { result } = this;
        if (!collideCapsuleWithBody(this.center, UPRIGHT, this.capsule, other, this.queryMargin, result))
            return;
        let separation = Infinity;
        for (let i = 0; i < result.count; i++)
            separation = Math.min(separation, result.points[i].separation);
        const contact = this.contacts[this.contactCount++];
        vec3.scale(contact.normal, result.normal, -1);
        contact.separation = separation;
        contact.body = other.isDynamic ? other : null;
    };
}
