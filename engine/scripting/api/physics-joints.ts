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
export function createJointsApi(context: JointApiContext) {
    const { host } = context;
    const wrappers = new WeakMap<Joint, object>();
    function bodyArgument(value: unknown, member: string, what: string): RigidBody {
        if (value instanceof RigidBody)
            return value;
        const raw = value && typeof value === 'object' ? (value as {
            raw?: unknown;
        }).raw : undefined;
        if (raw instanceof RigidBody)
            return raw;
        try {
            return context.bodyOf(value, member);
        }
        catch (cause) {
            throw new HelixArgumentError(member, `${what}: ${cause instanceof Error ? cause.message.replace(/^[^:]*:\s*/, '') : String(cause)}`);
        }
    }
    function anchorWorld(out: Vec3, body: RigidBody, local: Vec3): Vec3 {
        quat.rotateVec3(out, body.orientation, local);
        return vec3.add(out, out, body.position);
    }
    function wrapJoint(joint: Joint, member: string): object {
        const cached = wrappers.get(joint);
        if (cached)
            return cached;
        const definition = joint.definition;
        const changed = () => joint.markChanged();
        const isGround = () => joint.bodyB.id === 0;
        const wrapper = {
            get raw() {
                return joint;
            },
            get id() {
                return joint.id;
            },
            get type() {
                return joint.type;
            },
            get isAngular() {
                return jointIsAngular(joint.type);
            },
            get bodyA() {
                return context.wrapBody(joint.bodyA, member);
            },
            get bodyB() {
                return isGround() ? null : context.wrapBody(joint.bodyB, member);
            },
            get entityA() {
                return context.entityOfBody(joint.bodyA);
            },
            get entityB() {
                return isGround() ? null : context.entityOfBody(joint.bodyB);
            },
            get anchorA() {
                return anchorWorld(vec3.create(), joint.bodyA, definition.localAnchorA);
            },
            get anchorB() {
                return anchorWorld(vec3.create(), joint.bodyB, definition.localAnchorB);
            },
            get axis() {
                return quat.rotateVec3(vec3.create(), joint.bodyA.orientation, definition.localAxisA);
            },
            get enabled() {
                return definition.enabled;
            },
            set enabled(value: boolean) {
                definition.enabled = Boolean(value);
                changed();
            },
            get collideConnected() {
                return definition.collideConnected;
            },
            set collideConnected(value: boolean) {
                definition.collideConnected = Boolean(value);
                changed();
            },
            get isBroken() {
                return joint.broken;
            },
            get isActive() {
                return joint.isActive;
            },
            get coordinate() {
                return joint.coordinate;
            },
            get speed() {
                return joint.speed;
            },
            get reactionForce() {
                return joint.reactionForce;
            },
            get reactionTorque() {
                return joint.reactionTorque;
            },
            get axialForce() {
                return joint.axialForce;
            },
            get motorForce() {
                return joint.motorForce;
            },
            get limits() {
                return { ...definition.limits };
            },
            setLimits: (min: unknown, max: unknown) => {
                definition.limits.enabled = true;
                definition.limits.min = requireNumber(min, 'joint.setLimits', 'o mínimo');
                definition.limits.max = requireNumber(max, 'joint.setLimits', 'o máximo');
                changed();
            },
            clearLimits: () => {
                definition.limits.enabled = false;
                changed();
            },
            get motor() {
                return { ...definition.motor };
            },
            setMotor: (targetVelocity: unknown, maxForce?: unknown) => {
                Object.assign(definition.motor, parseMotor({ targetVelocity, maxForce }, 'joint.setMotor', definition.motor));
                changed();
            },
            stopMotor: () => {
                definition.motor.enabled = false;
                definition.motor.targetVelocity = 0;
                changed();
            },
            get spring() {
                return { ...definition.spring };
            },
            setSpring: (hertz: unknown, dampingRatio?: unknown, target?: unknown) => {
                Object.assign(definition.spring, parseSpring({ hertz, dampingRatio, target }, 'joint.setSpring', definition.spring));
                changed();
            },
            clearSpring: () => {
                definition.spring.enabled = false;
                changed();
            },
            get breakForce() {
                return definition.breakForce;
            },
            set breakForce(value: number) {
                definition.breakForce = value === null ? Infinity : requireNumber(value, 'joint.breakForce', 'a força de quebra');
                changed();
            },
            get breakTorque() {
                return definition.breakTorque;
            },
            set breakTorque(value: number) {
                definition.breakTorque = value === null ? Infinity : requireNumber(value, 'joint.breakTorque', 'o torque de quebra');
                changed();
            },
            get length() {
                return definition.length;
            },
            set length(value: number) {
                definition.length = requireNumber(value, 'joint.length', 'o comprimento');
                changed();
            },
            get coneAngle() {
                return definition.coneAngle;
            },
            set coneAngle(value: number) {
                definition.coneAngle = requireNumber(value, 'joint.coneAngle', 'o ângulo do cone');
                changed();
            },
            get brakeTorque() {
                return definition.brakeTorque;
            },
            set brakeTorque(value: number) {
                definition.brakeTorque = requireNumber(value, 'joint.brakeTorque', 'o torque de freio');
                changed();
            },
            get steeringAngle() {
                return definition.steeringAngle;
            },
            set steeringAngle(value: number) {
                definition.steeringAngle = requireNumber(value, 'joint.steeringAngle', 'o ângulo de esterço');
                changed();
            },
            set: (patch: unknown) => {
                applyScalarOptions(definition, requireObject(patch, 'joint.set', 'as opções'), 'joint.set');
                changed();
            },
            break: () => {
                if (!joint.broken)
                    context.world('joint.break').reportJointBreak(joint);
            },
            remove: () => context.world('joint.remove').removeJoint(joint),
        };
        wrappers.set(joint, wrapper);
        return wrapper;
    }
    function create(type: JointType, a: unknown, b: unknown, optionsValue: unknown, member: string): object {
        const world = context.world(member);
        const bodyA = bodyArgument(a, member, 'o primeiro corpo');
        const bodyB = b === undefined || b === null ? null : bodyArgument(b, member, 'o segundo corpo');
        if (bodyB === bodyA)
            throw new HelixArgumentError(member, 'uma junta precisa de dois corpos diferentes (ou um corpo e o mundo, com b nulo).');
        if (bodyB === null && !bodyA.isDynamic)
            throw new HelixArgumentError(member, 'uma junta com o mundo precisa de um corpo dinâmico; um estático ou cinemático já está preso ao mundo.');
        const options = optionsValue === undefined || optionsValue === null ? {} : requireObject(optionsValue, member, 'as opções');
        const definition = defineJointFromWorld(type, bodyA, bodyB, parseFrame(options, member));
        applyScalarOptions(definition, options, member);
        const joint = world.createJoint(definition, bodyA, bodyB);
        host.current?.track(() => {
            if (world.joints.includes(joint))
                world.removeJoint(joint);
        });
        return wrapJoint(joint, member);
    }
    function unwrapJoint(value: unknown, member: string): Joint | null {
        const raw = value && typeof value === 'object' ? (value as {
            raw?: unknown;
        }).raw : undefined;
        const joint = (raw ?? value) as Joint | null;
        if (!joint || typeof joint !== 'object' || typeof (joint as Joint).markChanged !== 'function')
            throw new HelixArgumentError(member, 'esperava o handle de uma junta (devolvido por helix.physics.joints.*).');
        return joint;
    }
    const typed = (type: JointType, name: string) => (a: unknown, b: unknown, options?: unknown) => create(type, a, b, options, `helix.physics.joints.${name}`);
    return {
        get types() {
            return JOINT_TYPES.slice();
        },
        create: (type: unknown, a: unknown, b: unknown, options?: unknown) => create(requireOneOf(type, JOINT_TYPES, 'helix.physics.joints.create', 'o tipo de junta'), a, b, options, 'helix.physics.joints.create'),
        ball: typed('ball', 'ball'),
        hinge: typed('hinge', 'hinge'),
        slider: typed('slider', 'slider'),
        fixed: typed('fixed', 'fixed'),
        distance: typed('distance', 'distance'),
        coneTwist: typed('cone-twist', 'coneTwist'),
        wheel: typed('wheel', 'wheel'),
        remove: (value: unknown) => {
            const joint = unwrapJoint(value, 'helix.physics.joints.remove');
            if (joint)
                context.world('helix.physics.joints.remove').removeJoint(joint);
        },
        all: () => context.world('helix.physics.joints.all').joints.map((joint) => wrapJoint(joint, 'helix.physics.joints.all')),
        of: (value: unknown) => {
            const member = 'helix.physics.joints.of';
            const body = bodyArgument(value, member, 'o corpo');
            return context.world(member).joints.filter((joint) => joint.bodyA === body || joint.bodyB === body).map((joint) => wrapJoint(joint, member));
        },
        get count() {
            return host.session.playtest.physics?.world.joints.length ?? 0;
        },
        onBreak: (handler: unknown) => host.bus.on('physics.jointBreak', requireFunction(handler, 'helix.physics.joints.onBreak') as (payload: unknown) => void, host.current),
        _broken: (joint: Joint) => {
            const handle = wrapJoint(joint, 'helix.physics.joints.onBreak');
            const isGround = joint.bodyB.id === 0;
            host.bus.emit('physics.jointBreak', { joint: handle, a: context.entityOfBody(joint.bodyA), b: isGround ? null : context.entityOfBody(joint.bodyB) });
        },
    };
}
