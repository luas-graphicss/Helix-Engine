import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import * as quat from '@/engine/core/math/quat';
import type { Quat } from '@/engine/core/math/quat';
import * as aabb from '@/engine/core/math/aabb';
import type { Aabb } from '@/engine/core/math/aabb';
import { clamp } from '@/engine/core/math/scalar';
import { RigidBody, type RigidBodyOptions } from '@/engine/physics/body/rigid-body';
import { computeShapeAabb, createSphereShape } from '@/engine/physics/shapes/collider-shape';
import { Broadphase } from '@/engine/physics/collision/broadphase';
import { ContactCache } from '@/engine/physics/collision/contact-cache';
import { ContactResult, pairKey, type Manifold } from '@/engine/physics/collision/manifold';
import { collideBodies } from '@/engine/physics/collision/narrowphase';
import { integratePositions, integrateVelocities } from '@/engine/physics/solver/integrator';
import { computeSoftness, createSoftness } from '@/engine/physics/solver/soft-constraint';
import { applyRestitution, prepareContacts, solveContacts, warmStartContacts, type ContactSolverContext, } from '@/engine/physics/solver/contact-solver';
import type { Joint } from '@/engine/physics/joints/joint';
import type { JointSolverContext } from '@/engine/physics/joints/joint-math';
import { instantiateJoint } from '@/engine/physics/joints/joint-factory';
import { finalizeJoints, prepareJoints, solveJoints, warmStartJoints } from '@/engine/physics/joints/joint-solver';
import { cloneJointDefinition, type JointDefinition } from '@/engine/physics/joints/joint-settings';
import { IslandSleeper, accumulateSleepTime, wakeTouchingBodies } from './island-sleep';
import { CollisionLayers } from './collision-layers';
import type { ForceField } from './force-field';
import type { PhysicsSettings } from './physics-settings';
const MAX_STEPS_PER_ADVANCE = 4;
const MAX_BACKLOG_STEPS = 4;
export const MAX_CATCH_UP_TIMESTEP = 1 / 30;
const MIN_FIXED_TIMESTEP = 1 / 1000;
const MAX_FIXED_TIMESTEP = 1 / 10;
const MAX_SUBSTEPS = 32;
const MAX_ITERATIONS = 16;
export type PhysicsBackend = 'local' | 'worker-shared' | 'worker-copy';
export const PHYSICS_BACKEND_LABELS: Record<PhysicsBackend, string> = {
    local: 'local',
    'worker-shared': 'worker (memória compartilhada)',
    'worker-copy': 'worker (cópia por frame)',
};
export interface PhysicsStats {
    bodies: number;
    awake: number;
    manifolds: number;
    contactPoints: number;
    joints: number;
    stepMs: number;
    stepMsAverage: number;
    stepsLastAdvance: number;
    catchUpSteps: number;
    simulatedSeconds: number;
    advanceMs: number;
    droppedSeconds: number;
    backend: PhysicsBackend;
}
const STEP_EMA_ALPHA = 0.2;
export interface PhysicsWorldEvents {
    onOutOfBounds?(body: RigidBody): void;
    onUnstable?(body: RigidBody): void;
    onJointBreak?(joint: Joint): void;
    onBackendFallback?(message: string): void;
}
export interface PhysicsRemote {
    readonly backend: PhysicsBackend;
    readonly interpolation: number;
    bodyCreated(body: RigidBody): void;
    bodyRemoved(body: RigidBody): void;
    teleported(body: RigidBody): void;
    jointCreated(joint: Joint): void;
    jointRemoved(joint: Joint): void;
    cleared(): void;
    advance(deltaSeconds: number): number;
    stepOnce(): void;
    discardAccumulatedTime(): void;
    onceFrame(listener: () => void): void;
    dispose(): void;
}
export type PreStepHook = (fixedTimestep: number) => void;
export type BodyVisitor = (body: RigidBody) => void;
export class PhysicsWorld {
    readonly bodies: RigidBody[] = [];
    readonly joints: Joint[] = [];
    readonly ground: RigidBody;
    readonly stats: PhysicsStats = {
        bodies: 0,
        awake: 0,
        manifolds: 0,
        contactPoints: 0,
        joints: 0,
        stepMs: 0,
        stepMsAverage: 0,
        stepsLastAdvance: 0,
        catchUpSteps: 0,
        simulatedSeconds: 0,
        advanceMs: 0,
        droppedSeconds: 0,
        backend: 'local',
    };
    stepBudgetMs = Infinity;
    time = 0;
    readonly layers = new CollisionLayers();
    private readonly broadphase = new Broadphase();
    private readonly forceFields = new Set<ForceField>();
    private readonly contactCache = new ContactCache();
    private readonly contactResult = new ContactResult();
    private readonly islands = new IslandSleeper();
    private readonly awakeBodies: RigidBody[] = [];
    private readonly stepManifolds: Manifold[] = [];
    private readonly solverContext: ContactSolverContext = {
        contactSoftness: createSoftness(),
        staticSoftness: createSoftness(),
        linearSlop: 0,
        maxPushVelocity: 0,
        invH: 0,
    };
    private readonly pairVisitor = (a: RigidBody, b: RigidBody) => this.collidePair(a, b);
    private readonly preStepHooks = new Set<PreStepHook>();
    private readonly remoteFields = new WeakSet<ForceField>();
    private readonly linkedJoints: Joint[] = [];
    private readonly activeJoints: Joint[] = [];
    private readonly brokenJoints: Joint[] = [];
    private readonly excludedPairs = new Set<number>();
    private readonly jointContext: JointSolverContext = {
        softness: createSoftness(),
        h: 1 / 240,
        invH: 240,
        maxBiasVelocity: 0,
        warmStarting: true,
    };
    private remote: PhysicsRemote | null = null;
    private nextBodyId = 1;
    private nextJointId = 1;
    private accumulator = 0;
    private stepDt = 1 / 60;
    constructor(readonly settings: PhysicsSettings, readonly events: PhysicsWorldEvents = {}) {
        this.stepDt = this.fixedTimestep;
        this.ground = new RigidBody(0, {
            type: 'static',
            shape: createSphereShape(0.01),
            position: vec3.create(),
            orientation: quat.create(),
            mass: 0,
            friction: 0,
            restitution: 0,
            linearDamping: 0,
            angularDamping: 0,
            gravityScale: 0,
            canSleep: true,
        });
    }
    get backend(): PhysicsBackend {
        return this.stats.backend;
    }
    get remoteLink(): PhysicsRemote | null {
        return this.remote;
    }
    attachRemote(remote: PhysicsRemote): void {
        this.remote?.dispose();
        this.remote = remote;
        this.stats.backend = remote.backend;
        this.accumulator = 0;
    }
    detachRemote(reason?: string): void {
        const remote = this.remote;
        if (!remote)
            return;
        this.remote = null;
        remote.dispose();
        this.stats.backend = 'local';
        this.accumulator = 0;
        this.stepManifolds.length = 0;
        for (const body of this.bodies) {
            body.storePreviousPose();
            this.updateBodyAabb(body);
        }
        for (const joint of this.joints)
            joint.resetImpulses();
        if (reason)
            this.events.onBackendFallback?.(reason);
    }
    get fixedTimestep(): number {
        const requested = this.settings.fixedTimestep;
        return clamp(Number.isFinite(requested) ? requested : 1 / 60, MIN_FIXED_TIMESTEP, MAX_FIXED_TIMESTEP);
    }
    get manifolds(): readonly Manifold[] {
        return this.stepManifolds;
    }
    get interpolation(): number {
        if (this.remote)
            return this.remote.interpolation;
        return clamp(this.accumulator / this.fixedTimestep, 0, 1);
    }
    createBody(options: RigidBodyOptions, id?: number): RigidBody {
        const assigned = id ?? this.nextBodyId;
        if (assigned >= this.nextBodyId)
            this.nextBodyId = assigned + 1;
        const body = new RigidBody(assigned, options);
        this.bodies.push(body);
        this.broadphase.add(body);
        this.updateBodyAabb(body);
        this.wakeOverlapping(body.aabb, body);
        this.remote?.bodyCreated(body);
        return body;
    }
    removeBody(body: RigidBody): void {
        const index = this.bodies.indexOf(body);
        if (index === -1)
            return;
        if (body.jointCount > 0) {
            for (const joint of this.joints.slice()) {
                if (joint.bodyA === body || joint.bodyB === body)
                    this.removeJoint(joint);
            }
        }
        this.bodies.splice(index, 1);
        this.broadphase.remove(body);
        this.contactCache.removeBody(body);
        this.wakeOverlapping(body.aabb, body);
        this.remote?.bodyRemoved(body);
    }
    createJoint(definition: JointDefinition, bodyA: RigidBody, bodyB: RigidBody | null, id?: number): Joint {
        const assigned = id ?? this.nextJointId;
        if (assigned >= this.nextJointId)
            this.nextJointId = assigned + 1;
        const other = bodyB ?? this.ground;
        const joint = instantiateJoint(assigned, bodyA, other, cloneJointDefinition(definition));
        this.joints.push(joint);
        bodyA.jointCount++;
        other.jointCount++;
        joint.wakeBodies();
        this.remote?.jointCreated(joint);
        return joint;
    }
    removeJoint(joint: Joint): void {
        const index = this.joints.indexOf(joint);
        if (index === -1)
            return;
        this.joints.splice(index, 1);
        joint.bodyA.jointCount--;
        joint.bodyB.jointCount--;
        joint.wakeBodies();
        this.remote?.jointRemoved(joint);
    }
    drainBrokenJoints(): Joint[] {
        return this.brokenJoints.splice(0);
    }
    reportJointBreak(joint: Joint): void {
        if (!joint.broken)
            joint.break();
        this.brokenJoints.push(joint);
        this.events.onJointBreak?.(joint);
    }
    clear(): void {
        for (const body of this.bodies)
            body.jointCount = 0;
        this.ground.jointCount = 0;
        this.bodies.length = 0;
        this.joints.length = 0;
        this.linkedJoints.length = 0;
        this.activeJoints.length = 0;
        this.brokenJoints.length = 0;
        this.excludedPairs.clear();
        this.broadphase.clear();
        this.contactCache.clear();
        this.preStepHooks.clear();
        this.forceFields.clear();
        this.layers.reset();
        this.accumulator = 0;
        this.stepManifolds.length = 0;
        this.remote?.cleared();
    }
    addPreStepHook(hook: PreStepHook): () => void {
        this.preStepHooks.add(hook);
        return () => {
            this.preStepHooks.delete(hook);
        };
    }
    addForceField(field: ForceField, options: {
        remote?: boolean;
    } = {}): () => void {
        this.forceFields.add(field);
        if (options.remote)
            this.remoteFields.add(field);
        return () => {
            this.forceFields.delete(field);
            this.remoteFields.delete(field);
        };
    }
    runPreStepHooks(h: number): void {
        for (const hook of this.preStepHooks)
            hook(h);
    }
    applyLocalForceFields(h: number): void {
        let hasLocal = false;
        for (const field of this.forceFields) {
            if (!this.remoteFields.has(field)) {
                hasLocal = true;
                break;
            }
        }
        if (!hasLocal)
            return;
        const awake = this.awakeBodies;
        awake.length = 0;
        for (const body of this.bodies)
            if (body.isSimulated)
                awake.push(body);
        for (const field of this.forceFields) {
            if (this.remoteFields.has(field))
                continue;
            field.wakeAffected(this.bodies, this.time);
            field.beginStep?.(this.time);
            field.apply(awake, h, this.time);
        }
    }
    replaceManifolds(manifolds: readonly Manifold[]): void {
        const list = this.stepManifolds;
        list.length = 0;
        for (const manifold of manifolds)
            list.push(manifold);
    }
    refreshAabb(body: RigidBody): void {
        this.updateBodyAabb(body);
    }
    queryAabb(box: Aabb, except: RigidBody | null, visit: BodyVisitor): void {
        for (const body of this.bodies) {
            if (body === except || body.outOfBounds)
                continue;
            if (aabb.intersects(body.aabb, box))
                visit(body);
        }
    }
    teleport(body: RigidBody, position: Vec3, orientation: Quat): void {
        this.wakeOverlapping(body.aabb, body);
        this.contactCache.removeBody(body);
        body.teleport(position, orientation);
        this.updateBodyAabb(body);
        this.wakeOverlapping(body.aabb, body);
        this.remote?.teleported(body);
    }
    advance(deltaSeconds: number): number {
        if (this.remote)
            return this.remote.advance(Number.isFinite(deltaSeconds) ? deltaSeconds : 0);
        const { stats } = this;
        if (!(deltaSeconds > 0)) {
            stats.stepsLastAdvance = 0;
            stats.catchUpSteps = 0;
            stats.simulatedSeconds = 0;
            stats.advanceMs = 0;
            stats.droppedSeconds = 0;
            return 0;
        }
        const dt = this.fixedTimestep;
        const backlog = MAX_BACKLOG_STEPS * dt;
        const admitted = Math.min(deltaSeconds, Math.max(0, backlog - this.accumulator));
        const dropped = deltaSeconds - admitted;
        this.accumulator += admitted;
        const started = performance.now();
        let steps = 0;
        let catchUp = 0;
        let simulated = 0;
        while (this.accumulator >= dt && steps < MAX_STEPS_PER_ADVANCE) {
            if (steps > 0 && performance.now() - started + stats.stepMsAverage > this.stepBudgetMs)
                break;
            this.step(dt);
            this.accumulator -= dt;
            steps++;
            simulated += dt;
        }
        if (this.accumulator >= dt) {
            const wide = Math.min(this.accumulator, Math.max(dt, MAX_CATCH_UP_TIMESTEP));
            this.step(wide, this.catchUpSubsteps(wide));
            this.accumulator -= wide;
            steps++;
            catchUp++;
            simulated += wide;
        }
        stats.advanceMs = performance.now() - started;
        stats.droppedSeconds = dropped;
        stats.stepsLastAdvance = steps;
        stats.catchUpSteps = catchUp;
        stats.simulatedSeconds = simulated;
        return steps;
    }
    private catchUpSubsteps(wide: number): number {
        const substeps = clamp(Math.floor(this.settings.substeps) || 1, 1, MAX_SUBSTEPS);
        return clamp(Math.round((substeps * wide) / this.fixedTimestep), substeps, MAX_SUBSTEPS);
    }
    discardAccumulatedTime(): void {
        this.accumulator = 0;
        this.remote?.discardAccumulatedTime();
    }
    step(dt: number = this.fixedTimestep, substepsOverride?: number): void {
        if (this.remote) {
            this.remote.stepOnce();
            return;
        }
        const started = performance.now();
        const { settings } = this;
        this.stepDt = dt;
        const substeps = substepsOverride ?? clamp(Math.floor(settings.substeps) || 1, 1, MAX_SUBSTEPS);
        const solverIterations = clamp(Math.floor(settings.solverIterations) || 1, 1, MAX_ITERATIONS);
        const relaxIterations = clamp(Math.floor(settings.relaxIterations) || 0, 0, MAX_ITERATIONS);
        const h = dt / substeps;
        const invH = 1 / h;
        for (const body of this.bodies) {
            if (body.isSimulated || body.isKinematic)
                body.storePreviousPose();
        }
        for (const hook of this.preStepHooks)
            hook(dt);
        for (const body of this.bodies) {
            if (body.isSimulated || body.isKinematic)
                this.updateBodyAabb(body);
        }
        this.collectLinkedJoints();
        this.contactCache.beginStep();
        this.broadphase.findPairs(this.pairVisitor);
        this.contactCache.endStep();
        const manifolds = this.stepManifolds;
        const excluded = this.excludedPairs;
        manifolds.length = 0;
        this.contactCache.forEach((manifold) => {
            if (manifold.pointCount === 0 || manifold.bodyA.outOfBounds || manifold.bodyB.outOfBounds)
                return;
            if (excluded.size > 0 && excluded.has(pairKey(manifold.bodyA, manifold.bodyB)))
                return;
            manifolds.push(manifold);
        });
        wakeTouchingBodies(manifolds, this.linkedJoints);
        for (const field of this.forceFields)
            field.wakeAffected(this.bodies, this.time);
        const awake = this.awakeBodies;
        awake.length = 0;
        for (const body of this.bodies) {
            if (body.isSimulated) {
                body.islandSlot = awake.length;
                awake.push(body);
            }
            else {
                body.islandSlot = -1;
            }
        }
        let activeCount = 0;
        let contactPoints = 0;
        for (const manifold of manifolds) {
            if (!manifold.bodyA.isSimulated && !manifold.bodyB.isSimulated)
                continue;
            manifolds[activeCount++] = manifold;
            contactPoints += manifold.pointCount;
        }
        manifolds.length = activeCount;
        const contactHertz = Math.min(Math.max(settings.contactHertz, 0), 0.25 * invH);
        const dampingRatio = Math.max(settings.contactDampingRatio, 0);
        const context = this.solverContext;
        computeSoftness(context.contactSoftness, contactHertz, dampingRatio, h);
        computeSoftness(context.staticSoftness, 2 * contactHertz, dampingRatio, h);
        context.linearSlop = Math.max(settings.linearSlop, 0);
        context.maxPushVelocity = Math.max(settings.contactPushMaxVelocity, 0);
        context.invH = invH;
        const joints = this.activeJoints;
        const jointContext = this.jointContext;
        computeSoftness(jointContext.softness, Math.min(Math.max(settings.jointHertz, 0), 0.25 * invH), Math.max(settings.jointDampingRatio, 0), h);
        jointContext.h = h;
        jointContext.invH = invH;
        jointContext.maxBiasVelocity = Math.max(settings.jointPushMaxVelocity, 0);
        jointContext.warmStarting = settings.warmStarting;
        prepareJoints(this.linkedJoints, joints, jointContext);
        prepareContacts(manifolds, context);
        for (const field of this.forceFields)
            field.beginStep?.(this.time);
        for (let i = 0; i < substeps; i++) {
            for (const field of this.forceFields)
                field.apply(awake, h, this.time + i * h);
            integrateVelocities(awake, settings, h, invH);
            if (settings.warmStarting) {
                warmStartJoints(joints, jointContext);
                warmStartContacts(manifolds);
            }
            for (let j = 0; j < solverIterations; j++) {
                solveJoints(joints, jointContext, true);
                solveContacts(manifolds, context, true);
            }
            integratePositions(awake, h);
            for (let j = 0; j < relaxIterations; j++) {
                solveJoints(joints, jointContext, false);
                solveContacts(manifolds, context, false);
            }
        }
        applyRestitution(manifolds, Math.max(settings.restitutionThreshold, 0));
        for (const body of awake)
            this.finalizeBody(body, dt);
        const brokenBefore = this.brokenJoints.length;
        finalizeJoints(joints, jointContext, this.brokenJoints);
        for (let i = brokenBefore; i < this.brokenJoints.length; i++)
            this.events.onJointBreak?.(this.brokenJoints[i]);
        this.islands.apply(awake, manifolds, joints, settings.timeToSleep, dt);
        this.time += dt;
        this.stats.bodies = this.bodies.length;
        this.stats.awake = awake.length;
        this.stats.manifolds = activeCount;
        this.stats.contactPoints = contactPoints;
        this.stats.joints = joints.length;
        const stepMs = performance.now() - started;
        this.stats.stepMs = stepMs;
        this.stats.stepMsAverage = this.stats.stepMsAverage === 0 ? stepMs : this.stats.stepMsAverage + (stepMs - this.stats.stepMsAverage) * STEP_EMA_ALPHA;
    }
    private collectLinkedJoints(): void {
        const linked = this.linkedJoints;
        const excluded = this.excludedPairs;
        linked.length = 0;
        excluded.clear();
        for (const joint of this.joints) {
            if (!joint.definition.enabled || joint.broken)
                continue;
            linked.push(joint);
            if (!joint.definition.collideConnected && joint.bodyB !== this.ground)
                excluded.add(pairKey(joint.bodyA, joint.bodyB));
        }
    }
    private collidePair(a: RigidBody, b: RigidBody): void {
        if (a.outOfBounds || b.outOfBounds)
            return;
        if (!this.layers.pairCollides(a.layer, a.collisionMask, b.layer, b.collisionMask))
            return;
        if (this.excludedPairs.size > 0 && this.excludedPairs.has(pairKey(a, b)))
            return;
        const first = a.id < b.id ? a : b;
        const second = first === a ? b : a;
        const margin = this.settings.speculativeDistance + (first.motionSpeed + second.motionSpeed) * this.stepDt;
        if (!collideBodies(first, second, margin, this.settings.linearSlop, this.contactResult))
            return;
        this.contactCache.acquire(first, second).update(this.contactResult);
    }
    private updateBodyAabb(body: RigidBody): void {
        const margin = this.settings.speculativeDistance + body.motionSpeed * this.stepDt;
        computeShapeAabb(body.aabb, body.shape, body.position, body.rotation, margin);
    }
    private wakeOverlapping(box: Aabb, except: RigidBody): void {
        for (const body of this.bodies) {
            if (body === except || !body.sleeping || body.outOfBounds)
                continue;
            if (aabb.intersects(body.aabb, box))
                body.wake();
        }
    }
    private finalizeBody(body: RigidBody, dt: number): void {
        body.resetStepDeltas();
        body.clearForces();
        if (!body.isStateFinite()) {
            body.recoverFromInstability();
            this.events.onUnstable?.(body);
            return;
        }
        if (body.position[1] < this.settings.fallLimitY) {
            body.outOfBounds = true;
            body.sleep();
            this.events.onOutOfBounds?.(body);
            return;
        }
        accumulateSleepTime(body, this.settings, dt);
    }
}
