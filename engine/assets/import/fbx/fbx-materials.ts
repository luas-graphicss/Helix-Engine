import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { clamp } from '@/engine/core/math/scalar';
import { srgbToLinear } from '@/engine/core/color/srgb';
import { mimeTypeFromFileName, sniffImageMimeType } from '@/engine/assets/image-decoder';
import type { TextureWrap } from '@/engine/core/scene/texture';
import type { FileBundle } from '../file-bundle';
import { baseNameWithoutExtension, createImportedMaterial, createImportedTexture, type ImportedMaterial, type ImportedTexture } from '../import-types';
import type { FbxDocument, FbxObject } from './fbx-document';
import { findChild, propString, type FbxValue } from './fbx-node';
type TextureRole = 'baseColor' | 'normal' | 'bump' | 'emissive' | 'metallic' | 'roughness' | 'occlusion' | 'opacity' | 'unsupported';
const ROLE_BY_PROPERTY: Record<string, TextureRole> = {
    DiffuseColor: 'baseColor',
    Diffuse: 'baseColor',
    'Maya|TEX_color_map': 'baseColor',
    NormalMap: 'normal',
    'Maya|TEX_normal_map': 'normal',
    Bump: 'bump',
    EmissiveColor: 'emissive',
    Emissive: 'emissive',
    'Maya|TEX_emissive_map': 'emissive',
    'Maya|TEX_metallic_map': 'metallic',
    'Maya|TEX_roughness_map': 'roughness',
    'Maya|TEX_ao_map': 'occlusion',
    TransparentColor: 'opacity',
    TransparencyFactor: 'opacity',
};
const STINGRAY_USE_FLAG: Partial<Record<TextureRole, string>> = {
    baseColor: 'Maya|use_color_map',
    normal: 'Maya|use_normal_map',
    emissive: 'Maya|use_emissive_map',
    metallic: 'Maya|use_metallic_map',
    roughness: 'Maya|use_roughness_map',
    occlusion: 'Maya|use_ao_map',
};
const WHITE = vec3.create(1, 1, 1);
const DEFAULT_DIFFUSE = vec3.create(0.8, 0.8, 0.8);
const BLACK = vec3.create(0, 0, 0);
function classifyTextureProperty(property: string): TextureRole {
    const known = ROLE_BY_PROPERTY[property];
    if (known)
        return known;
    const lower = property.toLowerCase();
    if (/base_?colou?r|albedo|diffuse/.test(lower))
        return 'baseColor';
    if (/normal/.test(lower))
        return 'normal';
    if (/bump|height|displace/.test(lower))
        return 'bump';
    if (/emis/.test(lower))
        return 'emissive';
    if (/metal/.test(lower))
        return 'metallic';
    if (/rough/.test(lower))
        return 'roughness';
    if (/occlusion|(^|_)ao(_|$)/.test(lower))
        return 'occlusion';
    if (/opacity|transparen|cutout/.test(lower))
        return 'opacity';
    return 'unsupported';
}
function toLinear(out: Vec3, color: Vec3, factor = 1): Vec3 {
    return vec3.set(out, srgbToLinear(clamp(color[0] * factor, 0, 1)), srgbToLinear(clamp(color[1] * factor, 0, 1)), srgbToLinear(clamp(color[2] * factor, 0, 1)));
}
function roughnessFromShininess(shininess: number | null): number {
    if (shininess === null || !Number.isFinite(shininess))
        return 0.6;
    return clamp(Math.sqrt(2 / (Math.max(shininess, 0) + 2)), 0.04, 1);
}
function decodeBase64(text: string): Uint8Array | null {
    try {
        const binary = atob(text.replace(/\s+/g, ''));
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++)
            bytes[i] = binary.charCodeAt(i);
        return bytes;
    }
    catch {
        return null;
    }
}
function readEmbeddedContent(video: FbxObject): Uint8Array | null {
    const content = findChild(video.node, 'Content');
    if (!content)
        return null;
    const raw = content.props.find((value): value is Uint8Array => value instanceof Uint8Array);
    if (raw)
        return raw.byteLength > 0 ? raw : null;
    const text = content.props.filter((value): value is string => typeof value === 'string').join('');
    return text ? decodeBase64(text) : null;
}
function wrapMode(value: FbxValue | undefined): TextureWrap {
    return value === 1 ? 'clamp' : 'repeat';
}
class FbxTextureTable {
    readonly textures: ImportedTexture[] = [];
    private readonly indexByObject = new Map<string, number>();
    constructor(private readonly doc: FbxDocument, private readonly bundle: FileBundle, private readonly sourcePath: string, private readonly warnings: string[]) { }
    add(object: FbxObject): number | null {
        if (object.className === 'LayeredTexture') {
            const layers = this.doc.children(object.id, 'Texture');
            if (layers.length === 0)
                return null;
            if (layers.length > 1)
                this.warnings.push(`Textura em camadas "${object.name}": apenas a primeira camada é usada.`);
            return this.add(layers[0]);
        }
        const cached = this.indexByObject.get(object.id);
        if (cached !== undefined)
            return cached;
        const relativePath = propString(findChild(object.node, 'RelativeFilename'), 0);
        const absolutePath = propString(findChild(object.node, 'FileName'), 0) || propString(findChild(object.node, 'Filename'), 0);
        const displayPath = relativePath || absolutePath || object.name;
        let data: Blob | null = null;
        let mimeType: string | null = null;
        const video = this.doc.children(object.id, 'Video')[0];
        const embedded = video ? readEmbeddedContent(video) : null;
        if (embedded) {
            mimeType = sniffImageMimeType(embedded) ?? mimeTypeFromFileName(displayPath);
            data = new Blob([embedded], { type: mimeType ?? '' });
        }
        else {
            const file = this.bundle.resolve(relativePath, this.sourcePath) ?? this.bundle.resolve(absolutePath, this.sourcePath);
            if (file) {
                data = file;
                mimeType = file.type || mimeTypeFromFileName(file.name);
            }
            else {
                mimeType = mimeTypeFromFileName(displayPath);
                this.warnings.push(`Textura não encontrada: "${displayPath}". Selecione-a junto com o modelo.`);
            }
        }
        const { properties } = object;
        const scale = vec3.create();
        properties.vector3(scale, 'Scaling', WHITE);
        const translation = vec3.create();
        properties.vector3(translation, 'Translation', BLACK);
        if (scale[0] !== 1 || scale[1] !== 1 || translation[0] !== 0 || translation[1] !== 0 || properties.number('Rotation', 0) !== 0) {
            this.warnings.push(`Textura "${displayPath}": transformação de UV (deslocamento/escala) ignorada.`);
        }
        const texture = createImportedTexture(baseNameWithoutExtension(displayPath) || object.name, displayPath, data, mimeType, {
            wrapS: wrapMode(properties.raw('WrapModeU')?.[0]),
            wrapT: wrapMode(properties.raw('WrapModeV')?.[0]),
        });
        const index = this.textures.length;
        this.textures.push(texture);
        this.indexByObject.set(object.id, index);
        return index;
    }
}
function readOpacity(object: FbxObject): number {
    const { properties } = object;
    if (properties.has('Opacity'))
        return clamp(properties.number('Opacity', 1), 0, 1);
    let transparency = clamp(properties.number('TransparencyFactor', 0), 0, 1);
    if (transparency === 1 && properties.has('TransparentColor')) {
        const color = properties.vector3(vec3.create(), 'TransparentColor', BLACK);
        transparency = clamp((color[0] + color[1] + color[2]) / 3, 0, 1);
    }
    return 1 - transparency;
}
function convertMaterial(object: FbxObject, index: number, doc: FbxDocument, textures: FbxTextureTable, warnings: string[]): ImportedMaterial {
    const { properties } = object;
    const name = object.name || `Material_${index + 1}`;
    const out = createImportedMaterial(name);
    const color = vec3.create();
    const stingray = properties.has('Maya|base_color') || properties.has('Maya|roughness');
    if (stingray) {
        toLinear(out.baseColor, properties.vector3(color, 'Maya|base_color', DEFAULT_DIFFUSE));
        out.roughness = clamp(properties.number('Maya|roughness', 0.5), 0, 1);
        out.metallic = clamp(properties.number('Maya|metallic', 0), 0, 1);
        toLinear(out.emissive, properties.vector3(color, 'Maya|emissive', BLACK));
        out.emissiveIntensity = Math.max(properties.number('Maya|emissive_intensity', 1), 0);
    }
    else {
        const diffuse = properties.has('DiffuseColor') ? properties.vector3(color, 'DiffuseColor', DEFAULT_DIFFUSE) : properties.vector3(color, 'Diffuse', DEFAULT_DIFFUSE);
        toLinear(out.baseColor, diffuse, properties.number('DiffuseFactor', 1));
        const emissive = properties.has('EmissiveColor') ? properties.vector3(color, 'EmissiveColor', BLACK) : properties.vector3(color, 'Emissive', BLACK);
        toLinear(out.emissive, emissive, properties.number('EmissiveFactor', 1));
        const shininess = properties.has('ShininessExponent') ? properties.number('ShininessExponent', 20) : properties.has('Shininess') ? properties.number('Shininess', 20) : null;
        out.roughness = roughnessFromShininess(shininess);
    }
    out.opacity = readOpacity(object);
    if (out.opacity < 1)
        out.alphaMode = 'blend';
    for (const { object: texture, property } of doc.propertyConnections(object.id)) {
        if (texture.className !== 'Texture' && texture.className !== 'LayeredTexture')
            continue;
        const role = classifyTextureProperty(property);
        const useFlag = STINGRAY_USE_FLAG[role];
        if (stingray && useFlag && !properties.bool(useFlag, true))
            continue;
        switch (role) {
            case 'baseColor':
                out.baseColorMap = textures.add(texture);
                if (out.baseColorMap !== null)
                    vec3.copy(out.baseColor, WHITE);
                break;
            case 'normal':
                out.normalMap = textures.add(texture);
                out.normalScale = properties.number('BumpFactor', 1);
                break;
            case 'bump':
                out.normalMap = textures.add(texture);
                out.normalScale = properties.number('BumpFactor', 1);
                out.normalMapMayBeHeight = true;
                break;
            case 'emissive':
                out.emissiveMap = textures.add(texture);
                if (out.emissiveMap !== null && !out.emissive[0] && !out.emissive[1] && !out.emissive[2])
                    vec3.copy(out.emissive, WHITE);
                break;
            case 'metallic':
                out.metallicMap = textures.add(texture);
                if (out.metallicMap !== null)
                    out.metallic = 1;
                break;
            case 'roughness':
                out.roughnessMap = textures.add(texture);
                if (out.roughnessMap !== null)
                    out.roughness = 1;
                break;
            case 'occlusion':
                out.occlusionMap = textures.add(texture);
                break;
            case 'opacity':
                if (out.alphaMode === 'opaque')
                    out.alphaMode = 'mask';
                warnings.push(`${name}: mapa de opacidade ("${property}") ignorado; use o alfa da textura de cor base.`);
                break;
            default:
                warnings.push(`${name}: textura ligada a "${property}" não tem equivalente PBR e foi ignorada.`);
        }
    }
    return out;
}
export interface FbxMaterialTable {
    materials: ImportedMaterial[];
    textures: ImportedTexture[];
    indexOf(materialId: string): number | null;
}
export function buildFbxMaterials(doc: FbxDocument, bundle: FileBundle, sourcePath: string, warnings: string[]): FbxMaterialTable {
    const textures = new FbxTextureTable(doc, bundle, sourcePath, warnings);
    const materials: ImportedMaterial[] = [];
    const indexById = new Map<string, number>();
    doc.byClass('Material').forEach((object, index) => {
        indexById.set(object.id, materials.length);
        materials.push(convertMaterial(object, index, doc, textures, warnings));
    });
    return {
        materials,
        textures: textures.textures,
        indexOf: (materialId) => indexById.get(materialId) ?? null,
    };
}
