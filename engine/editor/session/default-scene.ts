import { Scene } from '@/engine/core/scene/scene';
import * as vec3 from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import { createAmbientLight, createDirectionalLight } from '@/engine/core/scene/light';
import { sunDirectionFromTime, sunRotationFromDirection } from '@/engine/core/environment/celestial';
import { createBaseplate } from '@/engine/world/baseplate/baseplate';
import { createDemoProps } from '@/engine/world/baseplate/demo-props';
import { createCharacterActor } from '@/engine/character/character-actor';
export interface DefaultSceneOptions {
    onRigReady?: (root: Entity) => void;
}
export function createDefaultScene(options: DefaultSceneOptions = {}): Scene {
    const scene = new Scene('Cena_Principal');
    const { sky } = scene;
    const lighting = scene.createEntity({ name: 'Iluminação', kind: 'group' });
    const sun = scene.createEntity({ name: 'LuzDirecional', kind: 'light', light: createDirectionalLight() }, lighting);
    vec3.set(sun.transform.position, 4, 8, 3);
    const sunDirection = sunDirectionFromTime(vec3.create(), sky.timeOfDay, sky.latitude, sky.sunAzimuth);
    sunRotationFromDirection(sun.transform.rotation, sunDirection);
    scene.createEntity({ name: 'LuzAmbiente', kind: 'light', light: createAmbientLight() }, lighting);
    const camera = scene.createEntity({ name: 'CameraPrincipal', kind: 'camera' });
    vec3.set(camera.transform.position, -6, 4, 6);
    vec3.set(camera.transform.rotation, -25, -45, 0);
    const world = scene.createEntity({ name: 'Mundo', kind: 'group' });
    createBaseplate(scene, world);
    createDemoProps(scene, scene.createEntity({ name: 'Referências', kind: 'group' }, world));
    createCharacterActor(scene, scene.root, { onRigReady: options.onRigReady });
    return scene;
}
