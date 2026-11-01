import * as vec3 from '@/engine/core/math/vec3';
import * as quat from '@/engine/core/math/quat';
import type { Mat4 } from '@/engine/core/math/mat4';
import { Heightfield } from '@/engine/terrain/core/heightfield';
import type { WaterSettings } from '@/engine/terrain/water/water-settings';
import type { RigidBody } from '@/engine/physics/body/rigid-body';
import { BuoyancyField } from '@/engine/physics/fluids/buoyancy-field';
import { WaterVolume, type WaterTerrain } from '@/engine/physics/fluids/water-volume';
import type { Joint } from '@/engine/physics/joints/joint';
import { copyJointDefinition } from '@/engine/physics/joints/joint-settings';
import { PhysicsWorld } from '@/engine/physics/world/physics-world';
import { PoseBuffer } from './pose-buffer';
import { CONTACT_RECORD_FLOATS, JOINT_RECORD_FLOATS, decodeShape, type PhysicsAdvanceRequest, type PhysicsCommand, type PhysicsInitRequest, type PhysicsReply, type PhysicsRequest, type WaterTerrainRecord } from './physics-protocol';
export type PhysicsReplySink = (reply: PhysicsReply, transfer: Transferable[]) => void;
interface MirroredBody {
    readonly body: RigidBody;
    readonly slot: number;
}
interface KinematicTarget {
    readonly position: Float32Array;
    readonly orientation: Float32Array;
    remaining: number;
}
interface FrameForce {
    readonly force: Float32Array;
    readonly torque: Float32Array;
    remaining: number;
}
class SnapshotWaterTerrain implements WaterTerrain {
    water: WaterSettings;
    size: number;
    private heightfield: Heightfield;
    constructor(record: WaterTerrainRecord, heights: Float32Array) {
        this.water = record.water;
        this.size = record.size;
        this.heightfield = new Heightfield(record.resolution, heights);
    }
    update(record: WaterTerrainRecord): void {
        this.water = record.water;
        this.size = record.size;
        if (record.heights)
            this.heightfield = new Heightfield(record.resolution, record.heights);
    }
    private get halfSize(): number {
        return this.size / 2;
    }
    private get cellSize(): number {
        return this.size / (this.heightfield.resolution - 1);
    }
    containsLocal(x: number, z: number): boolean {
        const half = this.halfSize;
        return x >= -half && x <= half && z >= -half && z <= half;
    }
    heightAtLocal(x: number, z: number): number {
        const grid = (value: number) => (value + this.halfSize) / this.cellSize;
        return this.heightfield.sample(grid(x), grid(z));
    }
}
interface WaterEntry {
    readonly terrain: SnapshotWaterTerrain;
    volume: WaterVolume;
    matrix: Float32Array;
}
const scratchPosition = vec3.create();
const scratchOrientation = quat.create();
export class PhysicsWorkerCore {
    private world: PhysicsWorld | null = null;
    private poses: PoseBuffer | null = null;
    private readonly bodies = new Map<number, MirroredBody>();
    private readonly joints = new Map<number, Joint>();
    private readonly kinematicTargets = new Map<number, KinematicTarget>();
    private readonly frameForces = new Map<number, FrameForce>();
    private readonly waters = new Map<number, WaterEntry>();
    private buoyancy: BuoyancyField | null = null;
    private readonly outOfBounds: number[] = [];
    private readonly unstable: number[] = [];
    private readonly spare: ArrayBuffer[] = [];
    handle(request: PhysicsRequest, reply: PhysicsReplySink): void {
        try {
            if (request.type === 'init')
                this.init(request, reply);
            else
                this.advance(request, reply);
        }
        catch (cause) {
            reply({ type: 'error', message: cause instanceof Error ? cause.message : String(cause) }, []);
        }
    }
    get authoritativeWorld(): PhysicsWorld | null {
        return this.world;
    }
    private init(request: PhysicsInitRequest, reply: PhysicsReplySink): void {
        const world = new PhysicsWorld(request.settings, {
            onOutOfBounds: (body) => this.outOfBounds.push(body.id),
            onUnstable: (body) => this.unstable.push(body.id),
        });
        world.layers.restore(request.layers);
        this.installEngineFields(world);
        this.world = world;
        this.poses = new PoseBuffer(request.buffer);
        this.bodies.clear();
        this.joints.clear();
        this.kinematicTargets.clear();
        this.frameForces.clear();
        this.waters.clear();
        reply({ type: 'ready' }, []);
    }
    private installEngineFields(world: PhysicsWorld): void {
        this.buoyancy = new BuoyancyField(() => this.waterVolumes(), world.settings);
        world.addForceField(this.buoyancy);
        world.addPreStepHook((h) => {
            this.driveKinematics(h);
            this.driveForces(h);
        });
    }
    private driveForces(h: number): void {
        for (const [id, entry] of this.frameForces) {
            const body = this.bodies.get(id)?.body;
            if (!body) {
                this.frameForces.delete(id);
                continue;
            }
            body.addForce(entry.force);
            body.addTorque(entry.torque);
            entry.remaining -= h;
            if (entry.remaining <= 1e-9)
                this.frameForces.delete(id);
        }
    }
    private *waterVolumes(): Iterable<WaterVolume> {
        for (const entry of this.waters.values()) {
            if (entry.volume.enabled)
                yield entry.volume;
        }
    }
    private driveKinematics(h: number): void {
        for (const { body } of this.bodies.values()) {
            if (!body.isKinematic)
                continue;
            const target = this.kinematicTargets.get(body.id);
            if (!target) {
                if (body.isMoving)
                    body.moveKinematic(body.position, body.orientation, h);
                continue;
            }
            const t = target.remaining > 0 ? Math.min(1, h / target.remaining) : 1;
            const p = body.position;
            scratchPosition[0] = p[0] + (target.position[0] - p[0]) * t;
            scratchPosition[1] = p[1] + (target.position[1] - p[1]) * t;
            scratchPosition[2] = p[2] + (target.position[2] - p[2]) * t;
            quat.nlerp(scratchOrientation, body.orientation, target.orientation, t);
            body.moveKinematic(scratchPosition, scratchOrientation, h);
            target.remaining -= h;
            if (target.remaining <= 1e-9)
                this.kinematicTargets.delete(body.id);
        }
    }
    private advance(request: PhysicsAdvanceRequest, reply: PhysicsReplySink): void {
        const world = this.world;
        if (!world)
            throw new Error('o worker de física recebeu um avanço antes de ser inicializado.');
        if (request.recycle)
            this.spare.push(request.recycle);
        let stepOnce = false;
        for (const command of request.commands) {
            if (command.op === 'step')
                stepOnce = true;
            else
                this.apply(world, command);
        }
        world.time = request.time;
        world.stepBudgetMs = request.budgetMs;
        let steps = 0;
        if (request.deltaSeconds > 0)
            steps = world.advance(request.deltaSeconds);
        if (stepOnce) {
            world.step();
            world.discardAccumulatedTime();
            steps++;
        }
        this.publish(world, request.frame, steps, reply);
    }
    private apply(world: PhysicsWorld, command: PhysicsCommand): void {
        switch (command.op) {
            case 'create': {
                const { body: record } = command;
                const shape = decodeShape(record.shape);
                if (!shape)
                    return;
                const body = world.createBody({
                    type: record.type,
                    shape,
                    position: new Float32Array(record.position),
                    orientation: new Float32Array(record.orientation),
                    mass: record.mass,
                    friction: record.friction,
                    restitution: record.restitution,
                    linearDamping: record.linearDamping,
                    angularDamping: record.angularDamping,
                    gravityScale: record.gravityScale,
                    canSleep: record.canSleep,
                    layer: record.layer,
                    collisionMask: record.collisionMask,
                }, record.id);
                this.bodies.set(record.id, { body, slot: record.slot });
                return;
            }
            case 'remove': {
                const entry = this.bodies.get(command.id);
                if (!entry)
                    return;
                for (const [id, joint] of this.joints) {
                    if (joint.bodyA === entry.body || joint.bodyB === entry.body)
                        this.joints.delete(id);
                }
                world.removeBody(entry.body);
                this.bodies.delete(command.id);
                this.kinematicTargets.delete(command.id);
                this.frameForces.delete(command.id);
                this.poses?.clearSlot(entry.slot);
                return;
            }
            case 'force': {
                const entry = this.bodies.get(command.id);
                if (!entry)
                    return;
                const existing = this.frameForces.get(command.id);
                if (existing) {
                    existing.force.set(command.force);
                    existing.torque.set(command.torque);
                    existing.remaining = Math.max(command.seconds, 0);
                }
                else {
                    this.frameForces.set(command.id, { force: new Float32Array(command.force), torque: new Float32Array(command.torque), remaining: Math.max(command.seconds, 0) });
                }
                entry.body.wake();
                return;
            }
            case 'joint-create': {
                const { joint: record } = command;
                const bodyA = this.bodies.get(record.bodyA)?.body;
                if (!bodyA)
                    return;
                const bodyB = record.bodyB === 0 ? null : (this.bodies.get(record.bodyB)?.body ?? null);
                if (record.bodyB !== 0 && !bodyB)
                    return;
                this.joints.set(record.id, world.createJoint(record.definition, bodyA, bodyB, record.id));
                return;
            }
            case 'joint-remove': {
                const joint = this.joints.get(command.id);
                if (!joint)
                    return;
                world.removeJoint(joint);
                this.joints.delete(command.id);
                return;
            }
            case 'joint-update': {
                const joint = this.joints.get(command.id);
                if (!joint)
                    return;
                copyJointDefinition(joint.definition, command.definition);
                joint.markChanged();
                return;
            }
            case 'teleport': {
                const entry = this.bodies.get(command.id);
                if (!entry)
                    return;
                this.kinematicTargets.delete(command.id);
                world.teleport(entry.body, new Float32Array(command.position), new Float32Array(command.orientation));
                return;
            }
            case 'pose': {
                const entry = this.bodies.get(command.id);
                if (!entry)
                    return;
                entry.body.setPose(new Float32Array(command.position), new Float32Array(command.orientation));
                world.refreshAabb(entry.body);
                entry.body.wake();
                return;
            }
            case 'velocity': {
                const entry = this.bodies.get(command.id);
                if (!entry)
                    return;
                vec3.set(entry.body.linearVelocity, command.linear[0], command.linear[1], command.linear[2]);
                vec3.set(entry.body.angularVelocity, command.angular[0], command.angular[1], command.angular[2]);
                entry.body.wake();
                return;
            }
            case 'kinematic': {
                const entry = this.bodies.get(command.id);
                if (!entry)
                    return;
                const existing = this.kinematicTargets.get(command.id);
                if (existing) {
                    existing.position.set(command.position);
                    existing.orientation.set(command.orientation);
                    existing.remaining = Math.max(command.seconds, 0);
                }
                else {
                    this.kinematicTargets.set(command.id, {
                        position: new Float32Array(command.position),
                        orientation: new Float32Array(command.orientation),
                        remaining: Math.max(command.seconds, 0),
                    });
                }
                return;
            }
            case 'material': {
                const entry = this.bodies.get(command.id);
                entry?.body.setMaterial(command);
                return;
            }
            case 'layers-of': {
                const entry = this.bodies.get(command.id);
                if (!entry)
                    return;
                entry.body.layer = command.layer;
                entry.body.collisionMask = command.collisionMask;
                entry.body.wake();
                return;
            }
            case 'wake':
                this.bodies.get(command.id)?.body.wake();
                return;
            case 'sleep':
                this.bodies.get(command.id)?.body.sleep();
                return;
            case 'settings': {
                const target = world.settings as unknown as Record<string, unknown>;
                for (const [key, value] of Object.entries(command.settings)) {
                    if (key === 'gravity')
                        vec3.copy(world.settings.gravity, command.settings.gravity);
                    else
                        target[key] = value;
                }
                return;
            }
            case 'layers':
                world.layers.restore(command.snapshot);
                return;
            case 'water':
                this.syncWater(command.terrains);
                return;
            case 'clear':
                world.clear();
                this.bodies.clear();
                this.joints.clear();
                this.kinematicTargets.clear();
                this.frameForces.clear();
                this.waters.clear();
                this.installEngineFields(world);
                return;
            case 'buffer':
                this.poses = new PoseBuffer(command.buffer);
                return;
            case 'discard':
                world.discardAccumulatedTime();
                return;
            case 'step':
                return;
        }
    }
    private syncWater(records: readonly WaterTerrainRecord[]): void {
        const seen = new Set<number>();
        for (const record of records) {
            seen.add(record.key);
            const existing = this.waters.get(record.key);
            if (!existing) {
                if (!record.heights)
                    continue;
                const terrain = new SnapshotWaterTerrain(record, record.heights);
                const matrix = new Float32Array(record.matrix);
                this.waters.set(record.key, { terrain, matrix, volume: new WaterVolume(terrain, matrix as Mat4) });
                continue;
            }
            existing.terrain.update(record);
            let moved = false;
            for (let i = 0; i < 16; i++) {
                if (existing.matrix[i] !== record.matrix[i]) {
                    moved = true;
                    break;
                }
            }
            if (moved) {
                existing.matrix = new Float32Array(record.matrix);
                existing.volume = new WaterVolume(existing.terrain, existing.matrix as Mat4);
            }
        }
        for (const key of Array.from(this.waters.keys())) {
            if (!seen.has(key))
                this.waters.delete(key);
        }
    }
    private publish(world: PhysicsWorld, frame: number, steps: number, reply: PhysicsReplySink): void {
        const poses = this.ensurePoses();
        for (const { body, slot } of this.bodies.values()) {
            if (slot < poses.capacity)
                poses.writeBody(slot, body);
        }
        poses.commit(this.bodies.size, world.interpolation, steps);
        const contacts = this.collectContacts(world);
        const joints = this.collectJoints();
        const { backend: _backend, ...stats } = world.stats;
        const transfer: Transferable[] = [contacts.buffer, joints.buffer];
        const base = {
            type: 'frame' as const,
            frame,
            stats: { ...stats },
            interpolation: world.interpolation,
            contacts,
            joints,
            outOfBounds: this.outOfBounds.splice(0),
            unstable: this.unstable.splice(0),
        };
        if (poses.shared) {
            reply(base, transfer);
            return;
        }
        const buffer = poses.buffer as ArrayBuffer;
        this.poses = null;
        transfer.push(buffer);
        reply({ ...base, poses: buffer }, transfer);
    }
    private ensurePoses(): PoseBuffer {
        let needed = 0;
        for (const { slot } of this.bodies.values())
            needed = Math.max(needed, slot + 1);
        if (this.poses && this.poses.capacity >= needed)
            return this.poses;
        let capacity = this.poses?.capacity ?? 0;
        while (capacity < needed)
            capacity = capacity === 0 ? 256 : capacity * 2;
        let buffer: ArrayBuffer | null = null;
        while (this.spare.length > 0 && !buffer) {
            const candidate = this.spare.pop()!;
            if (PoseBuffer.capacityOf(candidate.byteLength) >= capacity)
                buffer = candidate;
        }
        this.poses = buffer ? new PoseBuffer(buffer) : PoseBuffer.allocate(capacity, false);
        return this.poses;
    }
}
