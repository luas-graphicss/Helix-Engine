import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { DirectionalField } from '@/engine/physics/forces/directional-field';
import { DragField } from '@/engine/physics/forces/drag-field';
import { applyExplosion } from '@/engine/physics/forces/explosion';
import { EVERYWHERE, boxRegion, sphereRegion, type FieldRegion } from '@/engine/physics/forces/field-region';
import { RadialField } from '@/engine/physics/forces/radial-field';
import type { FieldMode, RegionField } from '@/engine/physics/forces/region-field';
import { VortexField } from '@/engine/physics/forces/vortex-field';
import type { PhysicsWorld } from '@/engine/physics/world/physics-world';
import { HelixArgumentError } from '../runtime/script-errors';
import type { RuntimeHost } from '../runtime/runtime-host';
import { optionalNumber, requireNumber, requireObject, requireOneOf, toVec3 } from '../runtime/values';
export interface ForcesApiContext {
    readonly host: RuntimeHost;
    world(member: string): PhysicsWorld;
}
const MODES: readonly FieldMode[] = ['acceleration', 'force'];
const RADIAL_FALLOFFS = ['none', 'linear', 'inverse-square'] as const;
const VORTEX_FALLOFFS = ['none', 'linear'] as const;
function isRegion(value: unknown): value is FieldRegion {
    if (!value || typeof value !== 'object')
        return false;
    const kind = (value as {
        kind?: unknown;
    }).kind;
    return kind === 'everywhere' || kind === 'sphere' || kind === 'box';
}
function parseRegion(value: unknown, member: string): FieldRegion {
    if (value === undefined || value === null)
        return EVERYWHERE;
    if (isRegion(value))
        return value;
    const options = requireObject(value, member, 'a região');
    const falloff = optionalNumber(options.falloff, 0, member, 'falloff');
    if (options.radius !== undefined)
        return sphereRegion(toVec3(options.center, `${member}.center`), requireNumber(options.radius, member, 'o raio'), falloff);
    if (options.halfExtents !== undefined)
        return boxRegion(toVec3(options.center, `${member}.center`), toVec3(options.halfExtents, `${member}.halfExtents`), falloff);
    throw new HelixArgumentError(member, 'região inválida: use helix.physics.forces.sphere/box/everywhere, ou { center, radius } / { center, halfExtents }.');
}
export function createForcesApi(context: ForcesApiContext) {
    const { host } = context;
    function register<T extends RegionField>(field: T, options: Record<string, unknown>, member: string): T {
        field.region = parseRegion(options.region, `${member}.region`);
        if (options.enabled !== undefined)
            field.enabled = Boolean(options.enabled);
        const detach = context.world(member).addForceField(field);
        field.attach(detach);
        host.current?.track(() => field.remove());
        return field;
    }
    function vectorAccessor(target: Vec3, member: string, assign: (value: Vec3) => void = (value) => vec3.copy(target, value)) {
        return {
            get: () => target,
            set: (value: unknown) => assign(toVec3(value, member)),
        };
    }
    function baseHandle(field: RegionField, kind: string) {
        return {
            get raw() {
                return field;
            },
            get kind() {
                return kind;
            },
            get enabled() {
                return field.enabled;
            },
            set enabled(value: boolean) {
                field.enabled = Boolean(value);
            },
            get region() {
                return field.region;
            },
            set region(value: FieldRegion) {
                field.region = parseRegion(value, `helix.physics.forces.${kind}.region`);
            },
            get attached() {
                return field.attached;
            },
            remove: () => field.remove(),
        };
    }
    function numberProperty(get: () => number, set: (value: number) => void, member: string, what: string, min = -Infinity) {
        return {
            get,
            set: (value: unknown) => {
                const parsed = requireNumber(value, member, what);
                set(Math.max(parsed, min));
            },
            enumerable: true,
        };
    }
    return {
        everywhere: () => EVERYWHERE,
        sphere: (center: unknown, radius: unknown, falloff?: unknown) => {
            const member = 'helix.physics.forces.sphere';
            return sphereRegion(toVec3(center, member), requireNumber(radius, member, 'o raio'), optionalNumber(falloff, 0, member, 'falloff'));
        },
        box: (center: unknown, halfExtents: unknown, falloff?: unknown) => {
            const member = 'helix.physics.forces.box';
            return boxRegion(toVec3(center, member), toVec3(halfExtents, member), optionalNumber(falloff, 0, member, 'falloff'));
        },
        directional: (optionsValue: unknown) => {
            const member = 'helix.physics.forces.directional';
            const options = requireObject(optionsValue, member);
            const field = register(new DirectionalField({
                direction: toVec3(options.direction, `${member}.direction`),
                strength: requireNumber(options.strength, member, 'strength'),
                mode: options.mode === undefined ? 'acceleration' : requireOneOf(options.mode, MODES, member, 'mode'),
            }), options, member);
            const direction = vectorAccessor(field.direction, `${member}.direction`, (value) => field.setDirection(value));
            return Object.defineProperties(baseHandle(field, 'directional'), {
                direction: { get: direction.get, set: direction.set, enumerable: true },
                strength: numberProperty(() => field.strength, (value) => (field.strength = value), `${member}.strength`, 'strength'),
                mode: { get: () => field.mode, set: (value: unknown) => (field.mode = requireOneOf(value, MODES, member, 'mode')), enumerable: true },
            });
        },
        radial: (optionsValue: unknown) => {
            const member = 'helix.physics.forces.radial';
            const options = requireObject(optionsValue, member);
            const field = register(new RadialField({
                center: toVec3(options.center, `${member}.center`),
                strength: requireNumber(options.strength, member, 'strength'),
                radius: options.radius === undefined ? undefined : requireNumber(options.radius, member, 'radius'),
                falloff: options.falloff === undefined ? undefined : requireOneOf(options.falloff, RADIAL_FALLOFFS, member, 'falloff'),
                mode: options.mode === undefined ? undefined : requireOneOf(options.mode, MODES, member, 'mode'),
            }), options, member);
            const center = vectorAccessor(field.center, `${member}.center`);
            return Object.defineProperties(baseHandle(field, 'radial'), {
                center: { get: center.get, set: center.set, enumerable: true },
                strength: numberProperty(() => field.strength, (value) => (field.strength = value), `${member}.strength`, 'strength'),
                radius: numberProperty(() => field.radius, (value) => (field.radius = value), `${member}.radius`, 'radius', 0),
                falloff: { get: () => field.falloff, set: (value: unknown) => (field.falloff = requireOneOf(value, RADIAL_FALLOFFS, member, 'falloff')), enumerable: true },
                mode: { get: () => field.mode, set: (value: unknown) => (field.mode = requireOneOf(value, MODES, member, 'mode')), enumerable: true },
            });
        },
        vortex: (optionsValue: unknown) => {
            const member = 'helix.physics.forces.vortex';
            const options = requireObject(optionsValue, member);
            const field = register(new VortexField({
                center: toVec3(options.center, `${member}.center`),
                axis: options.axis === undefined ? undefined : toVec3(options.axis, `${member}.axis`),
                strength: requireNumber(options.strength, member, 'strength'),
                inwardStrength: options.inwardStrength === undefined ? undefined : requireNumber(options.inwardStrength, member, 'inwardStrength'),
                liftStrength: options.liftStrength === undefined ? undefined : requireNumber(options.liftStrength, member, 'liftStrength'),
                radius: options.radius === undefined ? undefined : requireNumber(options.radius, member, 'radius'),
                falloff: options.falloff === undefined ? undefined : requireOneOf(options.falloff, VORTEX_FALLOFFS, member, 'falloff'),
                mode: options.mode === undefined ? undefined : requireOneOf(options.mode, MODES, member, 'mode'),
            }), options, member);
            const center = vectorAccessor(field.center, `${member}.center`);
            const axis = vectorAccessor(field.axis, `${member}.axis`, (value) => field.setAxis(value));
            return Object.defineProperties(baseHandle(field, 'vortex'), {
                center: { get: center.get, set: center.set, enumerable: true },
                axis: { get: axis.get, set: axis.set, enumerable: true },
                strength: numberProperty(() => field.strength, (value) => (field.strength = value), `${member}.strength`, 'strength'),
                inwardStrength: numberProperty(() => field.inwardStrength, (value) => (field.inwardStrength = value), `${member}.inwardStrength`, 'inwardStrength'),
                liftStrength: numberProperty(() => field.liftStrength, (value) => (field.liftStrength = value), `${member}.liftStrength`, 'liftStrength'),
                radius: numberProperty(() => field.radius, (value) => (field.radius = value), `${member}.radius`, 'radius', 0),
                falloff: { get: () => field.falloff, set: (value: unknown) => (field.falloff = requireOneOf(value, VORTEX_FALLOFFS, member, 'falloff')), enumerable: true },
                mode: { get: () => field.mode, set: (value: unknown) => (field.mode = requireOneOf(value, MODES, member, 'mode')), enumerable: true },
            });
        },
        drag: (optionsValue?: unknown) => {
            const member = 'helix.physics.forces.drag';
            const options = optionsValue === undefined || optionsValue === null ? {} : requireObject(optionsValue, member);
            const field = register(new DragField({
                linear: options.linear === undefined ? undefined : requireNumber(options.linear, member, 'linear'),
                quadratic: options.quadratic === undefined ? undefined : requireNumber(options.quadratic, member, 'quadratic'),
                angular: options.angular === undefined ? undefined : requireNumber(options.angular, member, 'angular'),
            }), options, member);
            return Object.defineProperties(baseHandle(field, 'drag'), {
                linear: numberProperty(() => field.linear, (value) => (field.linear = value), `${member}.linear`, 'linear', 0),
                quadratic: numberProperty(() => field.quadratic, (value) => (field.quadratic = value), `${member}.quadratic`, 'quadratic', 0),
                angular: numberProperty(() => field.angular, (value) => (field.angular = value), `${member}.angular`, 'angular', 0),
            });
        },
        explode: (center: unknown, radius: unknown, strength: unknown, optionsValue?: unknown) => {
            const member = 'helix.physics.forces.explode';
            const options = optionsValue === undefined || optionsValue === null ? {} : requireObject(optionsValue, member);
            return applyExplosion(context.world(member), toVec3(center, member), requireNumber(radius, member, 'o raio'), requireNumber(strength, member, 'a intensidade'), {
                falloff: options.falloff === undefined ? undefined : requireOneOf(options.falloff, RADIAL_FALLOFFS, member, 'falloff'),
                upwardBias: options.upwardBias === undefined ? undefined : requireNumber(options.upwardBias, member, 'upwardBias'),
                mode: options.mode === undefined ? undefined : requireOneOf(options.mode, ['impulse', 'velocity'] as const, member, 'mode'),
            });
        },
        remove: (value: unknown) => {
            const raw = value && typeof value === 'object' ? ((value as {
                raw?: unknown;
            }).raw ?? value) : null;
            if (!raw || typeof (raw as RegionField).remove !== 'function')
                throw new HelixArgumentError('helix.physics.forces.remove', 'esperava o handle de um campo (devolvido por helix.physics.forces.*).');
            (raw as RegionField).remove();
        },
    };
}
