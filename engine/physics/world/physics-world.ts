import type { Vec3 } from '@/engine/core/math/vec3';
import type { Quat } from '@/engine/core/math/quat';
import * as aabb from '@/engine/core/math/aabb';
import type { Aabb } from '@/engine/core/math/aabb';
import { clamp } from '@/engine/core/math/scalar';
import { RigidBody, type RigidBodyOptions } from '@/engine/physics/body/rigid-body';
import { computeShapeAabb } from '@/engine/physics/shapes/collider-shape';
import { Broadphase } from '@/engine/physics/collision/broadphase';
import { ContactCache } from '@/engine/physics/collision/contact-cache';
import { ContactResult, type Manifold } from '@/engine/physics/collision/manifold';
import { collideBodies } from '@/engine/physics/collision/narrowphase';
import { integratePositions, integrateVelocities } from '@/engine/physics/solver/integrator';
import { computeSoftness, createSoftness } from '@/engine/physics/solver/soft-constraint';
import { applyRestitution, prepareContacts, solveContacts, warmStartContacts, type ContactSolverContext, } from '@/engine/physics/solver/contact-solver';
import { IslandSleeper, accumulateSleepTime, wakeTouchingBodies } from './island-sleep';
import type { ForceField } from './force-field';
import type { PhysicsSettings } from './physics-settings';
const MAX_STEPS_PER_ADVANCE = 4;
const MIN_FIXED_TIMESTEP = 1 / 1000;
const MAX_FIXED_TIMESTEP = 1 / 10;
const MAX_SUBSTEPS = 32;
const MAX_ITERATIONS = 16;
export interface PhysicsStats {
    bodies: number;
    awake: number;
    manifolds: number;
    contactPoints: number;
    stepMs: number;
    stepsLastAdvance: number;
}
export interface PhysicsWorldEvents {
    onOutOfBounds?(body: RigidBody): void;
    onUnstable?(body: RigidBody): void;
}
export type PreStepHook = (fixedTimestep: number) => void;
export type BodyVisitor = (body: RigidBody) => void;
export class PhysicsWorld {
    readonly bodies: RigidBody[] = [];
    readonly stats: PhysicsStats = { bodies: 0, awake: 0, manifolds: 0, contactPoints: 0, stepMs: 0, stepsLastAdvance: 0 };
    time = 0;
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
    private nextBodyId = 1;
    private accumulator = 0;
    constructor(readonly settings: PhysicsSettings, private readonly events: PhysicsWorldEvents = {}) { }
    get fixedTimestep(): number {
        const requested = this.settings.fixedTimestep;
        return clamp(Number.isFinite(requested) ? requested : 1 / 60, MIN_FIXED_TIMESTEP, MAX_FIXED_TIMESTEP);
    }
    get interpolation(): number {
        return clamp(this.accumulator / this.fixedTimestep, 0, 1);
    }
    createBody(options: RigidBodyOptions): RigidBody {
        const body = new RigidBody(this.nextBodyId++, options);
        this.bodies.push(body);
        this.broadphase.add(body);
        this.updateBodyAabb(body);
        this.wakeOverlapping(body.aabb, body);
        return body;
    }
    removeBody(body: RigidBody): void {
        const index = this.bodies.indexOf(body);
        if (index === -1)
            return;
        this.bodies.splice(index, 1);
        this.broadphase.remove(body);
        this.contactCache.removeBody(body);
        this.wakeOverlapping(body.aabb, body);
    }
    clear(): void {
        this.bodies.length = 0;
        this.broadphase.clear();
        this.contactCache.clear();
        this.preStepHooks.clear();
        this.forceFields.clear();
        this.accumulator = 0;
    }
    addPreStepHook(hook: PreStepHook): () => void {
        this.preStepHooks.add(hook);
        return () => {
            this.preStepHooks.delete(hook);
        };
    }
    addForceField(field: ForceField): () => void {
        this.forceFields.add(field);
        return () => {
            this.forceFields.delete(field);
        };
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
    }
    advance(deltaSeconds: number): number {
        if (!(deltaSeconds > 0))
            return 0;
        const dt = this.fixedTimestep;
        this.accumulator += Math.min(deltaSeconds, MAX_STEPS_PER_ADVANCE * dt);
        let steps = 0;
        while (this.accumulator >= dt && steps < MAX_STEPS_PER_ADVANCE) {
            this.step();
            this.accumulator -= dt;
            steps++;
        }
        if (this.accumulator >= dt)
            this.accumulator = 0;
        this.stats.stepsLastAdvance = steps;
        return steps;
    }
    discardAccumulatedTime(): void {
        this.accumulator = 0;
    }
    step(): void {
        const started = performance.now();
        const { settings } = this;
        const dt = this.fixedTimestep;
        const substeps = clamp(Math.floor(settings.substeps) || 1, 1, MAX_SUBSTEPS);
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
        this.contactCache.beginStep();
        this.broadphase.findPairs(this.pairVisitor);
        this.contactCache.endStep();
        const manifolds = this.stepManifolds;
        manifolds.length = 0;
        this.contactCache.forEach((manifold) => {
            if (manifold.pointCount === 0 || manifold.bodyA.outOfBounds || manifold.bodyB.outOfBounds)
                return;
            manifolds.push(manifold);
        });
        wakeTouchingBodies(manifolds);
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
        prepareContacts(manifolds, context);
        for (const field of this.forceFields)
            field.beginStep?.(this.time);
        for (let i = 0; i < substeps; i++) {
            for (const field of this.forceFields)
                field.apply(awake, h, this.time + i * h);
            integrateVelocities(awake, settings, h, invH);
            if (settings.warmStarting)
                warmStartContacts(manifolds);
            for (let j = 0; j < solverIterations; j++)
                solveContacts(manifolds, context, true);
            integratePositions(awake, h);
            for (let j = 0; j < relaxIterations; j++)
                solveContacts(manifolds, context, false);
        }
        applyRestitution(manifolds, Math.max(settings.restitutionThreshold, 0));
        for (const body of awake)
            this.finalizeBody(body, dt);
        this.islands.apply(awake, manifolds, settings.timeToSleep, dt);
        this.time += dt;
        this.stats.bodies = this.bodies.length;
        this.stats.awake = awake.length;
        this.stats.manifolds = activeCount;
        this.stats.contactPoints = contactPoints;
        this.stats.stepMs = performance.now() - started;
    }
    private collidePair(a: RigidBody, b: RigidBody): void {
        if (a.outOfBounds || b.outOfBounds)
            return;
        const first = a.id < b.id ? a : b;
        const second = first === a ? b : a;
        const margin = this.settings.speculativeDistance + (first.motionSpeed + second.motionSpeed) * this.fixedTimestep;
        if (!collideBodies(first, second, margin, this.settings.linearSlop, this.contactResult))
            return;
        this.contactCache.acquire(first, second).update(this.contactResult);
    }
    private updateBodyAabb(body: RigidBody): void {
        const margin = this.settings.speculativeDistance + body.motionSpeed * this.fixedTimestep;
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
