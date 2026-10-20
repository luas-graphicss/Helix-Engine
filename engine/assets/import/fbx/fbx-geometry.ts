import { createIndexArray, type MeshData } from '@/engine/renderer/geometry/mesh-data';
import { triangulatePolygon, withSmoothNormals } from '../geometry-utils';
import type { FbxObject } from './fbx-document';
import { childArray, findChild, findChildren, propNumber, propString, type FbxArray, type FbxNode } from './fbx-node';
type Mapping = 'ByPolygonVertex' | 'ByVertice' | 'ByPolygon' | 'AllSame';
interface LayerElement {
    mapping: Mapping;
    data: FbxArray;
    indices: FbxArray | null;
}
export interface FbxSubMesh {
    materialSlot: number;
    geometry: MeshData;
    hadNormals: boolean;
    hadUvs: boolean;
}
const MAPPING_ALIASES: Record<string, Mapping> = {
    ByPolygonVertex: 'ByPolygonVertex',
    ByVertice: 'ByVertice',
    ByVertex: 'ByVertice',
    ByControlPoint: 'ByVertice',
    ByPolygon: 'ByPolygon',
    AllSame: 'AllSame',
};
const KEY_PRECISION = 1e4;
function readLayerElement(node: FbxNode, elementName: string, dataName: string, indexName: string | null, label: string, warnings: string[]): LayerElement | null {
    const elements = findChildren(node, elementName);
    if (elements.length === 0)
        return null;
    const element = elements.find((candidate) => propNumber(candidate, 0, 0) === 0) ?? elements[0];
    const data = childArray(element, dataName);
    if (!data)
        return null;
    const mappingName = propString(findChild(element, 'MappingInformationType'), 0, 'ByPolygonVertex');
    const mapping = MAPPING_ALIASES[mappingName];
    if (!mapping) {
        warnings.push(`${label}: mapeamento "${mappingName}" não suportado; atributo ignorado.`);
        return null;
    }
    const reference = propString(findChild(element, 'ReferenceInformationType'), 0, 'Direct');
    const indices = reference === 'IndexToDirect' || reference === 'Index' ? (indexName ? childArray(element, indexName) : null) : null;
    return { mapping, data, indices };
}
function elementIndex(element: LayerElement, corner: number, controlPoint: number, polygon: number): number {
    let index: number;
    switch (element.mapping) {
        case 'ByPolygonVertex':
            index = corner;
            break;
        case 'ByVertice':
            index = controlPoint;
            break;
        case 'ByPolygon':
            index = polygon;
            break;
        default:
            index = 0;
    }
    if (element.indices)
        index = index < element.indices.length ? element.indices[index] : -1;
    return index;
}
class SubMeshBuilder {
    readonly positions: number[] = [];
    readonly normals: number[] = [];
    readonly uvs: number[] = [];
    readonly indices: number[] = [];
    private readonly lookup = new Map<string, number>();
    constructor(readonly materialSlot: number) { }
    vertex(key: string, x: number, y: number, z: number, nx: number, ny: number, nz: number, u: number, v: number, withNormals: boolean): number {
        let index = this.lookup.get(key);
        if (index !== undefined)
            return index;
        index = this.positions.length / 3;
        this.lookup.set(key, index);
        this.positions.push(x, y, z);
        if (withNormals)
            this.normals.push(nx, ny, nz);
        this.uvs.push(u, v);
        return index;
    }
    toMeshData(name: string, withNormals: boolean): MeshData {
        if (!withNormals)
            return withSmoothNormals(name, this.positions, this.uvs, this.indices);
        return {
            name,
            positions: new Float32Array(this.positions),
            normals: new Float32Array(this.normals),
            uvs: new Float32Array(this.uvs),
            indices: createIndexArray(this.indices, this.positions.length / 3),
        };
    }
}
export function convertFbxGeometry(object: FbxObject, name: string, warnings: string[]): FbxSubMesh[] {
    const { node } = object;
    const vertices = childArray(node, 'Vertices');
    const polygonVertexIndex = childArray(node, 'PolygonVertexIndex');
    if (!vertices || !polygonVertexIndex || vertices.length < 9 || polygonVertexIndex.length < 3) {
        warnings.push(`${name}: geometria sem vértices ou polígonos; ignorada.`);
        return [];
    }
    const controlPointCount = Math.floor(vertices.length / 3);
    const cornerCount = polygonVertexIndex.length;
    const controlPoints = new Int32Array(cornerCount);
    const polygons: number[][] = [];
    let current: number[] = [];
    for (let corner = 0; corner < cornerCount; corner++) {
        const raw = polygonVertexIndex[corner];
        controlPoints[corner] = raw < 0 ? -raw - 1 : raw;
        current.push(corner);
        if (raw < 0) {
            polygons.push(current);
            current = [];
        }
    }
    if (current.length > 0)
        polygons.push(current);
    const normalElement = readLayerElement(node, 'LayerElementNormal', 'Normals', 'NormalsIndex', `${name} (normais)`, warnings);
    const uvElement = readLayerElement(node, 'LayerElementUV', 'UV', 'UVIndex', `${name} (UV)`, warnings);
    const materialElement = readLayerElement(node, 'LayerElementMaterial', 'Materials', null, `${name} (materiais)`, warnings);
    const hadNormals = normalElement !== null;
    const hadUvs = uvElement !== null;
    const slotOfPolygon = (polygon: number): number => {
        if (!materialElement)
            return 0;
        const index = materialElement.mapping === 'ByPolygon' ? polygon : 0;
        const slot = index < materialElement.data.length ? materialElement.data[index] : 0;
        return slot >= 0 ? Math.trunc(slot) : 0;
    };
    const builders = new Map<number, SubMeshBuilder>();
    const builderFor = (slot: number): SubMeshBuilder => {
        let builder = builders.get(slot);
        if (!builder) {
            builder = new SubMeshBuilder(slot);
            builders.set(slot, builder);
        }
        return builder;
    };
    const triangles: number[] = [];
    let invalidPolygons = 0;
    for (let polygon = 0; polygon < polygons.length; polygon++) {
        const corners = polygons[polygon];
        if (corners.length < 3)
            continue;
        if (corners.some((corner) => controlPoints[corner] >= controlPointCount)) {
            invalidPolygons++;
            continue;
        }
        triangles.length = 0;
        triangulatePolygon(corners.length, (i) => {
            const base = controlPoints[corners[i]] * 3;
            return [vertices[base], vertices[base + 1], vertices[base + 2]];
        }, triangles);
        const builder = builderFor(slotOfPolygon(polygon));
        for (const local of triangles) {
            const corner = corners[local];
            const controlPoint = controlPoints[corner];
            const base = controlPoint * 3;
            let nx = 0, ny = 0, nz = 0;
            if (normalElement) {
                const index = elementIndex(normalElement, corner, controlPoint, polygon) * 3;
                if (index >= 0 && index + 2 < normalElement.data.length) {
                    nx = normalElement.data[index];
                    ny = normalElement.data[index + 1];
                    nz = normalElement.data[index + 2];
                    const length = Math.hypot(nx, ny, nz);
                    if (length > 0) {
                        nx /= length;
                        ny /= length;
                        nz /= length;
                    }
                }
            }
            let u = 0, v = 0;
            if (uvElement) {
                const index = elementIndex(uvElement, corner, controlPoint, polygon) * 2;
                if (index >= 0 && index + 1 < uvElement.data.length) {
                    u = uvElement.data[index];
                    v = 1 - uvElement.data[index + 1];
                }
            }
            const key = hadNormals
                ? `${controlPoint}|${Math.round(nx * KEY_PRECISION)},${Math.round(ny * KEY_PRECISION)},${Math.round(nz * KEY_PRECISION)}|${Math.round(u * KEY_PRECISION)},${Math.round(v * KEY_PRECISION)}`
                : `${controlPoint}|${Math.round(u * KEY_PRECISION)},${Math.round(v * KEY_PRECISION)}`;
            builder.indices.push(builder.vertex(key, vertices[base], vertices[base + 1], vertices[base + 2], nx, ny, nz, u, v, hadNormals));
        }
    }
    if (invalidPolygons > 0)
        warnings.push(`${name}: ${invalidPolygons} polígono(s) com índices fora do intervalo foram ignorados.`);
    const slots = Array.from(builders.keys()).sort((a, b) => a - b);
    return slots
        .map((slot) => builders.get(slot)!)
        .filter((builder) => builder.indices.length >= 3)
        .map((builder) => ({
        materialSlot: builder.materialSlot,
        geometry: builder.toMeshData(slots.length > 1 ? `${name}_${builder.materialSlot + 1}` : name, hadNormals),
        hadNormals,
        hadUvs,
    }));
}
