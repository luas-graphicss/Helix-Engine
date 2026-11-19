import * as vec3 from '@/engine/core/math/vec3';
import * as mat4 from '@/engine/core/math/mat4';
import { DEG_TO_RAD } from '@/engine/core/math/scalar';
import type { Entity } from '@/engine/core/scene/entity';
import type { RigidBody } from '@/engine/physics/body/rigid-body';
import type { PhysicsWorld } from '@/engine/physics/world/physics-world';
import { createDriveCommand, resolveDriveCommand } from '../drivetrain/drive-command';
import { Drivetrain } from '../drivetrain/drivetrain';
import type { GroundProbe } from '../ground/ground-probe';
import { createVehicleInput } from '../input/vehicle-input';
import { ackermannAngle, steerTowards } from '../steering/steering';
import { distributeSprungMass } from '../suspension/sprung-mass';
import { applySuspension, updateWheelContact } from '../suspension/wheel-contact';
import { finishTire, prepareTire, relaxTire, type TireStep } from '../tire/tire-forces';
import type { VehicleSettings } from '../vehicle-settings';
import type { WheelSettings } from '../wheel/wheel-settings';
import { captureWheelRig, restoreWheelPose } from './wheel-pose';
import { createWheelState, type WheelState } from './wheel-state';
const UNIT_Y = vec3.create(0, 1, 0);
const UNIT_Z = vec3.create(0, 0, 1);
const FULL_TURN = 2 * Math.PI;
const TIRE_SOLVER_SWEEPS = 4;
const hub = vec3.create();
const mount = vec3.create();
const drag = vec3.create();
export class VehicleInstance {
    readonly wheels: WheelState[] = [];
    readonly input = createVehicleInput();
    readonly drivetrain = new Drivetrain();
    steerAngle = 0;
    speed = 0;
    forwardSpeed = 0;
    private readonly command = createDriveCommand();
    private readonly forward = vec3.create(0, 0, 1);
    private readonly tireStep: TireStep = { deltaSeconds: 0, bodyRoll: 0, up: vec3.create(0, 1, 0), gravityStep: vec3.create(), push: vec3.create(), twist: vec3.create() };
    constructor(readonly entity: Entity, readonly body: RigidBody, private readonly world: PhysicsWorld, private readonly probe: GroundProbe) { }
    get engineRpm(): number {
        return this.drivetrain.engineRpm;
    }
    get gear(): number {
        return this.drivetrain.gearbox.gear;
    }
    get groundedWheelCount(): number {
        let grounded = 0;
        for (const wheel of this.wheels)
            if (wheel.grounded)
                grounded++;
        return grounded;
    }
    wheelOf(entity: Entity): WheelState | null {
        return this.wheels.find((wheel) => wheel.entity === entity) ?? null;
    }
    syncWheels(entities: readonly Entity[]): void {
        const { wheels } = this;
        const isUnchanged = entities.length === wheels.length && entities.every((entity, index) => wheels[index].entity === entity);
        if (!isUnchanged)
            this.rebuildWheels(entities);
        for (const wheel of wheels)
            wheel.settings = wheel.entity.wheel ?? wheel.settings;
    }
    restoreWheels(): void {
        for (const wheel of this.wheels)
            restoreWheelPose(wheel);
    }
    step(deltaSeconds: number): void {
        const { body, wheels, tireStep } = this;
        const settings = this.entity.vehicle;
        if (!settings || !body.isDynamic || body.outOfBounds || wheels.length === 0)
            return;
        body.localDirectionToWorld(tireStep.up, UNIT_Y);
        body.localDirectionToWorld(this.forward, UNIT_Z);
        this.speed = vec3.length(body.linearVelocity);
        this.forwardSpeed = vec3.dot(body.linearVelocity, this.forward);
        this.steer(settings, deltaSeconds);
        this.drivetrain.update(settings, wheels, resolveDriveCommand(this.command, this.input, this.forwardSpeed), deltaSeconds);
        vec3.scale(tireStep.gravityStep, this.world.settings.gravity, body.gravityScale * deltaSeconds);
        tireStep.deltaSeconds = deltaSeconds;
        tireStep.bodyRoll = settings.bodyRoll;
        const gravity = vec3.length(tireStep.gravityStep) / deltaSeconds;
        for (const wheel of wheels) {
            updateWheelContact(wheel, body, this.probe);
            applySuspension(wheel, body, gravity, deltaSeconds);
        }
        this.sweepTires(deltaSeconds);
        vec3.scale(drag, body.linearVelocity, -settings.airDrag * this.speed);
        body.addForce(drag);
    }
    private sweepTires(deltaSeconds: number): void {
        const { wheels, body, tireStep } = this;
        const last = wheels.length - 1;
        vec3.set(tireStep.push, 0, 0, 0);
        vec3.set(tireStep.twist, 0, 0, 0);
        for (const wheel of wheels)
            prepareTire(wheel, body, tireStep);
        for (let sweep = 0; sweep < TIRE_SOLVER_SWEEPS; sweep++)
            for (let index = 0; index <= last; index++)
                relaxTire(wheels[sweep % 2 === 0 ? index : last - index], body, tireStep);
        for (const wheel of wheels) {
            finishTire(wheel, body, tireStep);
            wheel.spinAngle = (wheel.spinAngle + wheel.angularVelocity * deltaSeconds) % FULL_TURN;
        }
    }
    private steer(settings: VehicleSettings, deltaSeconds: number): void {
        this.steerAngle = steerTowards(this.steerAngle, this.input.steer, this.speed, settings, deltaSeconds);
        const centerAngle = this.steerAngle * DEG_TO_RAD;
        const wheelbase = this.measureWheelbase();
        for (const wheel of this.wheels)
            wheel.steerAngle = wheel.settings.steering ? ackermannAngle(centerAngle, wheel.mount[0], wheelbase, settings.ackermann) : 0;
    }
    private measureWheelbase(): number {
        let steeringAxle = 0;
        let steeringCount = 0;
        let fixedAxle = 0;
        let fixedCount = 0;
        for (const wheel of this.wheels) {
            if (wheel.settings.steering) {
                steeringAxle += wheel.mount[2];
                steeringCount++;
            }
            else {
                fixedAxle += wheel.mount[2];
                fixedCount++;
            }
        }
        return steeringCount > 0 && fixedCount > 0 ? steeringAxle / steeringCount - fixedAxle / fixedCount : 0;
    }
    private rebuildWheels(entities: readonly Entity[]): void {
        const { wheels } = this;
        const previous = wheels.splice(0);
        for (const wheel of previous)
            if (!entities.includes(wheel.entity))
                restoreWheelPose(wheel);
        for (const entity of entities) {
            const settings = entity.wheel;
            if (settings)
                wheels.push(previous.find((wheel) => wheel.entity === entity) ?? this.createWheel(entity, settings));
        }
        this.balance();
    }
    private createWheel(entity: Entity, settings: WheelSettings): WheelState {
        mat4.getTranslation(hub, entity.worldMatrix);
        this.body.worldToLocal(mount, hub);
        return createWheelState(entity, settings, mount, captureWheelRig(entity, this.body));
    }
    private balance(): void {
        const { wheels, body } = this;
        const masses = distributeSprungMass(wheels.map((wheel) => wheel.mount), body.mass);
        wheels.forEach((wheel, index) => {
            wheel.sprungMass = masses[index];
        });
    }
}
