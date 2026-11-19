import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { RigidBody } from '@/engine/physics/body/rigid-body';
import type { GroundHit, GroundProbe } from '../ground/ground-probe';
import type { WheelState } from '../runtime/wheel-state';
import { BUMP_TRAVEL_RATIO, suspensionForce } from './suspension-force';
const MIN_GROUND_ALIGNMENT = 0.1;
const UNIT_Y = vec3.create(0, 1, 0);
const up = vec3.create();
const down = vec3.create();
const travelTop = vec3.create();
const origin = vec3.create();
const relative = vec3.create();
const groundVelocity = vec3.create();
const support = vec3.create();
const reaction = vec3.create();
export function relativeContactVelocity(out: Vec3, body: RigidBody, contact: GroundHit): Vec3 {
    body.velocityAtPoint(out, contact.point);
    const ground = contact.body;
    if (!ground || ground.isStatic)
        return out;
    ground.velocityAtPoint(groundVelocity, contact.point);
    return vec3.subtract(out, out, groundVelocity);
}
export function applyGroundReaction(contact: GroundHit, force: Vec3): void {
    const ground = contact.body;
    if (!ground?.isDynamic)
        return;
    vec3.scale(reaction, force, -1);
    ground.addForceAtPoint(reaction, contact.point);
}
export function updateWheelContact(wheel: WheelState, body: RigidBody, probe: GroundProbe): void {
    const { settings, contact, mount } = wheel;
    const bump = settings.suspensionTravel * BUMP_TRAVEL_RATIO;
    body.localDirectionToWorld(up, UNIT_Y);
    vec3.scale(down, up, -1);
    vec3.set(travelTop, mount[0], mount[1] + bump, mount[2]);
    body.localToWorld(origin, travelTop);
    const reached = probe.cast(origin, down, settings.suspensionTravel + settings.radius, body, contact);
    const alignment = reached ? vec3.dot(contact.normal, up) : 0;
    wheel.grounded = alignment >= MIN_GROUND_ALIGNMENT;
    if (!wheel.grounded) {
        wheel.compression = bump - settings.suspensionTravel;
        wheel.compressionSpeed = 0;
        return;
    }
    wheel.compression = bump + settings.radius - contact.distance;
    relativeContactVelocity(relative, body, contact);
    wheel.compressionSpeed = -vec3.dot(relative, contact.normal) / alignment;
}
export function applySuspension(wheel: WheelState, body: RigidBody, gravity: number, deltaSeconds: number): void {
    wheel.load = wheel.grounded ? suspensionForce(wheel, wheel.settings, gravity, deltaSeconds) : 0;
    if (wheel.load <= 0)
        return;
    vec3.scale(support, wheel.contact.normal, wheel.load);
    body.addForceAtPoint(support, wheel.contact.point);
    applyGroundReaction(wheel.contact, support);
}
