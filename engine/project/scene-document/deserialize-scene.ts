import { Scene } from '@/engine/core/scene/scene';
import type { Entity, EntityOptions } from '@/engine/core/scene/entity';
import { createMaterial, MATERIAL_TEXTURE_SLOTS, type Material } from '@/engine/core/scene/material';
import { createTexture, type Texture } from '@/engine/core/scene/texture';
import { createAmbientLight, createDirectionalLight, createLocalLight, LOCAL_LIGHT_TYPES, type Light, type LocalLightType } from '@/engine/core/scene/light';
import { Skin } from '@/engine/core/scene/skin';
import { Rig } from '@/engine/core/scene/rig';
import * as aabb from '@/engine/core/math/aabb';
import { createSkySettings } from '@/engine/core/environment/sky-settings';
import { createPostProcessSettings } from '@/engine/core/environment/post-process-settings';
import { createPhysicsSettings } from '@/engine/physics/world/physics-settings';
import { createPlayerSettings } from '@/engine/character/player-settings';
import { createMixerSettings } from '@/engine/audio/mixer/mixer-settings';
import { createRigidBodySettings } from '@/engine/physics/body/rigid-body-settings';
import { createCharacterSettings } from '@/engine/character/character-settings';
import { attachCharacterModel } from '@/engine/character/character-actor';
import { createCsgBrushSettings, createCsgSettings } from '@/engine/geometry/csg/csg-settings';
import { createAudioSourceSettings } from '@/engine/audio/world/audio-source-settings';
import { createAudioZoneSettings } from '@/engine/audio/world/audio-zone-settings';
import { createGuiSurfaceSettings } from '@/engine/gui/world/gui-surface-settings';
import { createVfxSettings } from '@/engine/vfx/vfx-settings';
import { createScriptSettings } from '@/engine/scripting/script-settings';
import { createScriptingSettings } from '@/engine/scripting/scripting-settings';
import type { MeshData } from '@/engine/renderer/geometry/mesh-data';
import { Terrain } from '@/engine/terrain/core/terrain';
import { Heightfield } from '@/engine/terrain/core/heightfield';
import { SplatMap } from '@/engine/terrain/core/splat-map';
import { GrassMap } from '@/engine/terrain/foliage/grass-map';
import { createTerrainShading } from '@/engine/terrain/core/terrain-shading';
import { createGrassSettings } from '@/engine/terrain/foliage/grass-settings';
import { createWaterSettings } from '@/engine/terrain/water/water-settings';
import type { MaterialLibrary } from '@/engine/materials/material-library';
import { BinaryReader } from './binary-table';
import { restoreInto, type PlainValue } from './plain-data';
import { decodeTextureImage } from './texture-baking';
import { SCENE_DOCUMENT_VERSION, type EntityJson, type RigJson, type SceneDocument, type SceneJson, type SceneResourcesDocument, type SkinJson, type TerrainLayerJson } from './scene-document';
export interface DeserializeSceneOptions {
    materials: MaterialLibrary;
    onRigReady?: (root: Entity) => void;
}
export interface PendingTerrainLayer {
    terrain: Terrain;
    layer: TerrainLayerJson;
}
export interface DeserializedScene {
    scene: Scene;
    pendingTerrainLayers: PendingTerrainLayer[];
    warnings: string[];
}
export async function deserializeScene(document: SceneDocument, options: DeserializeSceneOptions): Promise<DeserializedScene> {
    const { json } = document;
    if (json.version > SCENE_DOCUMENT_VERSION) {
        throw new Error(`Esta cena foi salva por uma versão mais nova da engine (formato ${json.version}; esta versão lê até ${SCENE_DOCUMENT_VERSION}).`);
    }
    const reader = new SceneReader(document, options);
    await reader.decodeTextures();
    const scene = reader.scene(json);
    reader.populate(scene, json.root);
    reader.dressCharacters(scene);
    return { scene, pendingTerrainLayers: reader.pendingTerrainLayers, warnings: reader.warnings };
}
export interface DeserializedSubtree {
    root: Entity;
    pendingTerrainLayers: PendingTerrainLayer[];
    warnings: string[];
}
export async function deserializeSubtree(document: SceneResourcesDocument, root: EntityJson, scene: Scene, options: DeserializeSceneOptions): Promise<DeserializedSubtree> {
    const reader = new SceneReader(document, options);
    await reader.decodeTextures();
    const entity = reader.subtree(scene, root);
    reader.dressCharacters(scene);
    return { root: entity, pendingTerrainLayers: reader.pendingTerrainLayers, warnings: reader.warnings };
}
