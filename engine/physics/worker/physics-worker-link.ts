import * as vec3 from '@/engine/core/math/vec3';
import type { RigidBody } from '@/engine/physics/body/rigid-body';
import { Manifold } from '@/engine/physics/collision/manifold';
import type { Joint } from '@/engine/physics/joints/joint';
import { cloneJointDefinition } from '@/engine/physics/joints/joint-settings';
import { MAX_CATCH_UP_TIMESTEP, type PhysicsBackend, type PhysicsRemote, type PhysicsWorld } from '@/engine/physics/world/physics-world';
import { POSE_BUFFER_INITIAL_CAPACITY, POSE_SLOT_FLOATS, PoseBuffer, poseSlot } from './pose-buffer';
import { CONTACT_RECORD_FLOATS, JOINT_RECORD_FLOATS, cloneSettings, encodeBody, encodeJoint, quadruple, settingsSignature, triple, type PhysicsAdvanceRequest, type PhysicsCommand, type PhysicsFrameReply, type PhysicsReply, type PhysicsRequest, type WaterTerrainRecord, } from './physics-protocol';
export interface PhysicsChannel {
    post(request: PhysicsRequest, transfer: Transferable[]): void;
    onReply(handler: (reply: PhysicsReply) => void): void;
    onFailure(handler: (message: string) => void): void;
    close(): void;
}
export function createPhysicsWorkerChannel(): PhysicsChannel {
    if (typeof Worker === 'undefined')
        throw new Error('este ambiente não tem Web Workers; a física fica nesta thread.');
    const worker = new Worker(new URL('./physics-worker.ts', import.meta.url), { type: 'module', name: 'helix-physics' });
    return {
        post: (request, transfer) => worker.postMessage(request, transfer),
        onReply: (handler) => {
            worker.onmessage = (event: MessageEvent<PhysicsReply>) => handler(event.data);
        },
        onFailure: (handler) => {
            worker.onerror = (event) => handler(event.message || 'o worker de física falhou.');
            worker.onmessageerror = () => handler('uma mensagem do worker de física não pôde ser decodificada.');
        },
        close: () => worker.terminate(),
    };
}
interface BodyMirror {
    readonly body: RigidBody;
    readonly slot: number;
    fresh: boolean;
    teleported: boolean;
    sentPose: Float32Array | null;
    sentVelocity: Float32Array | null;
    friction: number;
    restitution: number;
    linearDamping: number;
    angularDamping: number;
    gravityScale: number;
    canSleep: boolean;
    layer: number;
    collisionMask: number;
    impulse: Float32Array | null;
    hasImpulse: boolean;
}
interface JointMirror {
    readonly joint: Joint;
    version: number;
    broken: boolean;
    removed: boolean;
}
const MAX_PENDING_SECONDS = 0.25;
const MIN_WORKER_BUDGET_MS = 6;
const STALL_MS = 2500;
const READY_TIMEOUT_MS = 10000;
function pairKey(a: number, b: number): number {
    return a < b ? a * 0x100000 + b : b * 0x100000 + a;
}
export class PhysicsWorkerLink implements PhysicsRemote {
    private readonly mirrors = new Map<number, BodyMirror>();
    private readonly jointMirrors = new Map<number, JointMirror>();
    private readonly freeSlots: number[] = [];
    private nextSlot = 0;
    private capacity = POSE_BUFFER_INITIAL_CAPACITY;
    private readonly shared: boolean;
    private poses: PoseBuffer;
    private baseline: Float32Array;
    private recycle: ArrayBuffer | null = null;
    private pendingCommands: PhysicsCommand[] = [];
    private pendingTransfer: Transferable[] = [];
    private pendingDelta = 0;
    private hookSeconds = 0;
    private pendingWater: WaterTerrainRecord[] | null = null;
    private ready = false;
    private inFlight = false;
    private failed = false;
    private frame = 0;
    private sentAt = 0;
    private readonly createdAt = performance.now();
    private lastSteps = 0;
    private interpolationValue = 0;
    private settingsSig = '';
    private layersVersion = -1;
    private readonly manifolds = new Map<number, Manifold>();
    private readonly manifoldList: Manifold[] = [];
    private readonly frameListeners: (() => void)[] = [];
    constructor(private readonly world: PhysicsWorld, readonly backend: Exclude<PhysicsBackend, 'local'>, private readonly channel: PhysicsChannel) {
        this.shared = backend === 'worker-shared';
        this.poses = PoseBuffer.allocate(this.capacity, this.shared);
        this.baseline = new Float32Array(this.capacity * POSE_SLOT_FLOATS);
        channel.onReply((reply) => this.receive(reply));
        channel.onFailure((message) => this.fail(message));
        this.settingsSig = settingsSignature(world.settings);
        this.layersVersion = world.layers.version;
        channel.post({ type: 'init', settings: cloneSettings(world.settings), layers: world.layers.snapshot(), buffer: this.poses.buffer }, this.shared ? [] : [this.poses.buffer as ArrayBuffer]);
        for (const body of world.bodies)
            this.bodyCreated(body);
        for (const joint of world.joints)
            this.jointCreated(joint);
    }
    get interpolation(): number {
        return this.interpolationValue;
    }
    get busy(): boolean {
        return this.inFlight || !this.ready;
    }
    onceFrame(listener: () => void): void {
        this.frameListeners.push(listener);
    }
    bodyCreated(body: RigidBody): void {
        if (this.mirrors.has(body.id))
            return;
        const slot = this.freeSlots.pop() ?? this.nextSlot++;
        if (slot >= this.capacity)
            this.grow(slot + 1);
        this.mirrors.set(body.id, {
            body,
            slot,
            fresh: true,
            teleported: false,
            sentPose: null,
            sentVelocity: null,
            friction: body.friction,
            restitution: body.restitution,
            linearDamping: body.linearDamping,
            angularDamping: body.angularDamping,
            gravityScale: body.gravityScale,
            canSleep: body.canSleep,
            layer: body.layer,
            collisionMask: body.collisionMask,
            impulse: null,
            hasImpulse: false,
        });
        this.pendingCommands.push({ op: 'create', body: encodeBody(body, slot, this.pendingTransfer) });
    }
    jointCreated(joint: Joint): void {
        if (this.jointMirrors.has(joint.id))
            return;
        const mirror: JointMirror = { joint, version: joint.version, broken: joint.broken, removed: joint.broken };
        this.jointMirrors.set(joint.id, mirror);
        if (!mirror.removed)
            this.pendingCommands.push({ op: 'joint-create', joint: encodeJoint(joint) });
    }
    jointRemoved(joint: Joint): void {
        const mirror = this.jointMirrors.get(joint.id);
        if (!mirror)
            return;
        this.jointMirrors.delete(joint.id);
        if (!mirror.removed)
            this.pendingCommands.push({ op: 'joint-remove', id: joint.id });
    }
    bodyRemoved(body: RigidBody): void {
        const mirror = this.mirrors.get(body.id);
        if (!mirror)
            return;
        this.mirrors.delete(body.id);
        this.freeSlots.push(mirror.slot);
        this.baseline.fill(0, mirror.slot * POSE_SLOT_FLOATS, (mirror.slot + 1) * POSE_SLOT_FLOATS);
        this.pendingCommands.push({ op: 'remove', id: body.id });
    }
    teleported(body: RigidBody): void {
        const mirror = this.mirrors.get(body.id);
        if (!mirror)
            return;
        mirror.teleported = true;
        mirror.sentPose = null;
        mirror.sentVelocity = null;
        this.pendingCommands.push({ op: 'teleport', id: body.id, position: triple(body.position), orientation: quadruple(body.orientation) });
    }
    cleared(): void {
        this.mirrors.clear();
        this.jointMirrors.clear();
        this.freeSlots.length = 0;
        this.nextSlot = 0;
        this.baseline.fill(0);
        this.manifolds.clear();
        this.manifoldList.length = 0;
        this.pendingCommands = [{ op: 'clear' }];
        this.pendingTransfer = [];
        this.pendingWater = null;
        this.hookSeconds = 0;
        this.pendingDelta = 0;
    }
    setWater(records: WaterTerrainRecord[]): void {
        this.pendingWater = records;
    }
    stepOnce(): void {
        this.pendingCommands.push({ op: 'step' });
        this.flushIfIdle();
    }
    discardAccumulatedTime(): void {
        this.pendingCommands.push({ op: 'discard' });
        this.flushIfIdle();
    }
    advance(deltaSeconds: number): number {
        if (this.failed)
            return 0;
        const { world } = this;
        const dt = Math.max(0, deltaSeconds);
        this.pendingDelta = Math.min(this.pendingDelta + dt, MAX_PENDING_SECONDS);
        const h = Math.min(dt, MAX_CATCH_UP_TIMESTEP);
        if (h > 0) {
            world.runPreStepHooks(h);
            world.applyLocalForceFields(h);
            this.hookSeconds += h;
            this.accumulateForces(h);
        }
        this.watchdog();
        if (this.failed)
            return 0;
        if (!this.ready || this.inFlight) {
            this.resetPerAdvanceStats();
            return 0;
        }
        this.dispatch();
        const steps = this.lastSteps;
        this.lastSteps = 0;
        return steps;
    }
    dispose(): void {
        this.channel.close();
        this.failed = true;
    }
    private grow(minimum: number): void {
        while (this.capacity < minimum)
            this.capacity *= 2;
        const baseline = new Float32Array(this.capacity * POSE_SLOT_FLOATS);
        baseline.set(this.baseline);
        this.baseline = baseline;
        if (this.shared) {
            this.poses = PoseBuffer.allocate(this.capacity, true);
            this.pendingCommands.push({ op: 'buffer', buffer: this.poses.buffer });
        }
    }
    private flushIfIdle(): void {
        if (this.failed || !this.ready || this.inFlight)
            return;
        this.dispatch();
    }
    private dispatch(): void {
        const { world } = this;
        const commands = this.pendingCommands;
        const transfer = this.pendingTransfer;
        this.pendingCommands = [];
        this.pendingTransfer = [];
        const signature = settingsSignature(world.settings);
        if (signature !== this.settingsSig) {
            this.settingsSig = signature;
            commands.push({ op: 'settings', settings: cloneSettings(world.settings) });
        }
        if (world.layers.version !== this.layersVersion) {
            this.layersVersion = world.layers.version;
            commands.push({ op: 'layers', snapshot: world.layers.snapshot() });
        }
        if (this.pendingWater) {
            for (const record of this.pendingWater)
                if (record.heights)
                    transfer.push(record.heights.buffer);
            commands.push({ op: 'water', terrains: this.pendingWater });
            this.pendingWater = null;
        }
        for (const mirror of this.mirrors.values())
            this.diff(mirror, commands);
        for (const mirror of this.jointMirrors.values())
            this.diffJoint(mirror, commands);
        const request: PhysicsAdvanceRequest = {
            type: 'advance',
            frame: ++this.frame,
            commands,
            deltaSeconds: this.pendingDelta,
            time: world.time,
            budgetMs: Math.max(world.stepBudgetMs, MIN_WORKER_BUDGET_MS),
            recycle: this.recycle ?? undefined,
        };
        if (this.recycle) {
            transfer.push(this.recycle);
            this.recycle = null;
        }
        this.pendingDelta = 0;
        this.hookSeconds = 0;
        this.inFlight = true;
        this.sentAt = performance.now();
        this.channel.post(request, transfer);
    }
    private diff(mirror: BodyMirror, commands: PhysicsCommand[]): void {
        const { body, slot } = mirror;
        const data = this.baseline;
        const id = body.id;
        if (mirror.fresh) {
            mirror.fresh = false;
            if (body.isMoving && !body.isKinematic)
                commands.push({ op: 'velocity', id, linear: triple(body.linearVelocity), angular: triple(body.angularVelocity) });
        }
        else if (!mirror.teleported && poseSlot.isValid(data, slot)) {
            if (body.isKinematic) {
                if (poseSlot.poseDiffers(data, slot, body) && !this.matchesSentPose(mirror)) {
                    commands.push({ op: 'kinematic', id, position: triple(body.position), orientation: quadruple(body.orientation), seconds: Math.max(this.hookSeconds, 1e-4) });
                    this.rememberSentPose(mirror);
                }
            }
            else {
                if (poseSlot.poseDiffers(data, slot, body) && !this.matchesSentPose(mirror)) {
                    commands.push({ op: 'pose', id, position: triple(body.position), orientation: quadruple(body.orientation) });
                    this.rememberSentPose(mirror);
                }
                const wasSleeping = poseSlot.wasSleeping(data, slot);
                if (body.sleeping && !wasSleeping) {
                    commands.push({ op: 'sleep', id });
                }
                else if (poseSlot.velocityDiffers(data, slot, body) && !this.matchesSentVelocity(mirror)) {
                    commands.push({ op: 'velocity', id, linear: triple(body.linearVelocity), angular: triple(body.angularVelocity) });
                    this.rememberSentVelocity(mirror);
                }
                else if (!body.sleeping && wasSleeping) {
                    commands.push({ op: 'wake', id });
                }
            }
        }
        mirror.teleported = false;
        if (body.friction !== mirror.friction || body.restitution !== mirror.restitution || body.linearDamping !== mirror.linearDamping ||
            body.angularDamping !== mirror.angularDamping || body.gravityScale !== mirror.gravityScale || body.canSleep !== mirror.canSleep) {
            mirror.friction = body.friction;
            mirror.restitution = body.restitution;
            mirror.linearDamping = body.linearDamping;
            mirror.angularDamping = body.angularDamping;
            mirror.gravityScale = body.gravityScale;
            mirror.canSleep = body.canSleep;
            commands.push({ op: 'material', id, friction: body.friction, restitution: body.restitution, linearDamping: body.linearDamping, angularDamping: body.angularDamping, gravityScale: body.gravityScale, canSleep: body.canSleep });
        }
        if (body.layer !== mirror.layer || body.collisionMask !== mirror.collisionMask) {
            mirror.layer = body.layer;
            mirror.collisionMask = body.collisionMask;
            commands.push({ op: 'layers-of', id, layer: body.layer, collisionMask: body.collisionMask });
        }
        if (mirror.hasImpulse && mirror.impulse) {
            const seconds = Math.max(this.hookSeconds, 1e-4);
            const inv = 1 / seconds;
            const p = mirror.impulse;
            commands.push({ op: 'force', id, force: [p[0] * inv, p[1] * inv, p[2] * inv], torque: [p[3] * inv, p[4] * inv, p[5] * inv], seconds });
            p.fill(0);
            mirror.hasImpulse = false;
        }
    }
    private accumulateForces(h: number): void {
        for (const mirror of this.mirrors.values()) {
            const { body } = mirror;
            if (!body.hasForces)
                continue;
            const impulse = mirror.impulse ?? (mirror.impulse = new Float32Array(6));
            const f = body.force;
            const t = body.torque;
            impulse[0] += f[0] * h;
            impulse[1] += f[1] * h;
            impulse[2] += f[2] * h;
            impulse[3] += t[0] * h;
            impulse[4] += t[1] * h;
            impulse[5] += t[2] * h;
            mirror.hasImpulse = true;
            body.clearForces();
        }
    }
    private diffJoint(mirror: JointMirror, commands: PhysicsCommand[]): void {
        if (mirror.removed)
            return;
        const { joint } = mirror;
        if (joint.broken) {
            if (!mirror.broken) {
                mirror.broken = true;
                mirror.removed = true;
                commands.push({ op: 'joint-remove', id: joint.id });
            }
            return;
        }
        if (joint.version !== mirror.version) {
            mirror.version = joint.version;
            commands.push({ op: 'joint-update', id: joint.id, definition: cloneJointDefinition(joint.definition) });
        }
    }
    private matchesSentPose(mirror: BodyMirror): boolean {
        const sent = mirror.sentPose;
        if (!sent)
            return false;
        const p = mirror.body.position;
        const q = mirror.body.orientation;
        return sent[0] === p[0] && sent[1] === p[1] && sent[2] === p[2] && sent[3] === q[0] && sent[4] === q[1] && sent[5] === q[2] && sent[6] === q[3];
    }
    private rememberSentPose(mirror: BodyMirror): void {
        const sent = mirror.sentPose ?? (mirror.sentPose = new Float32Array(7));
        sent.set(mirror.body.position, 0);
        sent.set(mirror.body.orientation, 3);
    }
    private matchesSentVelocity(mirror: BodyMirror): boolean {
        const sent = mirror.sentVelocity;
        if (!sent)
            return false;
        const v = mirror.body.linearVelocity;
        const w = mirror.body.angularVelocity;
        return sent[0] === v[0] && sent[1] === v[1] && sent[2] === v[2] && sent[3] === w[0] && sent[4] === w[1] && sent[5] === w[2];
    }
    private rememberSentVelocity(mirror: BodyMirror): void {
        const sent = mirror.sentVelocity ?? (mirror.sentVelocity = new Float32Array(6));
        sent.set(mirror.body.linearVelocity, 0);
        sent.set(mirror.body.angularVelocity, 3);
    }
    private receive(reply: PhysicsReply): void {
        if (this.failed)
            return;
        if (reply.type === 'ready') {
            this.ready = true;
            return;
        }
        if (reply.type === 'error') {
            this.fail(reply.message);
            return;
        }
        this.inFlight = false;
        this.applyFrame(reply);
        const listeners = this.frameListeners.splice(0);
        for (const listener of listeners)
            listener();
    }
    private applyFrame(reply: PhysicsFrameReply): void {
        const { world } = this;
        if (this.shared) {
            this.poses.copyTo(this.baseline);
        }
        else if (reply.poses) {
            const received = new PoseBuffer(reply.poses);
            if (received.capacity > this.capacity)
                this.grow(received.capacity);
            received.copyTo(this.baseline);
            this.recycle = reply.poses;
        }
        for (const mirror of this.mirrors.values()) {
            if (mirror.slot >= this.capacity)
                continue;
            if (!poseSlot.readInto(this.baseline, mirror.slot, mirror.body))
                continue;
            world.refreshAabb(mirror.body);
            mirror.sentPose = null;
            mirror.sentVelocity = null;
        }
        Object.assign(world.stats, reply.stats);
        world.stats.backend = this.backend;
        this.lastSteps = reply.stats.stepsLastAdvance;
        this.interpolationValue = reply.interpolation;
        this.rebuildManifolds(reply.contacts);
        this.applyJointStates(reply.joints);
        for (const id of reply.outOfBounds) {
            const mirror = this.mirrors.get(id);
            if (!mirror)
                continue;
            mirror.body.outOfBounds = true;
            mirror.body.sleep();
            world.events.onOutOfBounds?.(mirror.body);
        }
        for (const id of reply.unstable) {
            const mirror = this.mirrors.get(id);
            if (mirror)
                world.events.onUnstable?.(mirror.body);
        }
    }
    private applyJointStates(records: Float32Array): void {
        const count = Math.floor(records.length / JOINT_RECORD_FLOATS);
        for (let i = 0; i < count; i++) {
            const base = i * JOINT_RECORD_FLOATS;
            const mirror = this.jointMirrors.get(records[base]);
            if (!mirror || mirror.removed)
                continue;
            const { joint } = mirror;
            vec3.set(joint.reactionForce, records[base + 1], records[base + 2], records[base + 3]);
            vec3.set(joint.reactionTorque, records[base + 4], records[base + 5], records[base + 6]);
            joint.coordinate = records[base + 7];
            joint.speed = records[base + 8];
            joint.axialForce = records[base + 9];
            joint.motorForce = records[base + 10];
            if (records[base + 11] > 0.5 && !mirror.broken) {
                mirror.broken = true;
                this.world.reportJointBreak(joint);
            }
        }
    }
    private rebuildManifolds(contacts: Float32Array): void {
        const list = this.manifoldList;
        list.length = 0;
        const seen = new Set<number>();
        const count = Math.floor(contacts.length / CONTACT_RECORD_FLOATS);
        for (let i = 0; i < count; i++) {
            const base = i * CONTACT_RECORD_FLOATS;
            const a = this.mirrors.get(contacts[base]);
            const b = this.mirrors.get(contacts[base + 1]);
            if (!a || !b)
                continue;
            const key = pairKey(a.body.id, b.body.id);
            seen.add(key);
            let manifold = this.manifolds.get(key);
            if (!manifold || manifold.bodyA !== a.body || manifold.bodyB !== b.body) {
                manifold = new Manifold(a.body, b.body);
                this.manifolds.set(key, manifold);
            }
            vec3.set(manifold.normal, contacts[base + 2], contacts[base + 3], contacts[base + 4]);
            const point = manifold.points[0];
            const pa = a.body.position;
            vec3.set(point.anchorA, contacts[base + 5] - pa[0], contacts[base + 6] - pa[1], contacts[base + 7] - pa[2]);
            point.maxNormalImpulse = contacts[base + 8];
            point.relativeVelocity = contacts[base + 9];
            manifold.pointCount = 1;
            list.push(manifold);
        }
        for (const key of Array.from(this.manifolds.keys()))
            if (!seen.has(key))
                this.manifolds.delete(key);
        this.world.replaceManifolds(list);
    }
    private resetPerAdvanceStats(): void {
        const { stats } = this.world;
        stats.stepsLastAdvance = 0;
        stats.catchUpSteps = 0;
        stats.simulatedSeconds = 0;
        stats.advanceMs = 0;
        stats.droppedSeconds = 0;
    }
    private watchdog(): void {
        const now = performance.now();
        if (!this.ready && now - this.createdAt > READY_TIMEOUT_MS)
            this.fail('o worker de física não ficou pronto a tempo.');
        else if (this.inFlight && now - this.sentAt > STALL_MS)
            this.fail('o worker de física parou de responder.');
    }
    private fail(message: string): void {
        if (this.failed)
            return;
        this.failed = true;
        this.channel.close();
        this.world.detachRemote(message);
    }
}
