import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import * as quat from '@/engine/core/math/quat';
import type { Quat } from '@/engine/core/math/quat';
import { clamp } from '@/engine/core/math/scalar';
export type JointType = 'ball' | 'hinge' | 'slider' | 'fixed' | 'distance' | 'cone-twist' | 'wheel';
export const JOINT_TYPES: readonly JointType[] = ['ball', 'hinge', 'slider', 'fixed', 'distance', 'cone-twist', 'wheel'];
export interface JointLimits {
    enabled: boolean;
    min: number;
    max: number;
}
export interface JointMotor {
    enabled: boolean;
    targetVelocity: number;
    maxForce: number;
}
export interface JointSpring {
    enabled: boolean;
    hertz: number;
    dampingRatio: number;
    target: number;
}
export interface JointDefinition {
    type: JointType;
    localAnchorA: Vec3;
    localAnchorB: Vec3;
    localAxisA: Vec3;
    localAxisB: Vec3;
    localSecondaryA: Vec3;
    localSecondaryB: Vec3;
    referenceRotation: Quat;
    enabled: boolean;
    collideConnected: boolean;
    limits: JointLimits;
    motor: JointMotor;
    spring: JointSpring;
    length: number;
    coneAngle: number;
    brakeTorque: number;
    steeringAngle: number;
    breakForce: number;
    breakTorque: number;
}
export const MAX_JOINT_HERTZ = 240;
export const MAX_JOINT_DAMPING_RATIO = 100;
export const MAX_JOINT_FORCE = 1e9;
export const MAX_JOINT_VELOCITY = 1e4;
export const MAX_STEERING_ANGLE = Math.PI / 2;
const MIN_CONE_ANGLE = 0.01;
const MAX_CONE_ANGLE = Math.PI - 0.01;
export function createJointLimits(overrides: Partial<JointLimits> = {}): JointLimits {
    return { enabled: false, min: 0, max: 0, ...overrides };
}
export function createJointMotor(overrides: Partial<JointMotor> = {}): JointMotor {
    return { enabled: false, targetVelocity: 0, maxForce: 0, ...overrides };
}
export function createJointSpring(overrides: Partial<JointSpring> = {}): JointSpring {
    return { enabled: false, hertz: 0, dampingRatio: 1, target: 0, ...overrides };
}
export function createJointDefinition(type: JointType, overrides: Partial<JointDefinition> = {}): JointDefinition {
    return {
        type,
        localAnchorA: vec3.create(),
        localAnchorB: vec3.create(),
        localAxisA: vec3.create(0, 1, 0),
        localAxisB: vec3.create(0, 1, 0),
        localSecondaryA: vec3.create(1, 0, 0),
        localSecondaryB: vec3.create(1, 0, 0),
        referenceRotation: quat.create(),
        enabled: true,
        collideConnected: false,
        limits: createJointLimits(),
        motor: createJointMotor(),
        spring: createJointSpring(),
        length: 1,
        coneAngle: Math.PI / 4,
        brakeTorque: 0,
        steeringAngle: 0,
        breakForce: Infinity,
        breakTorque: Infinity,
        ...overrides,
    };
}
export function cloneJointDefinition(definition: JointDefinition): JointDefinition {
    return {
        ...definition,
        localAnchorA: vec3.copy(vec3.create(), definition.localAnchorA),
        localAnchorB: vec3.copy(vec3.create(), definition.localAnchorB),
        localAxisA: vec3.copy(vec3.create(), definition.localAxisA),
        localAxisB: vec3.copy(vec3.create(), definition.localAxisB),
        localSecondaryA: vec3.copy(vec3.create(), definition.localSecondaryA),
        localSecondaryB: vec3.copy(vec3.create(), definition.localSecondaryB),
        referenceRotation: quat.copy(quat.create(), definition.referenceRotation),
        limits: { ...definition.limits },
        motor: { ...definition.motor },
        spring: { ...definition.spring },
    };
}
export function copyJointDefinition(out: JointDefinition, source: JointDefinition): JointDefinition {
    out.type = source.type;
    vec3.copy(out.localAnchorA, source.localAnchorA);
    vec3.copy(out.localAnchorB, source.localAnchorB);
    vec3.copy(out.localAxisA, source.localAxisA);
    vec3.copy(out.localAxisB, source.localAxisB);
    vec3.copy(out.localSecondaryA, source.localSecondaryA);
    vec3.copy(out.localSecondaryB, source.localSecondaryB);
    quat.copy(out.referenceRotation, source.referenceRotation);
    out.enabled = source.enabled;
    out.collideConnected = source.collideConnected;
    Object.assign(out.limits, source.limits);
    Object.assign(out.motor, source.motor);
    Object.assign(out.spring, source.spring);
    out.length = source.length;
    out.coneAngle = source.coneAngle;
    out.brakeTorque = source.brakeTorque;
    out.steeringAngle = source.steeringAngle;
    out.breakForce = source.breakForce;
    out.breakTorque = source.breakTorque;
    return out;
}
function finiteOr(value: number, fallback: number): number {
    return Number.isFinite(value) ? value : fallback;
}
function sanitizeForce(value: number): number {
    if (Number.isNaN(value) || value < 0)
        return 0;
    return value > MAX_JOINT_FORCE ? Infinity : value;
}
function sanitizeAxis(axis: Vec3, fallback: Vec3): void {
    if (!Number.isFinite(axis[0]) || !Number.isFinite(axis[1]) || !Number.isFinite(axis[2]) || vec3.length(axis) < 1e-6) {
        vec3.copy(axis, fallback);
        return;
    }
    vec3.normalize(axis, axis);
}
function orthogonalize(secondary: Vec3, axis: Vec3): void {
    const along = vec3.dot(secondary, axis);
    secondary[0] -= axis[0] * along;
    secondary[1] -= axis[1] * along;
    secondary[2] -= axis[2] * along;
    if (vec3.length(secondary) < 1e-6) {
        const pick = Math.abs(axis[1]) < 0.9 ? vec3.set(secondary, 0, 1, 0) : vec3.set(secondary, 1, 0, 0);
        vec3.cross(secondary, pick, axis);
    }
    vec3.normalize(secondary, secondary);
}
const DEFAULT_AXIS = vec3.create(0, 1, 0);
const DEFAULT_SECONDARY = vec3.create(1, 0, 0);
export function sanitizeJointDefinition(definition: JointDefinition): JointDefinition {
    for (const anchor of [definition.localAnchorA, definition.localAnchorB]) {
        for (let axis = 0; axis < 3; axis++)
            anchor[axis] = finiteOr(anchor[axis], 0);
    }
    sanitizeAxis(definition.localAxisA, DEFAULT_AXIS);
    sanitizeAxis(definition.localAxisB, DEFAULT_AXIS);
    sanitizeAxis(definition.localSecondaryA, DEFAULT_SECONDARY);
    sanitizeAxis(definition.localSecondaryB, DEFAULT_SECONDARY);
    orthogonalize(definition.localSecondaryA, definition.localAxisA);
    orthogonalize(definition.localSecondaryB, definition.localAxisB);
    quat.normalize(definition.referenceRotation, definition.referenceRotation);
    const { limits, motor, spring } = definition;
    limits.min = finiteOr(limits.min, 0);
    limits.max = finiteOr(limits.max, 0);
    if (limits.min > limits.max) {
        const min = limits.min;
        limits.min = limits.max;
        limits.max = min;
    }
    if (definition.type === 'hinge' || definition.type === 'cone-twist') {
        limits.min = clamp(limits.min, -Math.PI, Math.PI);
        limits.max = clamp(limits.max, -Math.PI, Math.PI);
    }
    else if (definition.type === 'distance') {
        limits.min = Math.max(limits.min, 0);
        limits.max = Math.max(limits.max, limits.min);
    }
    motor.targetVelocity = clamp(finiteOr(motor.targetVelocity, 0), -MAX_JOINT_VELOCITY, MAX_JOINT_VELOCITY);
    motor.maxForce = sanitizeForce(motor.maxForce);
    spring.hertz = clamp(finiteOr(spring.hertz, 0), 0, MAX_JOINT_HERTZ);
    spring.dampingRatio = clamp(finiteOr(spring.dampingRatio, 1), 0, MAX_JOINT_DAMPING_RATIO);
    spring.target = finiteOr(spring.target, 0);
    if (definition.type === 'hinge')
        spring.target = clamp(spring.target, -Math.PI, Math.PI);
    definition.length = Math.max(finiteOr(definition.length, 1), 0);
    definition.coneAngle = clamp(finiteOr(definition.coneAngle, Math.PI / 4), MIN_CONE_ANGLE, MAX_CONE_ANGLE);
    definition.brakeTorque = sanitizeForce(definition.brakeTorque);
    definition.steeringAngle = clamp(finiteOr(definition.steeringAngle, 0), -MAX_STEERING_ANGLE, MAX_STEERING_ANGLE);
    definition.breakForce = sanitizeForce(definition.breakForce) || Infinity;
    definition.breakTorque = sanitizeForce(definition.breakTorque) || Infinity;
    return definition;
}
export function jointIsAngular(type: JointType): boolean {
    return type === 'hinge' || type === 'cone-twist' || type === 'wheel';
}
