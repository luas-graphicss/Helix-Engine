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
}
