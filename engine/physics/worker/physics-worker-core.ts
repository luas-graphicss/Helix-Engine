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
}
