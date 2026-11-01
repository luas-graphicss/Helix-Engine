import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import * as quat from '@/engine/core/math/quat';
import type { Entity } from '@/engine/core/scene/entity';
import { RigidBody } from '@/engine/physics/body/rigid-body';
import type { Joint } from '@/engine/physics/joints/joint';
import { defineJointFromWorld, type WorldJointFrame } from '@/engine/physics/joints/joint-builder';
import { JOINT_TYPES, jointIsAngular, type JointDefinition, type JointLimits, type JointMotor, type JointSpring, type JointType } from '@/engine/physics/joints/joint-settings';
import type { PhysicsWorld } from '@/engine/physics/world/physics-world';
import { HelixArgumentError } from '../runtime/script-errors';
import type { RuntimeHost } from '../runtime/runtime-host';
import { requireFunction, requireNumber, requireObject, requireOneOf, toVec3 } from '../runtime/values';
export interface JointApiContext {
    readonly host: RuntimeHost;
    world(member: string): PhysicsWorld;
    bodyOf(value: unknown, member: string): RigidBody;
    wrapBody(body: RigidBody, member: string): object;
    entityOfBody(body: RigidBody): Entity | null;
}
const scratchAnchor = vec3.create();
function parseLimits(value: unknown, member: string, current: JointLimits): JointLimits {
    if (value === null || value === false)
        return { enabled: false, min: current.min, max: current.max };
    if (Array.isArray(value)) {
        if (value.length !== 2)
            throw new HelixArgumentError(member, 'limits como lista precisa de dois números: [min, max].');
        return { enabled: true, min: requireNumber(value[0], member, 'limits[0]'), max: requireNumber(value[1], member, 'limits[1]') };
    }
    const options = requireObject(value, member, 'limits');
    return {
        enabled: options.enabled === undefined ? true : Boolean(options.enabled),
        min: options.min === undefined ? current.min : requireNumber(options.min, member, 'limits.min'),
        max: options.max === undefined ? current.max : requireNumber(options.max, member, 'limits.max'),
    };
}
function parseMotor(value: unknown, member: string, current: JointMotor): JointMotor {
    if (value === null || value === false)
        return { enabled: false, targetVelocity: 0, maxForce: current.maxForce };
    const options = requireObject(value, member, 'motor');
    return {
        enabled: options.enabled === undefined ? true : Boolean(options.enabled),
        targetVelocity: options.targetVelocity === undefined ? current.targetVelocity : requireNumber(options.targetVelocity, member, 'motor.targetVelocity'),
        maxForce: options.maxForce === undefined ? (current.maxForce > 0 ? current.maxForce : Infinity) : requireNumber(options.maxForce, member, 'motor.maxForce'),
    };
}
function parseSpring(value: unknown, member: string, current: JointSpring): JointSpring {
    if (value === null || value === false)
        return { ...current, enabled: false };
    const options = requireObject(value, member, 'spring');
    return {
        enabled: options.enabled === undefined ? true : Boolean(options.enabled),
        hertz: options.hertz === undefined ? current.hertz : requireNumber(options.hertz, member, 'spring.hertz'),
        dampingRatio: options.dampingRatio === undefined ? current.dampingRatio : requireNumber(options.dampingRatio, member, 'spring.dampingRatio'),
        target: options.target === undefined ? current.target : requireNumber(options.target, member, 'spring.target'),
    };
}
function applyScalarOptions(definition: JointDefinition, options: Record<string, unknown>, member: string): void {
    if (options.enabled !== undefined)
        definition.enabled = Boolean(options.enabled);
    if (options.collideConnected !== undefined)
        definition.collideConnected = Boolean(options.collideConnected);
    if (options.breakForce !== undefined)
        definition.breakForce = options.breakForce === null ? Infinity : requireNumber(options.breakForce, member, 'breakForce');
    if (options.breakTorque !== undefined)
        definition.breakTorque = options.breakTorque === null ? Infinity : requireNumber(options.breakTorque, member, 'breakTorque');
    if (options.length !== undefined)
        definition.length = requireNumber(options.length, member, 'length');
    if (options.coneAngle !== undefined)
        definition.coneAngle = requireNumber(options.coneAngle, member, 'coneAngle');
    if (options.brakeTorque !== undefined)
        definition.brakeTorque = requireNumber(options.brakeTorque, member, 'brakeTorque');
    if (options.steeringAngle !== undefined)
        definition.steeringAngle = requireNumber(options.steeringAngle, member, 'steeringAngle');
    if (options.limits !== undefined)
        Object.assign(definition.limits, parseLimits(options.limits, member, definition.limits));
    if (options.motor !== undefined)
        Object.assign(definition.motor, parseMotor(options.motor, member, definition.motor));
    if (options.spring !== undefined)
        Object.assign(definition.spring, parseSpring(options.spring, member, definition.spring));
}
function parseFrame(options: Record<string, unknown>, member: string): WorldJointFrame {
    const frame: WorldJointFrame = {};
    if (options.anchor !== undefined && options.anchor !== null)
        frame.anchor = toVec3(options.anchor, `${member}.anchor`);
    if (options.anchorA !== undefined && options.anchorA !== null)
        frame.anchorA = toVec3(options.anchorA, `${member}.anchorA`);
    if (options.anchorB !== undefined && options.anchorB !== null)
        frame.anchorB = toVec3(options.anchorB, `${member}.anchorB`);
    if (options.axis !== undefined && options.axis !== null)
        frame.axis = toVec3(options.axis, `${member}.axis`);
    const secondary = options.secondaryAxis ?? options.axle;
    if (secondary !== undefined && secondary !== null)
        frame.secondaryAxis = toVec3(secondary, `${member}.secondaryAxis`);
    return frame;
}
