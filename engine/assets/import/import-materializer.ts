import * as vec3 from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import type { Scene } from '@/engine/core/scene/scene';
import { createMaterial, type Material } from '@/engine/core/scene/material';
import { createTexture, setTextureImage, type Texture, type TextureColorSpace, type TextureImage } from '@/engine/core/scene/texture';
import type { MeshData } from '@/engine/renderer/geometry/mesh-data';
import { decodeImage } from '@/engine/assets/image-decoder';
import { heightMapToNormalMap, isLikelyHeightMap, packMetallicRoughness } from '@/engine/assets/texture-packing';
import { DEFAULT_SMOOTHING_ANGLE_DEGREES, flipUvV, flipWinding, recomputeNormals } from './geometry-utils';
import type { ImportedNode, ImportedScene, ImportUpAxis } from './import-types';
export type ImportNormalsMode = 'keep' | 'smooth' | 'flat';
export type ImportUpAxisOption = 'auto' | ImportUpAxis;
export interface MaterializeOptions {
    scale: number;
    convertUnits: boolean;
    upAxis: ImportUpAxisOption;
    normals: ImportNormalsMode;
    smoothingAngle: number;
    flipUvV: boolean;
    flipWinding: boolean;
    excludedMeshes: ReadonlySet<number>;
    rootName: string | null;
}
export const DEFAULT_MATERIALIZE_OPTIONS: MaterializeOptions = {
    scale: 1,
    convertUnits: true,
    upAxis: 'auto',
    normals: 'keep',
    smoothingAngle: DEFAULT_SMOOTHING_ANGLE_DEGREES,
    flipUvV: false,
    flipWinding: false,
    excludedMeshes: new Set<number>(),
    rootName: null,
};
export interface MaterializedMesh {
    name: string;
    geometry: MeshData;
    material: Material;
}
export interface MaterializedImport {
    root: Entity;
    materials: Material[];
    textures: Texture[];
    meshes: MaterializedMesh[];
    missingTextures: number;
    notes: string[];
}
export function resolveUpAxis(imported: ImportedScene, options: Pick<MaterializeOptions, 'upAxis'>): ImportUpAxis {
    return options.upAxis === 'auto' ? imported.upAxis : options.upAxis;
}
export function effectiveImportScale(imported: ImportedScene, options: Pick<MaterializeOptions, 'scale' | 'convertUnits'>): number {
    const units = options.convertUnits && imported.metersPerUnit ? imported.metersPerUnit : 1;
    return options.scale * units;
}
function describeError(cause: unknown): string {
    return cause instanceof Error ? cause.message : String(cause);
}
class Materializer {
    private readonly textureByKey = new Map<string, Texture>();
    private readonly decodedByBlob = new Map<Blob, Promise<TextureImage | null>>();
    private readonly materials: Material[] = [];
    private readonly textures: Texture[] = [];
    private readonly meshes: MaterializedMesh[] = [];
    private readonly geometries: MeshData[] = [];
    private readonly notes: string[] = [];
    private defaultMaterial: Material | null = null;
    private missingTextures = 0;
    constructor(private readonly scene: Scene, private readonly imported: ImportedScene, private readonly options: MaterializeOptions) { }
    private decode(index: number): Promise<TextureImage | null> {
        const definition = this.imported.textures[index];
        if (!definition?.data)
            return Promise.resolve(null);
        const blob = definition.data;
        let pending = this.decodedByBlob.get(blob);
        if (pending)
            return pending;
        pending = (async () => {
            try {
                return await decodeImage(blob, definition.mimeType);
            }
            catch (cause) {
                this.notes.push(`Não foi possível decodificar "${definition.sourcePath || definition.name}": ${describeError(cause)}`);
                return null;
            }
        })();
        this.decodedByBlob.set(blob, pending);
        return pending;
    }
    private async texture(index: number | null, colorSpace: TextureColorSpace): Promise<Texture | null> {
        if (index === null)
            return null;
        const definition = this.imported.textures[index];
        if (!definition)
            return null;
        const key = `${index}:${colorSpace}`;
        const cached = this.textureByKey.get(key);
        if (cached)
            return cached;
        const texture = createTexture({
            name: definition.name,
            sourcePath: definition.sourcePath,
            mimeType: definition.mimeType,
            colorSpace,
            wrapS: definition.wrapS,
            wrapT: definition.wrapT,
            magFilter: definition.magFilter,
            minFilter: definition.minFilter,
        });
        const image = await this.decode(index);
        if (image)
            setTextureImage(texture, image);
        else
            this.missingTextures++;
        this.textures.push(texture);
        this.textureByKey.set(key, texture);
        return texture;
    }
    private registerDerivedTexture(name: string, sourcePath: string, image: TextureImage): Texture {
        const texture = createTexture({ name, sourcePath, colorSpace: 'linear', image });
        this.textures.push(texture);
        return texture;
    }
    private async buildMaterials(): Promise<void> {
        for (const definition of this.imported.materials) {
            const material = createMaterial({
                name: definition.name,
                baseColor: vec3.copy(vec3.create(), definition.baseColor),
                opacity: definition.opacity,
                roughness: definition.roughness,
                metallic: definition.metallic,
                emissive: vec3.copy(vec3.create(), definition.emissive),
                emissiveIntensity: definition.emissiveIntensity,
                alphaMode: definition.alphaMode,
                alphaCutoff: definition.alphaCutoff,
                doubleSided: definition.doubleSided,
                normalScale: definition.normalScale,
                occlusionStrength: definition.occlusionStrength,
            });
            material.baseColorMap = await this.texture(definition.baseColorMap, 'srgb');
            material.emissiveMap = await this.texture(definition.emissiveMap, 'srgb');
            material.occlusionMap = await this.texture(definition.occlusionMap, 'linear');
            let normal = await this.texture(definition.normalMap, 'linear');
            if (normal?.image && definition.normalMapMayBeHeight && isLikelyHeightMap(normal.image)) {
                normal = this.registerDerivedTexture(`${normal.name}_normal`, normal.sourcePath, heightMapToNormalMap(normal.image, definition.normalScale));
                material.normalScale = 1;
                this.notes.push(`${definition.name}: mapa de relevo convertido em mapa de normais.`);
            }
            material.normalMap = normal;
            if (definition.metallicRoughnessMap !== null) {
                material.metallicRoughnessMap = await this.texture(definition.metallicRoughnessMap, 'linear');
            }
            else if (definition.roughnessMap !== null || definition.metallicMap !== null) {
                const roughness = definition.roughnessMap !== null ? await this.decode(definition.roughnessMap) : null;
                const metallic = definition.metallicMap !== null ? await this.decode(definition.metallicMap) : null;
                if (roughness || metallic) {
                    const sourcePath = this.imported.textures[definition.roughnessMap ?? definition.metallicMap ?? 0]?.sourcePath ?? '';
                    material.metallicRoughnessMap = this.registerDerivedTexture(`${definition.name}_MetallicRoughness`, sourcePath, packMetallicRoughness(roughness, metallic));
                }
                else {
                    this.missingTextures++;
                }
            }
            this.materials.push(material);
        }
    }
    private materialFor(meshIndex: number): Material {
        const materialIndex = this.imported.meshes[meshIndex]?.material ?? null;
        const material = materialIndex !== null ? this.materials[materialIndex] : undefined;
        if (material)
            return material;
        if (!this.defaultMaterial) {
            this.defaultMaterial = createMaterial({ name: `${this.imported.name}_Padrão` });
            this.materials.push(this.defaultMaterial);
        }
        return this.defaultMaterial;
    }
    private buildMeshes(): void {
        const { normals, smoothingAngle, excludedMeshes } = this.options;
        this.imported.meshes.forEach((definition, index) => {
            let geometry = definition.geometry;
            if (this.options.flipUvV)
                geometry = flipUvV(geometry);
            if (this.options.flipWinding)
                geometry = flipWinding(geometry);
            if (normals === 'flat')
                geometry = recomputeNormals(geometry, 'flat');
            else if (normals === 'smooth')
                geometry = recomputeNormals(geometry, 'smooth', smoothingAngle);
            this.geometries.push(geometry);
            if (!excludedMeshes.has(index))
                this.meshes.push({ name: definition.name, geometry, material: this.materialFor(index) });
        });
    }
    private buildNode(node: ImportedNode, parent: Entity | null): Entity {
        const { scene } = this;
        const meshes = node.meshes.filter((index) => !this.options.excludedMeshes.has(index));
        const single = meshes.length === 1 && node.children.length === 0;
        const entity = single
            ? scene.createEntity({ name: node.name, kind: 'mesh', mesh: this.geometries[meshes[0]], material: this.materialFor(meshes[0]) }, parent)
            : scene.createEntity({ name: node.name, kind: 'group' }, parent);
        vec3.copy(entity.transform.position, node.position);
        vec3.copy(entity.transform.rotation, node.rotation);
        vec3.copy(entity.transform.scale, node.scale);
        if (!single) {
            for (const meshIndex of meshes) {
                scene.createEntity({ name: this.imported.meshes[meshIndex].name, kind: 'mesh', mesh: this.geometries[meshIndex], material: this.materialFor(meshIndex) }, entity);
            }
            for (const child of node.children)
                this.buildNode(child, entity);
        }
        return entity;
    }
    async materialize(): Promise<MaterializedImport> {
        await this.buildMaterials();
        this.buildMeshes();
        const { imported, options, scene } = this;
        const convertUpAxis = resolveUpAxis(imported, options) === 'z';
        const scale = effectiveImportScale(imported, options);
        const rootName = options.rootName?.trim() || imported.name;
        const needsWrapper = imported.roots.length !== 1 || scale !== 1 || convertUpAxis;
        let root: Entity;
        if (needsWrapper) {
            root = scene.createEntity({ name: rootName, kind: 'group' }, null);
            for (const node of imported.roots)
                this.buildNode(node, root);
            if (convertUpAxis)
                vec3.set(root.transform.rotation, -90, 0, 0);
            vec3.set(root.transform.scale, scale, scale, scale);
        }
        else {
            root = this.buildNode(imported.roots[0], null);
            if (options.rootName?.trim())
                root.name = rootName;
        }
        return { root, materials: this.materials, textures: this.textures, meshes: this.meshes, missingTextures: this.missingTextures, notes: this.notes };
    }
}
export function materializeImportedScene(scene: Scene, imported: ImportedScene, options: MaterializeOptions = DEFAULT_MATERIALIZE_OPTIONS): Promise<MaterializedImport> {
    return new Materializer(scene, imported, options).materialize();
}
