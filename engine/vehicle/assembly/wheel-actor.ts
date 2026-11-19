import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import { createMaterial } from '@/engine/core/scene/material';
import type { Scene } from '@/engine/core/scene/scene';
import { createBox, createCylinder } from '@/engine/renderer/geometry/primitives';
import { cloneWheelSettings, type WheelSettings } from '../wheel/wheel-settings';
export interface WheelActorOptions {
    readonly name: string;
    readonly settings: Readonly<WheelSettings>;
    readonly width: number;
    readonly position: Vec3;
}
const TIRE_SEGMENTS = 24;
const AXLE_ALONG_X_DEGREES = 90;
const SPOKE_LENGTH_RATIO = 1.5;
const SPOKE_THICKNESS_RATIO = 0.22;
const SPOKE_OVERHANG = 1.06;
const TIRE_COLOR = vec3.create(0.04, 0.04, 0.05);
const SPOKE_COLOR = vec3.create(0.7, 0.7, 0.72);
export function createWheelActor(scene: Scene, parent: Entity | null, options: WheelActorOptions): Entity {
    const { settings, width } = options;
    const { radius } = settings;
    const wheel = scene.createEntity({
        name: options.name,
        kind: 'mesh',
        mesh: createCylinder(radius, width, TIRE_SEGMENTS),
        material: createMaterial({ name: 'Pneu', baseColor: vec3.copy(vec3.create(), TIRE_COLOR), roughness: 0.9 }),
        wheel: cloneWheelSettings(settings),
    }, parent);
    vec3.copy(wheel.transform.position, options.position);
    vec3.set(wheel.transform.rotation, 0, 0, AXLE_ALONG_X_DEGREES);
    scene.createEntity({
        name: 'Calota',
        kind: 'mesh',
        mesh: createBox(radius * SPOKE_LENGTH_RATIO, width * SPOKE_OVERHANG, radius * SPOKE_THICKNESS_RATIO),
        material: createMaterial({ name: 'Calota', baseColor: vec3.copy(vec3.create(), SPOKE_COLOR), roughness: 0.35, metallic: 0.8 }),
    }, wheel);
    return wheel;
}
