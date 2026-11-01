import * as vec3 from '@/engine/core/math/vec3';
import type { Scene } from '@/engine/core/scene/scene';
import type { Entity } from '@/engine/core/scene/entity';
import { createRoundedBox, createSphere } from '@/engine/renderer/geometry/primitives';
import { createRigidBodySettings } from '@/engine/physics/body/rigid-body-settings';
import { stone } from '../props/prop-materials';
import { staticBlock } from '../props/static-block';
interface Boulder {
    radius: number;
    x: number;
    z: number;
}
const BOULDERS: readonly Boulder[] = [
    { radius: 1.3, x: -0.5, z: 0 },
    { radius: 0.9, x: 1.4, z: -0.8 },
    { radius: 0.7, x: 0.6, z: 1.7 },
    { radius: 0.5, x: -1.9, z: 1.4 },
    { radius: 0.4, x: 2.3, z: 0.9 },
];
export function createBoulders(scene: Scene, parent: Entity): void {
    const group = scene.createEntity({ name: 'Pedregulhos', kind: 'group' }, parent);
    vec3.set(group.transform.position, 15, 0, 8);
    BOULDERS.forEach(({ radius, x, z }, index) => {
        const name = `Pedra_${index + 1}`;
        const entity = scene.createEntity({ name, kind: 'mesh', mesh: createSphere(radius), material: stone(`${name} · Pedra`) }, group);
        vec3.set(entity.transform.position, x, radius, z);
        entity.rigidBody = createRigidBodySettings({ type: 'static', collider: 'sphere', radius, friction: 0.9 });
    });
    const slab = [2.4, 0.6, 1.6] as const;
    const tilt = 12;
    const yaw = 25;
    const tiltRadians = (tilt * Math.PI) / 180;
    const yawRadians = (yaw * Math.PI) / 180;
    const lift = (slab[0] / 2) * Math.sin(tiltRadians) + (slab[1] / 2) * Math.cos(tiltRadians);
    const center = [-1.5, -2.2] as const;
    const entity = scene.createEntity({ name: 'Lousa', kind: 'mesh', mesh: createRoundedBox(slab[0], slab[1], slab[2], 0.15), material: stone('Lousa · Pedra') }, group);
    vec3.set(entity.transform.position, center[0], lift, center[1]);
    vec3.set(entity.transform.rotation, 0, yaw, tilt);
    entity.rigidBody = createRigidBodySettings({ type: 'static', collider: 'box', boxSize: vec3.create(slab[0], slab[1], slab[2]), friction: 0.9 });
    const reach = 0.9;
    const chockHeight = lift - (slab[1] / 2) * Math.cos(tiltRadians) + reach * Math.sin(tiltRadians);
    const chockX = center[0] + reach * Math.cos(yawRadians);
    const chockZ = center[1] - reach * Math.sin(yawRadians);
    staticBlock(scene, group, 'Calco', [0.5, chockHeight, 0.5], [chockX, chockHeight / 2, chockZ], { material: stone('Calço · Pedra') });
}
