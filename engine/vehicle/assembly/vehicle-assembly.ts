import * as vec3 from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import { createMaterial } from '@/engine/core/scene/material';
import type { Scene } from '@/engine/core/scene/scene';
import { createRigidBodySettings } from '@/engine/physics/body/rigid-body-settings';
import { createBox } from '@/engine/renderer/geometry/primitives';
import type { AxleBlueprint, VehicleBlueprint, VehiclePreset } from '../vehicle-presets';
import { cloneVehicleSettings } from '../vehicle-settings';
import { createWheelActor } from './wheel-actor';
const LEFT = 1;
const RIGHT = -1;
const SIDE_SUFFIX = { [LEFT]: 'E', [RIGHT]: 'D' } as const;
const CABIN_COLOR = vec3.create(0.08, 0.1, 0.13);
export function vehicleRestHeight(blueprint: VehicleBlueprint): number {
    return blueprint.chassisSize[1] * 0.5 + blueprint.groundClearance;
}
function addAxle(scene: Scene, chassis: Entity, blueprint: VehicleBlueprint, axle: AxleBlueprint, index: number): void {
    const hubHeight = axle.wheel.radius - vehicleRestHeight(blueprint);
    for (const side of [LEFT, RIGHT] as const) {
        createWheelActor(scene, chassis, {
            name: `Roda ${index + 1}${SIDE_SUFFIX[side]}`,
            settings: axle.wheel,
            width: axle.wheelWidth,
            position: vec3.create(side * axle.halfTrack, hubHeight, axle.offset),
        });
    }
}
export function assembleVehicle(scene: Scene, preset: VehiclePreset): Entity {
    const { blueprint } = preset;
    const [width, height, length] = blueprint.chassisSize;
    const [cabinWidth, cabinHeight, cabinLength] = blueprint.cabinSize;
    const chassis = scene.createEntity({
        name: preset.label,
        kind: 'mesh',
        mesh: createBox(width, height, length),
        material: createMaterial({ name: preset.label, baseColor: vec3.create(...blueprint.color), roughness: 0.4, metallic: 0.35 }),
        rigidBody: createRigidBodySettings({ type: 'dynamic', collider: 'box', boxSize: vec3.create(width, height, length), mass: blueprint.chassisMass }),
        vehicle: cloneVehicleSettings(preset.settings),
    }, null);
    const cabin = scene.createEntity({
        name: 'Cabine',
        kind: 'mesh',
        mesh: createBox(cabinWidth, cabinHeight, cabinLength),
        material: createMaterial({ name: 'Cabine', baseColor: vec3.copy(vec3.create(), CABIN_COLOR), roughness: 0.15, metallic: 0.6 }),
    }, chassis);
    vec3.set(cabin.transform.position, 0, (height + cabinHeight) * 0.5, blueprint.cabinOffset);
    blueprint.axles.forEach((axle, index) => addAxle(scene, chassis, blueprint, axle, index));
    return chassis;
}
