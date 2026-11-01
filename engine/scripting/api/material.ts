import * as vec3 from '@/engine/core/math/vec3';
import { Entity } from '@/engine/core/scene/entity';
import { cloneMaterial, copyMaterial, createMaterial, hasAnyTexture, MATERIAL_TEXTURE_SLOTS, type Material } from '@/engine/core/scene/material';
import { createTexture, setTextureImage, touchTexture, type Texture, type TextureImage } from '@/engine/core/scene/texture';
import { decodeImage } from '@/engine/assets/image-decoder';
import { generateMapsFromAlbedo, createPipelineSettings } from '@/engine/materials/map-generation';
import { packOrm } from '@/engine/materials/map-packing';
import type { MaterialDocument } from '@/engine/materials/material-document';
import { applyLibraryMaterial, saveEntityMaterialToLibrary } from '@/engine/editor/operations/material-library-operations';
import { isMaterial, isTexture } from '../runtime/engine-objects';
import { HelixArgumentError } from '../runtime/script-errors';
import type { RuntimeHost } from '../runtime/runtime-host';
import type { ShaderMaterial } from '../runtime/shader-bindings';
import { assignSettings, requireEntity, requireNumber, requireObject, requireString, toLinearColor } from '../runtime/values';
const COLOR_FIELDS = new Set(['baseColor', 'emissive']);
function requireMaterial(value: unknown, member: string): Material {
    if (value instanceof Entity) {
        if (!value.material)
            throw new HelixArgumentError(member, `${value.name} não tem material.`);
        return value.material;
    }
    if (isMaterial(value))
        return value;
    throw new HelixArgumentError(member, 'esperava um Material (helix.material.create(), entity.material) ou um ator com material.');
}
function requireTexture(value: unknown, member: string): Texture {
    if (isTexture(value))
        return value;
    throw new HelixArgumentError(member, 'esperava uma Texture (helix.texture.create(), helix.texture.fromAsset()…).');
}
function isTextureImage(value: unknown): value is TextureImage {
    if (typeof ImageBitmap !== 'undefined' && value instanceof ImageBitmap)
        return true;
    if (typeof HTMLImageElement !== 'undefined' && value instanceof HTMLImageElement)
        return true;
    if (typeof HTMLCanvasElement !== 'undefined' && value instanceof HTMLCanvasElement)
        return true;
    if (typeof ImageData !== 'undefined' && value instanceof ImageData)
        return true;
    return false;
}
function patchMaterial(material: Material, patch: unknown, member: string): Material {
    const source = requireObject(patch, member);
    for (const [key, value] of Object.entries(source)) {
        if (!(key in material))
            throw new HelixArgumentError(member, `"${key}" não é um campo de Material. Campos: ${Object.keys(material).join(', ')}.`);
        if (COLOR_FIELDS.has(key)) {
            toLinearColor(value, `${member}.${key}`, material[key as 'baseColor' | 'emissive']);
            continue;
        }
        if (MATERIAL_TEXTURE_SLOTS.some((entry) => entry.slot === key)) {
            if (value !== null && !isTexture(value))
                throw new HelixArgumentError(member, `"${key}" precisa ser uma Texture ou null.`);
            (material as unknown as Record<string, unknown>)[key] = value;
            continue;
        }
        ;
        (material as unknown as Record<string, unknown>)[key] = value;
    }
    return material;
}
export function createMaterialApi(host: RuntimeHost) {
    const { session } = host;
    function documentOf(value: unknown, member: string): MaterialDocument {
        if (typeof value === 'object' && value !== null && 'material' in (value as object) && 'pipeline' in (value as object))
            return value as MaterialDocument;
        const key = requireString(value, member, 'o id ou nome do material');
        const found = session.materials.get(key) ?? session.materials.all.find((entry) => entry.name === key) ?? session.materials.all.find((entry) => entry.name.toLowerCase() === key.toLowerCase());
        if (!found)
            throw new HelixArgumentError(member, `material "${key}" não existe na biblioteca. Disponíveis: ${session.materials.all.map((entry) => entry.name).join(', ') || 'nenhum'}.`);
        return found;
    }
    const materialApi = {
        create: (options?: unknown) => {
            const material = createMaterial();
            if (options !== undefined)
                patchMaterial(material, options, 'helix.material.create');
            return material;
        },
        clone: (value: unknown) => cloneMaterial(requireMaterial(value, 'helix.material.clone')),
        copy: (target: unknown, source: unknown) => copyMaterial(requireMaterial(target, 'helix.material.copy'), requireMaterial(source, 'helix.material.copy')),
        set: (value: unknown, patch: unknown) => patchMaterial(requireMaterial(value, 'helix.material.set'), patch, 'helix.material.set'),
        hasAnyTexture: (value: unknown) => hasAnyTexture(requireMaterial(value, 'helix.material.hasAnyTexture')),
        of: (entity: unknown) => requireEntity(entity, 'helix.material.of').material,
        assign: (entity: unknown, material: unknown) => {
            const target = requireEntity(entity, 'helix.material.assign');
            target.material = material === null ? null : requireMaterial(material, 'helix.material.assign');
            session.notify();
            return target.material;
        },
        own: (entity: unknown) => {
            const target = requireEntity(entity, 'helix.material.own');
            if (!target.material)
                target.material = createMaterial();
            else if (target.material.libraryId || sharedBy(session, target.material) > 1)
                target.material = { ...cloneMaterial(target.material), libraryId: null };
            session.notify();
            return target.material;
        },
        setColor: (value: unknown, color: unknown) => {
            toLinearColor(color, 'helix.material.setColor', requireMaterial(value, 'helix.material.setColor').baseColor);
        },
        setEmissive: (value: unknown, color: unknown, intensity?: unknown) => {
            const material = requireMaterial(value, 'helix.material.setEmissive');
            toLinearColor(color, 'helix.material.setEmissive', material.emissive);
            if (intensity !== undefined)
                material.emissiveIntensity = requireNumber(intensity, 'helix.material.setEmissive', 'a intensidade');
        },
        setTexture: (value: unknown, slot: unknown, texture: unknown) => {
            const material = requireMaterial(value, 'helix.material.setTexture');
            const name = requireString(slot, 'helix.material.setTexture', 'o slot');
            if (!MATERIAL_TEXTURE_SLOTS.some((entry) => entry.slot === name))
                throw new HelixArgumentError('helix.material.setTexture', `slot "${name}" não existe. Slots: ${MATERIAL_TEXTURE_SLOTS.map((entry) => entry.slot).join(', ')}.`);
            material[name as 'baseColorMap'] = texture === null ? null : requireTexture(texture, 'helix.material.setTexture');
        },
        slots: () => MATERIAL_TEXTURE_SLOTS.map((entry) => ({ ...entry })),
        fromShader: (asset: unknown, uniforms?: unknown) => host.materialFromShader(asset, uniforms),
        uniforms: (value: unknown) => {
            const material = requireMaterial(value, 'helix.material.uniforms') as Partial<ShaderMaterial>;
            if (!material.uniforms)
                throw new HelixArgumentError('helix.material.uniforms', `${material.name ?? 'o material'} não veio de helix.material.fromShader; só materiais com shader têm uniformes.`);
            return material.uniforms;
        },
        generateNormalFromHeight: async (image: unknown, strength?: unknown) => {
            if (!isTextureImage(image))
                throw new HelixArgumentError('helix.material.generateNormalFromHeight', 'esperava uma imagem (ImageBitmap, canvas ou ImageData).');
            const settings = createPipelineSettings();
            settings.normal.enabled = true;
            if (strength !== undefined)
                settings.normal.strength = requireNumber(strength, 'helix.material.generateNormalFromHeight', 'a força');
            const maps = await generateMapsFromAlbedo(image, settings);
            return maps.normal;
        },
        generateMaps: async (image: unknown, settings?: unknown) => {
            if (!isTextureImage(image))
                throw new HelixArgumentError('helix.material.generateMaps', 'esperava uma imagem (ImageBitmap, canvas ou ImageData).');
            const pipeline = createPipelineSettings();
            if (settings !== undefined)
                assignSettings(pipeline as unknown as Record<string, unknown>, settings, 'helix.material.generateMaps');
            return generateMapsFromAlbedo(image, pipeline);
        },
        packOrm: (sources: unknown) => {
            const spec = requireObject(sources, 'helix.material.packOrm');
            const pick = (key: string) => {
                const value = spec[key];
                if (value === undefined || value === null)
                    return null;
                if (!isTextureImage(value))
                    throw new HelixArgumentError('helix.material.packOrm', `"${key}" precisa ser uma imagem.`);
                return value;
            };
            return packOrm({ occlusion: pick('occlusion'), roughness: pick('roughness'), metallic: pick('metallic') });
        },
    };
    const materialsApi = {
        get: (idOrName: unknown) => {
            try {
                return documentOf(idOrName, 'helix.materials.get');
            }
            catch {
                return null;
            }
        },
        list: () => session.materials.all.slice(),
        names: () => session.materials.all.map((entry) => entry.name),
        save: (material: unknown, name: unknown) => {
            if (material instanceof Entity) {
                const saved = saveEntityMaterialToLibrary(session, material);
                if (saved && typeof name === 'string' && name)
                    session.materials.rename(saved, name);
                return saved;
            }
            return session.materials.createFromMaterial(requireMaterial(material, 'helix.materials.save'), typeof name === 'string' && name ? name : undefined);
        },
        remove: (idOrName: unknown) => {
            session.materials.remove(documentOf(idOrName, 'helix.materials.remove'));
        },
        rename: (idOrName: unknown, name: unknown) => session.materials.rename(documentOf(idOrName, 'helix.materials.rename'), requireString(name, 'helix.materials.rename', 'o novo nome')),
        instantiate: (idOrName: unknown) => documentOf(idOrName, 'helix.materials.instantiate').material,
        apply: (entity: unknown, idOrName: unknown, withPhysics: unknown = true) => applyLibraryMaterial(session, requireEntity(entity, 'helix.materials.apply'), documentOf(idOrName, 'helix.materials.apply'), Boolean(withPhysics)),
        update: (idOrName: unknown, patch: unknown) => {
            const document = documentOf(idOrName, 'helix.materials.update');
            session.materials.updateMaterial(document, (material) => {
                patchMaterial(material, patch, 'helix.materials.update');
            });
        },
        forMaterial: (material: unknown) => session.materials.forMaterial(requireMaterial(material, 'helix.materials.forMaterial')),
        onChanged: (handler: unknown) => {
            if (typeof handler !== 'function')
                throw new HelixArgumentError('helix.materials.onChanged', 'esperava uma função.');
            const owner = host.current;
            const dispose = session.materials.addSyncListener((document) => host.invoke(owner, 'helix.materials.onChanged', () => (handler as (document: MaterialDocument) => void)(document)));
            owner?.track(dispose);
            return dispose;
        },
    };
    const textureApi = {
        create: (options: unknown) => {
            const spec = requireObject(options, 'helix.texture.create');
            const name = typeof spec.name === 'string' ? spec.name : 'Textura';
            const image = spec.image === undefined || spec.image === null ? null : spec.image;
            if (image !== null && !isTextureImage(image))
                throw new HelixArgumentError('helix.texture.create', 'image precisa ser ImageBitmap, HTMLImageElement, canvas ou ImageData.');
            return createTexture({ ...(spec as object), name, image: image as TextureImage | null });
        },
        fromAsset: async (asset: unknown, options?: unknown) => {
            const resolved = host.resolveAsset(asset, 'helix.texture.fromAsset', 'texture');
            const file = await session.library.primaryFile(resolved);
            const image = await decodeImage(file, file.type || null);
            const spec = (options ?? {}) as Record<string, unknown>;
            return createTexture({ name: resolved.name, image, sourcePath: file.name, mimeType: file.type || null, colorSpace: spec.colorSpace === 'linear' ? 'linear' : 'srgb', ...(spec as object) });
        },
        fromImage: (image: unknown, options?: unknown) => {
            if (!isTextureImage(image))
                throw new HelixArgumentError('helix.texture.fromImage', 'esperava ImageBitmap, HTMLImageElement, canvas ou ImageData.');
            const spec = (options ?? {}) as Record<string, unknown>;
            return createTexture({ name: typeof spec.name === 'string' ? spec.name : 'Imagem', image, ...(spec as object) });
        },
        fromPixels: (width: unknown, height: unknown, pixels: unknown, options?: unknown) => {
            const w = Math.max(1, Math.floor(requireNumber(width, 'helix.texture.fromPixels', 'a largura')));
            const h = Math.max(1, Math.floor(requireNumber(height, 'helix.texture.fromPixels', 'a altura')));
            let data: Uint8ClampedArray;
            if (pixels instanceof Uint8ClampedArray)
                data = pixels;
            else if (pixels instanceof Uint8Array)
                data = new Uint8ClampedArray(pixels.buffer, pixels.byteOffset, pixels.byteLength);
            else if (pixels instanceof Float32Array) {
                data = new Uint8ClampedArray(pixels.length);
                for (let index = 0; index < pixels.length; index++)
                    data[index] = Math.round(Math.max(0, Math.min(1, pixels[index])) * 255);
            }
            else if (Array.isArray(pixels))
                data = new Uint8ClampedArray(pixels as number[]);
            else
                throw new HelixArgumentError('helix.texture.fromPixels', 'pixels precisa ser Uint8Array/Uint8ClampedArray (0..255) ou Float32Array (0..1), com 4 canais por pixel.');
            if (data.length !== w * h * 4)
                throw new HelixArgumentError('helix.texture.fromPixels', `esperava ${w * h * 4} valores (RGBA × ${w}×${h}); recebido ${data.length}.`);
            const image = new ImageData(data, w, h);
            const spec = (options ?? {}) as Record<string, unknown>;
            return createTexture({ name: typeof spec.name === 'string' ? spec.name : 'Pixels', image, colorSpace: spec.colorSpace === 'linear' ? 'linear' : 'srgb', dynamic: Boolean(spec.dynamic), ...(spec as object) });
        },
        setImage: (texture: unknown, image: unknown) => {
            if (image !== null && !isTextureImage(image))
                throw new HelixArgumentError('helix.texture.setImage', 'esperava uma imagem ou null.');
            setTextureImage(requireTexture(texture, 'helix.texture.setImage'), image as TextureImage | null);
        },
        touch: (texture: unknown) => touchTexture(requireTexture(texture, 'helix.texture.touch')),
        readPixels: (texture: unknown) => {
            const target = requireTexture(texture, 'helix.texture.readPixels');
            if (!target.image)
                throw new HelixArgumentError('helix.texture.readPixels', `a textura ${target.name} não tem imagem carregada.`);
            if (target.image instanceof ImageData)
                return target.image;
            const canvas = document.createElement('canvas');
            canvas.width = target.width;
            canvas.height = target.height;
            const context = canvas.getContext('2d');
            if (!context)
                throw new HelixArgumentError('helix.texture.readPixels', 'o navegador não deu um contexto 2D.');
            context.drawImage(target.image as CanvasImageSource, 0, 0);
            return context.getImageData(0, 0, canvas.width, canvas.height);
        },
        canvas: (width: unknown, height: unknown, options?: unknown) => {
            const w = Math.max(1, Math.floor(requireNumber(width, 'helix.texture.canvas', 'a largura')));
            const h = Math.max(1, Math.floor(requireNumber(height, 'helix.texture.canvas', 'a altura')));
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const context = canvas.getContext('2d');
            if (!context)
                throw new HelixArgumentError('helix.texture.canvas', 'o navegador não deu um contexto 2D.');
            const spec = (options ?? {}) as Record<string, unknown>;
            const texture = createTexture({ name: typeof spec.name === 'string' ? spec.name : 'Canvas', image: canvas, dynamic: true, colorSpace: spec.colorSpace === 'linear' ? 'linear' : 'srgb', wrapS: 'clamp', wrapT: 'clamp' });
            return { texture, context, canvas, update: () => touchTexture(texture) };
        },
        isTexture,
    };
    return { material: materialApi, materials: materialsApi, texture: textureApi };
}
