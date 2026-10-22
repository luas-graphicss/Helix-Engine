import * as mat4 from '@/engine/core/math/mat4';
import type { FileBundle } from '../file-bundle';
import { baseNameWithoutExtension, createImportedNode, type ImportedMesh, type ImportedNode, type ImportedScene, type ImportUpAxis } from '../import-types';
import { isAsciiFbx, parseAsciiFbx } from './fbx-ascii-parser';
import { isBinaryFbx, parseBinaryFbx } from './fbx-binary-parser';
import { FbxDocument, type FbxObject } from './fbx-document';
import { convertFbxGeometry, type FbxSubMesh } from './fbx-geometry';
import { buildFbxMaterials, type FbxMaterialTable } from './fbx-materials';
import { findChild, type FbxNode } from './fbx-node';
import { readFbxGeometricTransform, readFbxLocalTransform } from './fbx-transform';
const BONE_SUBCLASSES = new Set(['LimbNode', 'Limb', 'Root']);
const MINIMUM_VERSION = 6000;
interface SkippedObjects {
    lights: number;
    cameras: number;
    bones: number;
    unsupportedGeometries: number;
}
class FbxSceneBuilder {
    readonly meshes: ImportedMesh[] = [];
    readonly skipped: SkippedObjects = { lights: 0, cameras: 0, bones: 0, unsupportedGeometries: 0 };
    private readonly meshIndexByKey = new Map<string, number>();
    private readonly subMeshCache = new Map<string, FbxSubMesh[]>();
    private readonly visiting = new Set<string>();
    private readonly localMatrix = mat4.create();
    private readonly geometricMatrix = mat4.create();
    private approximatedRotationOrders = 0;
    constructor(private readonly doc: FbxDocument, private readonly materials: FbxMaterialTable, private readonly warnings: string[]) { }
    build(): ImportedNode[] {
        const roots = this.doc
            .rootModels()
            .map((model) => this.convertModel(model))
            .filter((node): node is ImportedNode => node !== null);
        if (this.approximatedRotationOrders > 0) {
            this.warnings.push(`${this.approximatedRotationOrders} nó(s) usam ordem de rotação esférica, aproximada por XYZ.`);
        }
        return roots;
    }
    private subMeshes(geometry: FbxObject, name: string): FbxSubMesh[] {
        let cached = this.subMeshCache.get(geometry.id);
        if (!cached) {
            cached = convertFbxGeometry(geometry, name, this.warnings);
            this.subMeshCache.set(geometry.id, cached);
        }
        return cached;
    }
    private meshIndex(geometry: FbxObject, subMesh: FbxSubMesh, materialIndex: number | null): number {
        const key = `${geometry.id}:${subMesh.materialSlot}:${materialIndex ?? 'padrão'}`;
        const cached = this.meshIndexByKey.get(key);
        if (cached !== undefined)
            return cached;
        const index = this.meshes.length;
        this.meshes.push({ name: subMesh.geometry.name, geometry: subMesh.geometry, material: materialIndex, hadNormals: subMesh.hadNormals, hadUvs: subMesh.hadUvs });
        this.meshIndexByKey.set(key, index);
        return index;
    }
    private geometriesOf(model: FbxObject): FbxObject[] {
        const linked = this.doc.children(model.id, 'Geometry');
        if (linked.length === 0 && findChild(model.node, 'Vertices'))
            return [model];
        return linked;
    }
    private collectMeshes(model: FbxObject, name: string): number[] {
        const materialIds = this.doc.children(model.id, 'Material').map((material) => material.id);
        const indices: number[] = [];
        for (const geometry of this.geometriesOf(model)) {
            if (geometry !== model && geometry.subClass !== 'Mesh' && geometry.subClass !== '') {
                this.skipped.unsupportedGeometries++;
                continue;
            }
            const geometryName = geometry === model ? name : geometry.name || name;
            for (const subMesh of this.subMeshes(geometry, geometryName)) {
                const materialId = materialIds[subMesh.materialSlot] ?? materialIds[0] ?? null;
                const materialIndex = materialId !== null ? this.materials.indexOf(materialId) : null;
                indices.push(this.meshIndex(geometry, subMesh, materialIndex));
            }
        }
        return indices;
    }
    private convertModel(model: FbxObject): ImportedNode | null {
        if (this.visiting.has(model.id))
            return null;
        if (model.subClass === 'Light') {
            this.skipped.lights++;
            return null;
        }
        if (model.subClass === 'Camera' || model.subClass === 'CameraSwitcher') {
            this.skipped.cameras++;
            return null;
        }
        this.visiting.add(model.id);
        const name = model.name || `Nó_${this.meshes.length + 1}`;
        const node = createImportedNode(name);
        const { matrix, approximatedRotationOrder } = readFbxLocalTransform(this.localMatrix, model.properties);
        if (approximatedRotationOrder)
            this.approximatedRotationOrders++;
        mat4.decomposeTranslationRotationScale(node.position, node.rotation, node.scale, matrix);
        const meshes = this.collectMeshes(model, name);
        const geometric = readFbxGeometricTransform(this.geometricMatrix, model.properties);
        if (geometric && meshes.length > 0) {
            const holder = createImportedNode(`${name}_Geometria`);
            mat4.decomposeTranslationRotationScale(holder.position, holder.rotation, holder.scale, geometric);
            holder.meshes = meshes;
            node.children.push(holder);
        }
        else {
            node.meshes = meshes;
        }
        for (const child of this.doc.children(model.id, 'Model')) {
            const converted = this.convertModel(child);
            if (converted)
                node.children.push(converted);
        }
        this.visiting.delete(model.id);
        if (BONE_SUBCLASSES.has(model.subClass) && node.meshes.length === 0 && node.children.length === 0) {
            this.skipped.bones++;
            return null;
        }
        return node;
    }
}
async function parseFbx(file: File): Promise<{
    root: FbxNode;
    version: number;
}> {
    const buffer = await file.arrayBuffer();
    if (isBinaryFbx(buffer))
        return parseBinaryFbx(buffer);
    const text = new TextDecoder().decode(buffer);
    if (!isAsciiFbx(text))
        throw new Error('O arquivo não é um FBX binário nem ASCII reconhecível.');
    return parseAsciiFbx(text);
}
function readUpAxis(doc: FbxDocument, warnings: string[]): ImportUpAxis {
    const axis = doc.globalSettings.number('UpAxis', 1);
    if (axis === 2)
        return 'z';
    if (axis === 0)
        warnings.push('Eixo vertical X declarado no arquivo não é suportado; tratado como Y.');
    return 'y';
}
function collectDocumentWarnings(doc: FbxDocument, skipped: SkippedObjects, warnings: string[]): void {
    const animations = doc.count('AnimationStack') + doc.topLevel('Takes').reduce((total, takes) => total + takes.children.filter((node) => node.name === 'Take').length, 0);
    if (animations > 0)
        warnings.push(`${animations} animação(ões) ignorada(s); a importação é estática.`);
    const deformers = doc.byClass('Deformer');
    if (deformers.some((deformer) => deformer.subClass === 'Skin'))
        warnings.push('Pele e esqueleto ignorados; as malhas vêm na pose de vínculo.');
    if (deformers.some((deformer) => deformer.subClass === 'BlendShape'))
        warnings.push('Formas de mesclagem (blend shapes) ignoradas; usada a forma base.');
    if (skipped.bones > 0)
        warnings.push(`${skipped.bones} osso(s) sem malha omitidos da hierarquia.`);
    if (skipped.lights > 0)
        warnings.push(`${skipped.lights} luz(es) do arquivo não importada(s).`);
    if (skipped.cameras > 0)
        warnings.push(`${skipped.cameras} câmera(s) do arquivo não importada(s).`);
    if (skipped.unsupportedGeometries > 0)
        warnings.push(`${skipped.unsupportedGeometries} geometria(s) não poligonal(is) (NURBS, curvas) ignorada(s).`);
}
export async function importFbx(file: File, bundle: FileBundle): Promise<ImportedScene> {
    const { root, version } = await parseFbx(file);
    if (version > 0 && version < MINIMUM_VERSION)
        throw new Error(`FBX versão ${version / 1000} não suportada (mínimo 6.0).`);
    const doc = new FbxDocument(root, version);
    if (doc.objects.size === 0)
        throw new Error('O arquivo FBX não contém objetos.');
    const warnings: string[] = [];
    const materials = buildFbxMaterials(doc, bundle, file.name, warnings);
    const builder = new FbxSceneBuilder(doc, materials, warnings);
    const roots = builder.build();
    if (builder.meshes.length === 0)
        throw new Error('O arquivo FBX não contém malhas poligonais.');
    collectDocumentWarnings(doc, builder.skipped, warnings);
    const unitScale = doc.globalSettings.number('UnitScaleFactor', 1);
    return {
        format: 'fbx',
        name: baseNameWithoutExtension(file.name),
        sourceFile: file.name,
        roots,
        meshes: builder.meshes,
        materials: materials.materials,
        textures: materials.textures,
        upAxis: readUpAxis(doc, warnings),
        skins: [],
        animations: [],
        metersPerUnit: unitScale > 0 ? unitScale / 100 : null,
        warnings,
    };
}
