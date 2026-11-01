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
class SceneReader {
    readonly pendingTerrainLayers: PendingTerrainLayer[] = [];
    readonly warnings: string[] = [];
    private readonly binary: BinaryReader;
    private readonly meshes: MeshData[];
    private readonly textures: Texture[] = [];
    private readonly materials: Array<Material | null>;
    private readonly entitiesById = new Map<number, Entity>();
    private readonly skins: Array<{
        entity: Entity;
        json: SkinJson;
    }> = [];
    private readonly rigs: Array<{
        entity: Entity;
        json: RigJson;
    }> = [];
    private readonly characters: Entity[] = [];
    private freshIds = false;
    constructor(private readonly document: SceneResourcesDocument, private readonly options: DeserializeSceneOptions) {
        this.binary = new BinaryReader(document.binary);
        this.meshes = document.json.meshes.map((mesh) => {
            const data: MeshData = {
                name: mesh.name,
                positions: this.binary.read<Float32Array>(mesh.positions),
                normals: this.binary.read<Float32Array>(mesh.normals),
                uvs: this.binary.read<Float32Array>(mesh.uvs),
                indices: this.binary.read<Uint16Array | Uint32Array>(mesh.indices),
            };
            return mesh.skinning
                ? { ...data, skinning: { joints: this.binary.read<Uint16Array>(mesh.skinning.joints), weights: this.binary.read<Float32Array>(mesh.skinning.weights) } }
                : data;
        });
        this.materials = new Array<Material | null>(document.json.materials.length).fill(null);
    }
    async decodeTextures(): Promise<void> {
        const { json, images } = this.document;
        const decoded = await Promise.all(json.textures.map(async (texture) => {
            if (texture.image === null)
                return null;
            const blob = images[texture.image];
            if (!blob) {
                this.warnings.push(`A imagem da textura "${texture.name}" não estava no documento.`);
                return null;
            }
            try {
                return await decodeTextureImage(blob);
            }
            catch {
                this.warnings.push(`A imagem da textura "${texture.name}" não pôde ser decodificada.`);
                return null;
            }
        }));
        json.textures.forEach((texture, index) => {
            const image = decoded[index];
            this.textures.push(createTexture({
                name: texture.name,
                image,
                width: image?.width ?? texture.width,
                height: image?.height ?? texture.height,
                colorSpace: texture.colorSpace,
                wrapS: texture.wrapS,
                wrapT: texture.wrapT,
                magFilter: texture.magFilter,
                minFilter: texture.minFilter,
                sourcePath: texture.sourcePath,
                mimeType: texture.mimeType,
            }));
        });
    }
    scene(json: SceneJson): Scene {
        const { environment, name, nextEntityId } = json;
        const scene = new Scene(name, restoreInto(createSkySettings(), environment.sky), restoreInto(createPhysicsSettings(), environment.physics), restoreInto(createPlayerSettings(), environment.player), restoreInto(createPostProcessSettings(), environment.postProcessing), restoreInto(createMixerSettings(), environment.audio), restoreInto(createScriptingSettings(), environment.scripting));
        scene.reserveEntityIds(nextEntityId);
        return scene;
    }
    populate(scene: Scene, root: EntityJson): void {
        this.applyCommon(scene.root, root);
        this.entitiesById.set(root.id, scene.root);
        for (const child of root.children)
            this.entity(scene, child, scene.root);
        this.bindSkeletons();
    }
    subtree(scene: Scene, json: EntityJson): Entity {
        this.freshIds = true;
        const root = this.entity(scene, json, null);
        this.bindSkeletons();
        return root;
    }
    dressCharacters(scene: Scene): void {
        for (const root of this.characters) {
            void attachCharacterModel(scene, root).then((dressed) => {
                if (dressed)
                    this.options.onRigReady?.(root);
            });
        }
    }
    private entity(scene: Scene, json: EntityJson, parent: Entity | null): Entity {
        const options: Omit<EntityOptions, 'id'> = {
            name: json.name,
            kind: json.kind,
            castShadows: json.castShadows,
            receiveShadows: json.receiveShadows,
            locked: json.locked,
        };
        if (json.mesh !== undefined)
            options.mesh = this.meshes[json.mesh];
        if (json.material !== undefined)
            options.material = this.material(json.material) ?? undefined;
        if (json.light)
            options.light = this.light(json.light);
        if (json.terrain)
            options.terrain = this.terrain(json.terrain, json.name);
        if (json.rigidBody)
            options.rigidBody = restoreInto(createRigidBodySettings(), json.rigidBody);
        if (json.character)
            options.character = restoreInto(createCharacterSettings(), json.character);
        if (json.csg)
            options.csg = restoreInto(createCsgSettings(this.meshes[json.csg.sourceMesh]), json.csg.settings);
        if (json.csgBrush)
            options.csgBrush = restoreInto(createCsgBrushSettings(), json.csgBrush);
        if (json.audioSource)
            options.audioSource = restoreInto(createAudioSourceSettings(), json.audioSource);
        if (json.audioZone)
            options.audioZone = restoreInto(createAudioZoneSettings(), json.audioZone);
        if (json.guiSurface)
            options.guiSurface = restoreInto(createGuiSurfaceSettings(), json.guiSurface);
        if (json.vfx)
            options.vfx = restoreInto(createVfxSettings(), json.vfx);
        if (json.script)
            options.script = restoreInto(createScriptSettings(), json.script);
        const entity = this.freshIds ? scene.createEntity(options, parent) : scene.restoreEntity({ ...options, id: json.id }, parent);
        this.applyCommon(entity, json);
        if (this.entitiesById.has(json.id))
            this.warnings.push(`Id de ator repetido no documento: ${json.id} (${entity.name}).`);
        this.entitiesById.set(json.id, entity);
        if (json.skin)
            this.skins.push({ entity, json: json.skin });
        if (json.rig)
            this.rigs.push({ entity, json: json.rig });
        if (entity.character)
            this.characters.push(entity);
        for (const child of json.children)
            this.entity(scene, child, entity);
        return entity;
    }
    private applyCommon(entity: Entity, json: EntityJson): void {
        entity.transform.position.set(json.position);
        entity.transform.rotation.set(json.rotation);
        entity.transform.scale.set(json.scale);
        entity.visible = json.visible;
        if (Array.isArray(json.tags))
            for (const tag of json.tags)
                if (typeof tag === 'string')
                    entity.tags.add(tag);
        if (json.meta && typeof json.meta === 'object' && !Array.isArray(json.meta))
            entity.meta = JSON.parse(JSON.stringify(json.meta)) as Entity['meta'];
    }
    private material(index: number): Material | null {
        const cached = this.materials[index];
        if (cached)
            return cached;
        const json = this.document.json.materials[index];
        if (!json)
            return null;
        const document = json.library ? this.options.materials.get(json.library) : null;
        if (document) {
            this.materials[index] = document.material;
            return document.material;
        }
        const material = restoreInto(createMaterial(), json.values);
        for (const { slot } of MATERIAL_TEXTURE_SLOTS) {
            const texture = json.maps[slot];
            material[slot] = texture !== undefined ? (this.textures[texture] ?? null) : null;
        }
        material.libraryId = json.library;
        if (json.library)
            this.warnings.push(`O material "${material.name}" apontava para um item da biblioteca que não existe mais; os valores salvos foram usados.`);
        this.materials[index] = material;
        return material;
    }
    private light(json: PlainValue): Light {
        const type = typeof json === 'object' && json !== null && !Array.isArray(json) && 'type' in json ? json.type : null;
        if (type === 'directional')
            return restoreInto(createDirectionalLight(), json);
        if (type === 'ambient')
            return restoreInto(createAmbientLight(), json);
        const local = LOCAL_LIGHT_TYPES.includes(type as LocalLightType) ? (type as LocalLightType) : 'point';
        return restoreInto(createLocalLight(local), json);
    }
    private terrain(json: EntityJson['terrain'] & object, owner: string): Terrain {
        const terrain = new Terrain({
            size: json.size,
            heightfield: new Heightfield(json.resolution, this.binary.read<Float32Array>(json.heights)),
            splat: new SplatMap(json.splatResolution, [this.binary.read<Uint8Array>(json.splat[0]), this.binary.read<Uint8Array>(json.splat[1])]),
            grassMap: new GrassMap(json.grassResolution, this.binary.read<Uint8Array>(json.grassMap)),
            layers: [],
            shading: restoreInto(createTerrainShading(), json.shading),
            grass: restoreInto(createGrassSettings(), json.grass),
            water: restoreInto(createWaterSettings(), json.water),
        });
        if (json.layers.length === 0)
            this.warnings.push(`O terreno de "${owner}" não tem camadas.`);
        for (const layer of json.layers)
            this.pendingTerrainLayers.push({ terrain, layer });
        return terrain;
    }
    private bindSkeletons(): void {
        for (const { entity, json } of this.rigs) {
            const joints = this.joints(json.joints, entity.name);
            if (!joints)
                continue;
            entity.rig = new Rig({
                name: json.name,
                joints,
                inverseBindMatrices: this.binary.read<Float32Array>(json.inverseBindMatrices),
                bind: {
                    positions: this.binary.read<Float32Array>(json.bindPositions),
                    rotations: this.binary.read<Float32Array>(json.bindRotations),
                    scales: this.binary.read<Float32Array>(json.bindScales),
                },
                unitScale: json.unitScale,
            });
        }
        for (const { entity, json } of this.skins) {
            const joints = this.joints(json.joints, entity.name);
            if (!joints)
                continue;
            const restBounds = aabb.create();
            restBounds.min.set(json.restBounds.slice(0, 3));
            restBounds.max.set(json.restBounds.slice(3, 6));
            entity.skin = new Skin(joints, this.binary.read<Float32Array>(json.inverseBindMatrices), restBounds);
        }
    }
    private joints(ids: number[], owner: string): Entity[] | null {
        const joints: Entity[] = [];
        for (const id of ids) {
            const joint = this.entitiesById.get(id);
            if (!joint) {
                this.warnings.push(`O esqueleto de "${owner}" aponta para uma junta que não está na cena (id ${id}); o esqueleto foi descartado.`);
                return null;
            }
            joints.push(joint);
        }
        return joints;
    }
}
