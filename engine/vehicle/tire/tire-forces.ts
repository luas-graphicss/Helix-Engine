import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import * as mat3 from '@/engine/core/math/mat3';
import { clamp } from '@/engine/core/math/scalar';
import type { RigidBody } from '@/engine/physics/body/rigid-body';
import type { GroundHit } from '../ground/ground-probe';
import type { WheelState } from '../runtime/wheel-state';
import { applyGroundReaction } from '../suspension/wheel-contact';
import { evaluateWheelFriction } from '../wheel/wheel-friction';
const ROLLING_RESISTANCE = 0.012;
const SLIP_REFERENCE_SPEED = 2;
const ABS_GRIP_USAGE = 0.85;
const REFERENCE_SURFACE_FRICTION = 0.6;
const MAX_SURFACE_GRIP = 1.25;
const MIN_HEADING_LENGTH = 1e-4;
export interface TireStep {
    deltaSeconds: number;
    bodyRoll: number;
    readonly up: Vec3;
    readonly gravityStep: Vec3;
    readonly push: Vec3;
    readonly twist: Vec3;
}
const heading = vec3.create();
const velocity = vec3.create();
const linear = vec3.create();
const angular = vec3.create();
const arm = vec3.create();
const lever = vec3.create();
const turned = vec3.create();
const groundVelocity = vec3.create();
const force = vec3.create();
function slowTowardsRest(speed: number, stride: number): number {
    return Math.abs(speed) <= stride ? 0 : speed - Math.sign(speed) * stride;
}
function spinFreely(wheel: WheelState, deltaSeconds: number): void {
    const stride = ((wheel.serviceBrakeTorque + wheel.holdingBrakeTorque) * deltaSeconds) / wheel.inertia;
    wheel.angularVelocity = slowTowardsRest(wheel.angularVelocity, stride);
    wheel.longitudinalSlip = 0;
    wheel.lateralSlip = 0;
}
function surfaceGrip(contact: GroundHit): number {
    return clamp((contact.body?.friction ?? REFERENCE_SURFACE_FRICTION) / REFERENCE_SURFACE_FRICTION, 0, MAX_SURFACE_GRIP);
}
function resolveContactFrame(wheel: WheelState, body: RigidBody): boolean {
    const { forward, side } = wheel.patch;
    const { normal } = wheel.contact;
    vec3.set(heading, -Math.sin(wheel.steerAngle), 0, Math.cos(wheel.steerAngle));
    body.localDirectionToWorld(heading, heading);
    vec3.scaleAndAdd(forward, heading, normal, -vec3.dot(heading, normal));
    const length = vec3.length(forward);
    if (length < MIN_HEADING_LENGTH)
        return false;
    vec3.scale(forward, forward, 1 / length);
    vec3.cross(side, normal, forward);
    return true;
}
function locateForcePoint(wheel: WheelState, body: RigidBody, step: TireStep): void {
    const { point } = wheel.contact;
    vec3.subtract(arm, body.position, point);
    const lift = Math.max(0, vec3.dot(arm, step.up)) * (1 - step.bodyRoll);
    vec3.scaleAndAdd(wheel.patch.point, point, step.up, lift);
}
function inverseMassAlong(body: RigidBody, point: Vec3, direction: Vec3): number {
    vec3.subtract(arm, point, body.position);
    vec3.cross(lever, arm, direction);
    mat3.transformVec3(turned, body.invInertiaWorld, lever);
    return body.invMass + vec3.dot(lever, turned);
}
function brakeWheel(wheel: WheelState, stride: number): number {
    const spin = Math.abs(wheel.angularVelocity);
    wheel.angularVelocity = slowTowardsRest(wheel.angularVelocity, stride);
    return Math.max(0, stride - spin);
}
function predictContactVelocity(body: RigidBody, contact: GroundHit, step: TireStep): void {
    const { deltaSeconds } = step;
    vec3.add(linear, body.force, step.push);
    vec3.scaleAndAdd(linear, body.linearVelocity, linear, body.invMass * deltaSeconds);
    vec3.add(linear, linear, step.gravityStep);
    vec3.add(angular, body.torque, step.twist);
    mat3.transformVec3(angular, body.invInertiaWorld, angular);
    vec3.scaleAndAdd(angular, body.angularVelocity, angular, deltaSeconds);
    vec3.subtract(arm, contact.point, body.position);
    vec3.cross(velocity, angular, arm);
    vec3.add(velocity, velocity, linear);
    const ground = contact.body;
    if (!ground || ground.isStatic)
        return;
    ground.velocityAtPoint(groundVelocity, contact.point);
    vec3.subtract(velocity, velocity, groundVelocity);
}
function rollingSpin(wheel: WheelState, forwardForce: number, deltaSeconds: number): number {
    const { patch } = wheel;
    const roadStride = (Math.abs(forwardForce) * wheel.settings.radius * deltaSeconds) / wheel.inertia;
    return patch.brakedSpin - Math.sign(forwardForce) * Math.max(0, roadStride - patch.leftoverStride);
}
function solveTraction(wheel: WheelState, forwardSpeed: number, deltaSeconds: number): number {
    const { patch, inertia } = wheel;
    const { radius } = wheel.settings;
    const grip = patch.forwardGrip;
    const isBraked = patch.leftoverStride > 0;
    const holdForce = (patch.leftoverStride * inertia) / (deltaSeconds * radius);
    const lockForce = clamp(patch.forwardForce - forwardSpeed / patch.forwardCompliance, -grip, grip);
    patch.isLocked = isBraked && Math.abs(lockForce) <= holdForce;
    if (patch.isLocked)
        return lockForce;
    const rollingCompliance = patch.forwardCompliance + (deltaSeconds * radius * radius) / inertia;
    const slipSpeed = rollingSpin(wheel, patch.forwardForce, deltaSeconds) * radius - forwardSpeed;
    const rollingForce = clamp(patch.forwardForce + slipSpeed / rollingCompliance, -grip, grip);
    patch.isLocked = isBraked && Math.abs(rollingForce) <= holdForce;
    return patch.isLocked ? Math.sign(lockForce) * holdForce : rollingForce;
}
function accumulate(wheel: WheelState, body: RigidBody, step: TireStep, forwardChange: number, sideChange: number): void {
    const { patch } = wheel;
    vec3.scale(force, patch.forward, forwardChange);
    vec3.scaleAndAdd(force, force, patch.side, sideChange);
    vec3.add(step.push, step.push, force);
    vec3.subtract(arm, patch.point, body.position);
    vec3.cross(lever, arm, force);
    vec3.add(step.twist, step.twist, lever);
}
export function prepareTire(wheel: WheelState, body: RigidBody, step: TireStep): void {
    const { patch, settings } = wheel;
    const { deltaSeconds } = step;
    wheel.angularVelocity += (wheel.driveTorque * deltaSeconds) / wheel.inertia;
    patch.forwardForce = 0;
    patch.sideForce = 0;
    patch.isLocked = false;
    patch.isActive = wheel.grounded && wheel.load > 0 && resolveContactFrame(wheel, body);
    if (!patch.isActive) {
        spinFreely(wheel, deltaSeconds);
        return;
    }
    const { radius, forwardFriction, sidewaysFriction } = settings;
    locateForcePoint(wheel, body, step);
    patch.forwardCompliance = inverseMassAlong(body, patch.point, patch.forward) * deltaSeconds;
    patch.sideCompliance = inverseMassAlong(body, patch.point, patch.side) * deltaSeconds;
    const grip = surfaceGrip(wheel.contact) * wheel.load;
    patch.forwardGrip = evaluateWheelFriction(forwardFriction, wheel.longitudinalSlip) * grip;
    patch.sideGrip = evaluateWheelFriction(sidewaysFriction, wheel.lateralSlip) * grip;
    const peakTorque = forwardFriction.extremumValue * forwardFriction.stiffness * grip * radius;
    const brakeTorque = Math.min(wheel.serviceBrakeTorque, peakTorque * ABS_GRIP_USAGE) + wheel.holdingBrakeTorque + ROLLING_RESISTANCE * wheel.load * radius;
    patch.leftoverStride = brakeWheel(wheel, (brakeTorque * deltaSeconds) / wheel.inertia);
    patch.brakedSpin = wheel.angularVelocity;
}
export function relaxTire(wheel: WheelState, body: RigidBody, step: TireStep): void {
    const { patch } = wheel;
    if (!patch.isActive)
        return;
    predictContactVelocity(body, wheel.contact, step);
    let forwardForce = solveTraction(wheel, vec3.dot(velocity, patch.forward), step.deltaSeconds);
    let sideForce = clamp(patch.sideForce - vec3.dot(velocity, patch.side) / patch.sideCompliance, -patch.sideGrip, patch.sideGrip);
    const usage = Math.hypot(patch.forwardGrip > 0 ? forwardForce / patch.forwardGrip : 0, patch.sideGrip > 0 ? sideForce / patch.sideGrip : 0);
    if (usage > 1) {
        forwardForce /= usage;
        sideForce /= usage;
    }
    accumulate(wheel, body, step, forwardForce - patch.forwardForce, sideForce - patch.sideForce);
    patch.forwardForce = forwardForce;
    patch.sideForce = sideForce;
}
export function finishTire(wheel: WheelState, body: RigidBody, step: TireStep): void {
    const { patch } = wheel;
    if (!patch.isActive)
        return;
    predictContactVelocity(body, wheel.contact, step);
    const forwardSpeed = vec3.dot(velocity, patch.forward);
    const surfaceSpeed = (patch.isLocked ? patch.brakedSpin : rollingSpin(wheel, patch.forwardForce, step.deltaSeconds)) * wheel.settings.radius;
    const slipReference = Math.max(Math.abs(forwardSpeed), SLIP_REFERENCE_SPEED);
    wheel.angularVelocity = surfaceSpeed / wheel.settings.radius;
    wheel.longitudinalSlip = Math.abs(surfaceSpeed - forwardSpeed) / Math.max(slipReference, Math.abs(surfaceSpeed));
    wheel.lateralSlip = Math.abs(vec3.dot(velocity, patch.side)) / slipReference;
    vec3.scale(force, patch.forward, patch.forwardForce);
    vec3.scaleAndAdd(force, force, patch.side, patch.sideForce);
    body.addForceAtPoint(force, patch.point);
    applyGroundReaction(wheel.contact, force);
}
