import type { Scene } from '@/engine/core/scene/scene';
import type { Entity } from '@/engine/core/scene/entity';
import { MATERIAL_TEXTURE_SLOTS, type Material } from '@/engine/core/scene/material';
import type { Texture } from '@/engine/core/scene/texture';
import type { Skin } from '@/engine/core/scene/skin';
import type { Rig } from '@/engine/core/scene/rig';
import type { MeshData } from '@/engine/renderer/geometry/mesh-data';
import type { Terrain } from '@/engine/terrain/core/terrain';
import type { TerrainLayer } from '@/engine/terrain/core/terrain-layer';
import { findModelRoot } from '@/engine/character/rig/character-rig';
import { BinaryWriter } from './binary-table';
import { toPlain, type PlainValue } from './plain-data';
import { bakeTexture } from './texture-baking';
import { SCENE_DOCUMENT_FORMAT, SCENE_DOCUMENT_VERSION, type EntityJson, type MaterialJson, type MeshJson, type RigJson, type SceneDocument, type SceneJson, type SceneResourcesDocument, type SkinJson, type TerrainJson, type TerrainLayerJson, type TerrainLayerMaterialRef, type TextureJson, } from './scene-document';
export interface SerializeSceneOptions {
    libraryDocumentForTerrainMaterial: (terrainMaterialId: string) => string | null;
}
export async function serializeScene(scene: Scene, options: SerializeSceneOptions): Promise<SceneDocument> {
    const writer = new SceneWriter(options);
    const root = writer.entity(scene.root);
    const images = await writer.collectImages();
    const json: SceneJson = {
        format: SCENE_DOCUMENT_FORMAT,
        version: SCENE_DOCUMENT_VERSION,
        savedAt: Date.now(),
        name: scene.root.name,
        nextEntityId: scene.nextEntityId,
        environment: {
            sky: toPlain(scene.sky, 'sky'),
            postProcessing: toPlain(scene.postProcessing, 'postProcessing'),
            physics: toPlain(scene.physics, 'physics'),
            player: toPlain(scene.player, 'player'),
            audio: toPlain(scene.audio, 'audio'),
            scripting: toPlain(scene.scripting, 'scripting'),
        },
        meshes: writer.meshes,
        textures: writer.textures,
        materials: writer.materials,
        root,
        stats: { entities: writer.entityCount },
    };
    return { json, binary: writer.binary.finish(), images };
}
export interface SerializedSubtree extends SceneResourcesDocument {
    root: EntityJson;
    entityCount: number;
}
export async function serializeSubtree(entity: Entity, options: SerializeSceneOptions): Promise<SerializedSubtree> {
    const writer = new SceneWriter(options);
    const root = writer.entity(entity);
    const images = await writer.collectImages();
    return { json: { meshes: writer.meshes, textures: writer.textures, materials: writer.materials }, binary: writer.binary.finish(), images, root, entityCount: writer.entityCount };
}
class SceneWriter {
    readonly binary = new BinaryWriter();
    readonly meshes: MeshJson[] = [];
    readonly textures: TextureJson[] = [];
    readonly materials: MaterialJson[] = [];
    entityCount = 0;
    private readonly meshIndex = new Map<MeshData, number>();
    private readonly textureIndex = new Map<Texture, number>();
    private readonly materialIndex = new Map<Material, number>();
    private readonly textureList: Texture[] = [];
    constructor(private readonly options: SerializeSceneOptions) { }
    entity(entity: Entity): EntityJson {
        this.entityCount++;
        const json: EntityJson = {
            id: entity.id,
            name: entity.name,
            kind: entity.kind,
            position: Array.from(entity.transform.position),
            rotation: Array.from(entity.transform.rotation),
            scale: Array.from(entity.transform.scale),
            visible: entity.visible,
            locked: entity.locked,
            castShadows: entity.castShadows,
            receiveShadows: entity.receiveShadows,
            children: [],
        };
        if (entity.tags.size > 0)
            json.tags = Array.from(entity.tags);
        if (Object.keys(entity.meta).length > 0)
            json.meta = JSON.parse(JSON.stringify(entity.meta)) as Record<string, PlainValue>;
        if (entity.mesh)
            json.mesh = this.mesh(entity.mesh);
        if (entity.material)
            json.material = this.material(entity.material);
        if (entity.light)
            json.light = toPlain(entity.light, `${entity.name}.light`);
        if (entity.terrain)
            json.terrain = this.terrain(entity.terrain, entity.name);
        if (entity.rigidBody)
            json.rigidBody = toPlain(entity.rigidBody, `${entity.name}.rigidBody`);
        if (entity.character)
            json.character = toPlain(entity.character, `${entity.name}.character`);
        if (entity.skin)
            json.skin = this.skin(entity.skin);
        if (entity.rig)
            json.rig = this.rig(entity.rig);
        if (entity.csg) {
            const { sourceMesh, ...settings } = entity.csg;
            json.csg = { sourceMesh: this.mesh(sourceMesh), settings: toPlain(settings, `${entity.name}.csg`) };
        }
        if (entity.csgBrush)
            json.csgBrush = toPlain(entity.csgBrush, `${entity.name}.csgBrush`);
        if (entity.audioSource)
            json.audioSource = toPlain(entity.audioSource, `${entity.name}.audioSource`);
        if (entity.audioZone)
            json.audioZone = toPlain(entity.audioZone, `${entity.name}.audioZone`);
        if (entity.guiSurface)
            json.guiSurface = toPlain(entity.guiSurface, `${entity.name}.guiSurface`);
        if (entity.vfx)
            json.vfx = toPlain(entity.vfx, `${entity.name}.vfx`);
        if (entity.script)
            json.script = toPlain(entity.script, `${entity.name}.script`);
        const modelRoot = entity.character ? findModelRoot(entity) : null;
        for (const child of entity.children) {
            if (child !== modelRoot)
                json.children.push(this.entity(child));
        }
        return json;
    }
    async collectImages(): Promise<Blob[]> {
        const blobs = await Promise.all(this.textureList.map((texture) => bakeTexture(texture)));
        const images: Blob[] = [];
        blobs.forEach((blob, index) => {
            if (!blob)
                return;
            this.textures[index].image = images.length;
            images.push(blob);
        });
        return images;
    }
    private mesh(mesh: MeshData): number {
        const existing = this.meshIndex.get(mesh);
        if (existing !== undefined)
            return existing;
        const json: MeshJson = {
            name: mesh.name,
            positions: this.binary.add(mesh.positions),
            normals: this.binary.add(mesh.normals),
            uvs: this.binary.add(mesh.uvs),
            indices: this.binary.add(mesh.indices),
        };
        if (mesh.skinning)
            json.skinning = { joints: this.binary.add(mesh.skinning.joints), weights: this.binary.add(mesh.skinning.weights) };
        const index = this.meshes.push(json) - 1;
        this.meshIndex.set(mesh, index);
        return index;
    }
    private texture(texture: Texture): number {
        const existing = this.textureIndex.get(texture);
        if (existing !== undefined)
            return existing;
        const json: TextureJson = {
            name: texture.name,
            image: null,
            width: texture.width,
            height: texture.height,
            colorSpace: texture.colorSpace,
            wrapS: texture.wrapS,
            wrapT: texture.wrapT,
            magFilter: texture.magFilter,
            minFilter: texture.minFilter,
            sourcePath: texture.sourcePath,
            mimeType: texture.mimeType,
        };
        const index = this.textures.push(json) - 1;
        this.textureIndex.set(texture, index);
        this.textureList.push(texture);
        return index;
    }
    private material(material: Material): number {
        const existing = this.materialIndex.get(material);
        if (existing !== undefined)
            return existing;
        const { baseColorMap, metallicRoughnessMap, normalMap, occlusionMap, emissiveMap, libraryId, ...values } = material;
        const json: MaterialJson = { library: libraryId, values: toPlain(values, `material ${material.name}`), maps: {} };
        const maps = { baseColorMap, metallicRoughnessMap, normalMap, occlusionMap, emissiveMap };
        for (const { slot } of MATERIAL_TEXTURE_SLOTS) {
            const texture = maps[slot];
            if (texture)
                json.maps[slot] = this.texture(texture);
        }
        const index = this.materials.push(json) - 1;
        this.materialIndex.set(material, index);
        return index;
    }
    private terrain(terrain: Terrain, owner: string): TerrainJson {
        return {
            size: terrain.size,
            resolution: terrain.heightfield.resolution,
            heights: this.binary.add(terrain.heightfield.heights),
            splatResolution: terrain.splat.resolution,
            splat: [this.binary.add(terrain.splat.planes[0]), this.binary.add(terrain.splat.planes[1])],
            grassResolution: terrain.grassMap.resolution,
            grassMap: this.binary.add(terrain.grassMap.data),
            layers: terrain.layers.map((layer) => this.terrainLayer(layer)),
            shading: toPlain(terrain.shading, `${owner}.terrain.shading`),
            grass: toPlain(terrain.grass, `${owner}.terrain.grass`),
            water: toPlain(terrain.water, `${owner}.terrain.water`),
        };
    }
    private terrainLayer(layer: TerrainLayer): TerrainLayerJson {
        const { material } = layer;
        const library = material.source === 'custom' ? this.options.libraryDocumentForTerrainMaterial(material.id) : null;
        const ref: TerrainLayerMaterialRef = library ? { library } : { catalog: material.id };
        return {
            material: ref,
            name: layer.name,
            tiling: layer.tiling,
            tint: Array.from(layer.tint),
            normalStrength: layer.normalStrength,
            roughness: layer.roughness,
            auto: toPlain(layer.auto, `camada ${layer.name}`),
        };
    }
    private skin(skin: Skin): SkinJson {
        return {
            joints: skin.joints.map((joint) => joint.id),
            inverseBindMatrices: this.binary.add(skin.inverseBindMatrices),
            restBounds: [...Array.from(skin.restBounds.min), ...Array.from(skin.restBounds.max)],
        };
    }
    private rig(rig: Rig): RigJson {
        return {
            name: rig.name,
            joints: rig.joints.map((joint) => joint.id),
            inverseBindMatrices: this.binary.add(rig.inverseBindMatrices),
            bindPositions: this.binary.add(rig.bindPositions),
            bindRotations: this.binary.add(rig.bindRotations),
            bindScales: this.binary.add(rig.bindScales),
            unitScale: rig.unitScale,
        };
    }
}
