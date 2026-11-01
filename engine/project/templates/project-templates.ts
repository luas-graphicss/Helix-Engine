import { Scene } from '@/engine/core/scene/scene';
import * as vec3 from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import { createAmbientLight, createDirectionalLight } from '@/engine/core/scene/light';
import { sunDirectionFromTime, sunRotationFromDirection } from '@/engine/core/environment/celestial';
import { createCharacterActor } from '@/engine/character/character-actor';
import { createDefaultScene, type DefaultSceneOptions } from '@/engine/editor/session/default-scene';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import { Terrain } from '@/engine/terrain/core/terrain';
import { autoPaintTerrain } from '@/engine/terrain/generation/auto-paint';
import { createGenerationParams, generateTerrainHeights } from '@/engine/terrain/generation/terrain-generator';
import type { TerrainMaterialLibrary } from '@/engine/terrain/materials/terrain-material-library';
import { createStarterLayers } from '@/engine/editor/operations/terrain-operations';
import { createWaterSettings } from '@/engine/terrain/water/water-settings';
import { createBaseplate } from '@/engine/world/baseplate/baseplate';
import { createOcclusionProps } from '@/engine/world/occlusion/occlusion-props';
import { createReflectionProps, shapeReflectionRelief, WATER_LEVEL } from '@/engine/world/reflections/reflection-props';
import type { ProjectTemplateId } from '../project-record';
export interface TemplatePreview {
    frame(scene: Scene, camera: PerspectiveCamera): void;
    orbitDegreesPerSecond: number;
    showGrid: boolean;
}
export interface PreviewSceneOptions extends DefaultSceneOptions {
    terrainMaterials: TerrainMaterialLibrary;
}
export interface ProjectTemplate {
    id: ProjectTemplateId;
    name: string;
    description: string;
    highlights: readonly string[];
    createScene(options: DefaultSceneOptions): Scene;
    prepare?(session: EditorSession): void;
    createPreviewScene(options: PreviewSceneOptions): Scene;
    preview: TemplatePreview;
}
function createLightingAndCamera(scene: Scene): void {
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
}
function findGroup(root: Entity, name: string): Entity | null {
    return root.children.find((child) => child.kind === 'group' && child.name === name) ?? null;
}
function findTerrain(scene: Scene): Terrain | null {
    let found: Terrain | null = null;
    scene.traverse((entity) => {
        if (!found && entity.terrain)
            found = entity.terrain;
    });
    return found;
}
const TERRAIN_SIZING = { size: 200, resolution: 257, splatResolution: 512 } as const;
function addTerrain(scene: Scene, materials: TerrainMaterialLibrary): Terrain {
    const params = createGenerationParams({ preset: 'hills' });
    const terrain = new Terrain({ ...TERRAIN_SIZING, layers: createStarterLayers(materials, params.preset) });
    generateTerrainHeights(terrain.heightfield, terrain.size, params);
    terrain.heightsChanged();
    autoPaintTerrain(terrain);
    const world = findGroup(scene.root, 'Mundo') ?? scene.root;
    scene.createEntity({ name: 'Terreno', kind: 'terrain', terrain }, world);
    for (const entity of scene.root.children) {
        if (entity.character)
            entity.transform.position[1] = terrain.heightAtLocal(0, 0);
    }
    return terrain;
}
const baseplate: ProjectTemplate = {
    id: 'baseplate',
    name: 'Baseplate',
    description: 'A plataforma clássica da engine com objetos de referência e o manequim no ponto de início. O lugar certo para começar qualquer jogo.',
    highlights: ['Plataforma com grade', 'Objetos de referência', 'Manequim jogável'],
    createScene: (options) => createDefaultScene(options),
    createPreviewScene: (options) => createDefaultScene(options),
    preview: {
        showGrid: false,
        orbitDegreesPerSecond: 2.5,
        frame(_scene, camera) {
            vec3.set(camera.position, -22, 7, 25);
            vec3.set(camera.target, 1.5, 0.6, -2);
            camera.fovDegrees = 44;
        },
    },
};
const occlusion: ProjectTemplate = {
    id: 'occlusion',
    name: 'Oclusão',
    description: 'Casa fechada ao lado de um abrigo aberto, arcada de lojas, viela, viaduto, lajes de folga crescente e pedregulhos sobre a baseplate: onde o céu entra menos, a sombra fecha mais. Para ver a luz do céu trabalhar.',
    highlights: ['Oclusão do céu', 'Fechado ao lado do aberto', 'Folgas crescentes'],
    createScene(options) {
        const scene = new Scene('Cena_Principal');
        createLightingAndCamera(scene);
        const world = scene.createEntity({ name: 'Mundo', kind: 'group' });
        createBaseplate(scene, world);
        createOcclusionProps(scene, scene.createEntity({ name: 'Estudo', kind: 'group' }, world));
        createCharacterActor(scene, scene.root, { onRigReady: options.onRigReady });
        return scene;
    },
    createPreviewScene(options) {
        return this.createScene(options);
    },
    preview: {
        showGrid: false,
        orbitDegreesPerSecond: 2,
        frame(_scene, camera) {
            vec3.set(camera.position, -30, 12, 28);
            vec3.set(camera.target, -2, 1, -6);
            camera.fovDegrees = 46;
        },
    },
};
const terrain: ProjectTemplate = {
    id: 'terrain',
    name: 'Terreno',
    description: 'Colinas geradas e pintadas automaticamente com grama, terra e rocha, com o manequim no alto do relevo. Para mundos abertos.',
    highlights: ['Relevo de 200 m', 'Camadas pintadas', 'Ferramenta de terreno'],
    createScene(options) {
        const scene = new Scene('Cena_Principal');
        createLightingAndCamera(scene);
        scene.createEntity({ name: 'Mundo', kind: 'group' });
        createCharacterActor(scene, scene.root, { onRigReady: options.onRigReady });
        return scene;
    },
    prepare(session) {
        const added = addTerrain(session.scene, session.terrain.materials);
        session.terrain.setActiveLayer(added.layers[0]?.id ?? null);
    },
    createPreviewScene(options) {
        const scene = this.createScene(options);
        addTerrain(scene, options.terrainMaterials);
        return scene;
    },
    preview: {
        showGrid: false,
        orbitDegreesPerSecond: 1.5,
        frame(scene, camera) {
            const relief = findTerrain(scene);
            const ground = (x: number, z: number) => relief?.heightAtLocal(x, z) ?? 0;
            const centerHeight = ground(0, 0);
            vec3.set(camera.target, 0, centerHeight + 3, 0);
            vec3.set(camera.position, -62, Math.max(ground(-62, 48) + 9, centerHeight + 18), 48);
            camera.fovDegrees = 50;
        },
    },
};
function addReflectionTerrain(scene: Scene, materials: TerrainMaterialLibrary): Terrain {
    const params = createGenerationParams({ preset: 'hills', seed: 4021, amplitude: 9, featureSize: 70, detail: 0.4 });
    const water = createWaterSettings({
        enabled: true,
        level: WATER_LEVEL,
        waveHeight: 0.05,
        waveLength: 9,
        choppiness: 0.2,
        ripples: 0.35,
        clarity: 7,
        roughness: 0.04,
        shallowColor: vec3.create(0.1, 0.42, 0.46),
        deepColor: vec3.create(0.01, 0.07, 0.14),
        foam: { shoreWidth: 0.7, shoreAmount: 0.5, crestAmount: 0.1, bubbles: 0.3 },
    });
    const terrain = new Terrain({ ...TERRAIN_SIZING, layers: createStarterLayers(materials, params.preset), water });
    generateTerrainHeights(terrain.heightfield, terrain.size, params);
    shapeReflectionRelief(terrain.heightfield, terrain.size);
    terrain.heightsChanged();
    autoPaintTerrain(terrain);
    const world = findGroup(scene.root, 'Mundo') ?? scene.root;
    scene.createEntity({ name: 'Terreno', kind: 'terrain', terrain }, world);
    return terrain;
}
const reflections: ProjectTemplate = {
    id: 'reflections',
    name: 'Reflexos',
    description: 'Lago calmo diante de uma praça com galeria de rugosidades em aço e tinta, metais nobres, espelho de aço, pilares coloridos na margem e piso polido. Para validar reflexos em tela, a sonda do mundo e os materiais PBR.',
    highlights: ['Água espelhada', 'Metais e rugosidades', 'Reflexos em tela'],
    createScene(options) {
        const scene = new Scene('Cena_Principal');
        createLightingAndCamera(scene);
        scene.sky.timeOfDay = 16.2;
        scene.sky.sunAzimuth = 150;
        const world = scene.createEntity({ name: 'Mundo', kind: 'group' });
        createReflectionProps(scene, scene.createEntity({ name: 'Estudo', kind: 'group' }, world));
        const player = createCharacterActor(scene, scene.root, { onRigReady: options.onRigReady });
        vec3.set(player.transform.position, -12, 0, -26);
        return scene;
    },
    prepare(session) {
        const added = addReflectionTerrain(session.scene, session.terrain.materials);
        session.terrain.setActiveLayer(added.layers[0]?.id ?? null);
    },
    createPreviewScene(options) {
        const scene = this.createScene(options);
        addReflectionTerrain(scene, options.terrainMaterials);
        return scene;
    },
    preview: {
        showGrid: false,
        orbitDegreesPerSecond: 1.2,
        frame(_scene, camera) {
            vec3.set(camera.position, 24, 2.4, 14);
            vec3.set(camera.target, -6, 1.6, -9);
            camera.fovDegrees = 48;
        },
    },
};
const empty: ProjectTemplate = {
    id: 'empty',
    name: 'Vazio',
    description: 'Só céu, luzes e câmera. Para quem vai importar o próprio mundo ou montar tudo do zero.',
    highlights: ['Céu e sol', 'Luz ambiente', 'Câmera principal'],
    createScene() {
        const scene = new Scene('Cena_Principal');
        createLightingAndCamera(scene);
        scene.createEntity({ name: 'Mundo', kind: 'group' });
        return scene;
    },
    createPreviewScene() {
        return this.createScene({});
    },
    preview: {
        showGrid: true,
        orbitDegreesPerSecond: 1.5,
        frame(_scene, camera) {
            vec3.set(camera.position, 0, 1.6, 0);
            vec3.set(camera.target, 9, 4.5, -16);
            camera.fovDegrees = 62;
        },
    },
};
export const PROJECT_TEMPLATES: readonly ProjectTemplate[] = [baseplate, occlusion, terrain, reflections, empty];
export function getProjectTemplate(id: ProjectTemplateId): ProjectTemplate {
    return PROJECT_TEMPLATES.find((template) => template.id === id) ?? baseplate;
}
