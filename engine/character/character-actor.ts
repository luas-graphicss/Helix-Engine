import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { Scene } from '@/engine/core/scene/scene';
import type { Entity } from '@/engine/core/scene/entity';
import { loadMannequinAsset } from './assets/mannequin-asset';
import { MANNEQUIN_MODEL_ID, type CharacterModelAsset } from './assets/character-model-asset';
import { getCharacterModel } from './assets/character-model-registry';
import { findModelRoot, fitModelToHeight, hasModel, instantiateCharacterModel, removeCharacterModel, type CharacterRig } from './rig/character-rig';
import { createCharacterSettings, type CharacterSettings } from './character-settings';
import { TerrainCollider } from './controller/terrain-collider';
export const DEFAULT_CHARACTER_NAME = 'Manequim';
const spawnNormal = vec3.create();
const dressGeneration = new WeakMap<Entity, number>();
export interface CharacterActorOptions {
    name?: string;
    settings?: CharacterSettings;
    onRigReady?: (root: Entity) => void;
}
export function defaultActorName(modelId: string): string {
    if (modelId === MANNEQUIN_MODEL_ID)
        return DEFAULT_CHARACTER_NAME;
    return getCharacterModel(modelId)?.label ?? DEFAULT_CHARACTER_NAME;
}
export function createCharacterActor(scene: Scene, parent: Entity | null = scene.root, options: CharacterActorOptions = {}): Entity {
    const settings = options.settings ?? createCharacterSettings();
    const root = scene.createEntity({ name: options.name ?? defaultActorName(settings.model), kind: 'character', character: settings }, parent);
    void attachCharacterModel(scene, root).then((dressed) => {
        if (dressed)
            options.onRigReady?.(root);
    });
    return root;
}
export async function loadCharacterModel(id: string): Promise<CharacterModelAsset | null> {
    const registered = getCharacterModel(id);
    if (registered)
        return registered;
    return id === MANNEQUIN_MODEL_ID ? loadMannequinAsset() : null;
}
export async function attachCharacterModel(scene: Scene, root: Entity): Promise<boolean> {
    const settings = root.character;
    if (!settings)
        return false;
    const generation = (dressGeneration.get(root) ?? 0) + 1;
    dressGeneration.set(root, generation);
    try {
        let asset = await loadCharacterModel(settings.model);
        if (!asset) {
            console.warn(`[Helix] Modelo de personagem "${settings.model}" não está carregado nesta sessão; usando o manequim.`);
            asset = await loadMannequinAsset();
        }
        if (dressGeneration.get(root) !== generation || hasModel(root))
            return false;
        await instantiateCharacterModel(scene, root, asset, settings.height);
        return true;
    }
    catch (cause) {
        console.warn('[Helix] Modelo do personagem indisponível; o personagem fica sem malha.', cause);
        return false;
    }
}
export async function redressCharacterActor(scene: Scene, root: Entity): Promise<boolean> {
    removeCharacterModel(root);
    return attachCharacterModel(scene, root);
}
export function refitCharacterModel(scene: Scene, root: Entity): void {
    const settings = root.character;
    const modelRoot = findModelRoot(root);
    if (settings && modelRoot)
        fitModelToHeight(scene, modelRoot, settings.height);
}
export function findPossessableCharacter(scene: Scene): Entity | null {
    let found: Entity | null = null;
    scene.traverse((entity) => {
        if (!found && entity.character?.autoPossess)
            found = entity;
    });
    return found;
}
export function findCharacterActors(scene: Scene): Entity[] {
    const actors: Entity[] = [];
    scene.traverse((entity) => {
        if (entity.character)
            actors.push(entity);
    });
    return actors;
}
export function defaultSpawnPosition(scene: Scene, out: Vec3): Vec3 {
    const height = new TerrainCollider(scene).sample(0, 0, spawnNormal);
    return vec3.set(out, 0, height ?? 0, 0);
}
export type { CharacterRig };
