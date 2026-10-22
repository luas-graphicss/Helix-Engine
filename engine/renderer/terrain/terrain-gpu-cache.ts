import type { GL } from '@/engine/renderer/gl/context';
import type { Terrain } from '@/engine/terrain/core/terrain';
import type { TerrainLayer } from '@/engine/terrain/core/terrain-layer';
import { terrainMapSize, type TerrainMapKind, type TerrainMaterial } from '@/engine/terrain/materials/terrain-material';
import { readImagePixels } from '@/engine/terrain/materials/ormh-packer';
import { TerrainHeightTexture } from './terrain-height-texture';
const MAX_ANISOTROPY = 8;
const RETENTION_FRAMES = 300;
const KINDS: readonly TerrainMapKind[] = ['albedo', 'normal', 'ormh'];
function linearToSrgbByte(value: number): number {
    const srgb = value <= 0.0031308 ? value * 12.92 : 1.055 * Math.pow(value, 1 / 2.4) - 0.055;
    return Math.round(Math.min(Math.max(srgb, 0), 1) * 255);
}
function createTextureHandle(gl: GL): WebGLTexture {
    const handle = gl.createTexture();
    if (!handle)
        throw new Error('Não foi possível alocar uma textura do terreno.');
    return handle;
}
function sliceSignature(material: TerrainMaterial | null, kind: TerrainMapKind): string {
    if (!material)
        return 'neutral';
    const texture = material[kind];
    if (texture?.image)
        return `${texture.id}.${texture.version}`;
    if (kind === 'albedo')
        return `color:${material.averageColor[0]},${material.averageColor[1]},${material.averageColor[2]}`;
    if (kind === 'ormh')
        return `rough:${material.roughness}`;
    return 'flat';
}
class TerrainTextureArray {
    texture: WebGLTexture;
    count = 0;
    readonly signatures: string[] = [];
    readonly size: number;
    constructor(private readonly gl: GL, readonly kind: TerrainMapKind, private readonly internalFormat: number, private readonly maxAnisotropy: number, private readonly anisotropic: EXT_texture_filter_anisotropic | null) {
        this.size = terrainMapSize(kind);
        this.texture = createTextureHandle(gl);
    }
    sync(layers: readonly TerrainLayer[], neutral: (size: number) => Uint8Array): void {
        const { gl } = this;
        const count = Math.max(layers.length, 1);
        let dirty = false;
        if (count !== this.count) {
            this.allocate(count);
            dirty = true;
        }
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.texture);
        for (let slice = 0; slice < count; slice++) {
            const material = layers[slice]?.material ?? null;
            const signature = sliceSignature(material, this.kind);
            if (this.signatures[slice] === signature)
                continue;
            this.upload(slice, material, neutral);
            this.signatures[slice] = signature;
            dirty = true;
        }
        if (dirty)
            gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
    }
    private allocate(count: number): void {
        const { gl, size } = this;
        gl.deleteTexture(this.texture);
        this.texture = createTextureHandle(gl);
        this.count = count;
        this.signatures.length = 0;
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.texture);
        gl.texStorage3D(gl.TEXTURE_2D_ARRAY, Math.log2(size) + 1, this.internalFormat, size, size, count);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);
        if (this.anisotropic && this.maxAnisotropy > 1) {
            gl.texParameterf(gl.TEXTURE_2D_ARRAY, this.anisotropic.TEXTURE_MAX_ANISOTROPY_EXT, this.maxAnisotropy);
        }
    }
    private upload(slice: number, material: TerrainMaterial | null, neutral: (size: number) => Uint8Array): void {
        const { gl, size } = this;
        const image = material?.[this.kind]?.image ?? null;
        if (image) {
            if (image.width === size && image.height === size) {
                gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, slice, size, size, 1, gl.RGBA, gl.UNSIGNED_BYTE, image);
            }
            else {
                gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, slice, size, size, 1, gl.RGBA, gl.UNSIGNED_BYTE, readImagePixels(image, size));
            }
            return;
        }
        const pixels = neutral(size);
        let r = 128;
        let g = 128;
        let b = 128;
        if (this.kind === 'albedo') {
            const color = material?.averageColor ?? [0.5, 0.5, 0.5];
            r = linearToSrgbByte(color[0]);
            g = linearToSrgbByte(color[1]);
            b = linearToSrgbByte(color[2]);
        }
        else if (this.kind === 'normal') {
            b = 255;
        }
        else {
            r = 255;
            g = Math.round((material?.roughness ?? 0.9) * 255);
        }
        for (let i = 0; i < pixels.length; i += 4) {
            pixels[i] = r;
            pixels[i + 1] = g;
            pixels[i + 2] = b;
            pixels[i + 3] = 255;
        }
        gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, slice, size, size, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    }
    dispose(): void {
        this.gl.deleteTexture(this.texture);
    }
}
export class TerrainGpuResources {
    readonly heights: TerrainHeightTexture;
    readonly splat: readonly [
        WebGLTexture,
        WebGLTexture
    ];
    readonly grass: WebGLTexture;
    lastUsedFrame = 0;
    private readonly arrays: Record<TerrainMapKind, TerrainTextureArray>;
    private splatVersion = -1;
    private splatResolution = 0;
    private grassVersion = -1;
    private grassResolution = 0;
    constructor(private readonly gl: GL, maxAnisotropy: number, anisotropic: EXT_texture_filter_anisotropic | null, private readonly neutral: (size: number) => Uint8Array) {
        this.heights = new TerrainHeightTexture(gl);
        this.splat = [createTextureHandle(gl), createTextureHandle(gl)];
        this.grass = createTextureHandle(gl);
        this.arrays = {
            albedo: new TerrainTextureArray(gl, 'albedo', gl.SRGB8_ALPHA8, maxAnisotropy, anisotropic),
            normal: new TerrainTextureArray(gl, 'normal', gl.RGBA8, maxAnisotropy, anisotropic),
            ormh: new TerrainTextureArray(gl, 'ormh', gl.RGBA8, maxAnisotropy, anisotropic),
        };
    }
    get layerCount(): number {
        return this.arrays.albedo.count;
    }
    get albedoArray(): WebGLTexture {
        return this.arrays.albedo.texture;
    }
    get normalArray(): WebGLTexture {
        return this.arrays.normal.texture;
    }
    get ormhArray(): WebGLTexture {
        return this.arrays.ormh.texture;
    }
    sync(terrain: Terrain): void {
        const { gl } = this;
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
        this.heights.sync(terrain);
        if (terrain.splatVersion !== this.splatVersion || terrain.splat.resolution !== this.splatResolution) {
            this.uploadSplat(terrain);
        }
        if (terrain.grassVersion !== this.grassVersion || terrain.grassMap.resolution !== this.grassResolution) {
            this.uploadGrass(terrain);
        }
        for (const kind of KINDS)
            this.arrays[kind].sync(terrain.layers, this.neutral);
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
    }
    private uploadGrass(terrain: Terrain): void {
        const { gl } = this;
        const { resolution, data } = terrain.grassMap;
        gl.bindTexture(gl.TEXTURE_2D, this.grass);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        if (resolution !== this.grassResolution) {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, resolution, resolution, 0, gl.RED, gl.UNSIGNED_BYTE, data);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        }
        else {
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, resolution, resolution, gl.RED, gl.UNSIGNED_BYTE, data);
        }
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
        gl.bindTexture(gl.TEXTURE_2D, null);
        this.grassVersion = terrain.grassVersion;
        this.grassResolution = resolution;
    }
    private uploadSplat(terrain: Terrain): void {
        const { gl } = this;
        const { resolution, planes } = terrain.splat;
        const reallocate = resolution !== this.splatResolution;
        for (let plane = 0; plane < 2; plane++) {
            gl.bindTexture(gl.TEXTURE_2D, this.splat[plane]);
            if (reallocate) {
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, resolution, resolution, 0, gl.RGBA, gl.UNSIGNED_BYTE, planes[plane]);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            }
            else {
                gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, resolution, resolution, gl.RGBA, gl.UNSIGNED_BYTE, planes[plane]);
            }
        }
        gl.bindTexture(gl.TEXTURE_2D, null);
        this.splatVersion = terrain.splatVersion;
        this.splatResolution = resolution;
    }
    dispose(): void {
        const { gl } = this;
        this.heights.dispose();
        gl.deleteTexture(this.splat[0]);
        gl.deleteTexture(this.splat[1]);
        gl.deleteTexture(this.grass);
        for (const kind of KINDS)
            this.arrays[kind].dispose();
    }
}
export class TerrainGpuCache {
    private readonly entries = new Map<Terrain, TerrainGpuResources>();
    private readonly anisotropic: EXT_texture_filter_anisotropic | null;
    private readonly maxAnisotropy: number;
    private readonly neutralBuffers = new Map<number, Uint8Array>();
    private frame = 0;
    constructor(private readonly gl: GL) {
        this.anisotropic = gl.getExtension('EXT_texture_filter_anisotropic');
        this.maxAnisotropy = this.anisotropic
            ? Math.min(gl.getParameter(this.anisotropic.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number, MAX_ANISOTROPY)
            : 1;
    }
    resolve(terrain: Terrain): TerrainGpuResources {
        let entry = this.entries.get(terrain);
        if (!entry) {
            entry = new TerrainGpuResources(this.gl, this.maxAnisotropy, this.anisotropic, this.neutralBuffer);
            this.entries.set(terrain, entry);
        }
        entry.sync(terrain);
        entry.lastUsedFrame = this.frame;
        return entry;
    }
    endFrame(): void {
        this.frame++;
        for (const [terrain, entry] of this.entries) {
            if (this.frame - entry.lastUsedFrame > RETENTION_FRAMES) {
                entry.dispose();
                this.entries.delete(terrain);
            }
        }
    }
    dispose(): void {
        for (const entry of this.entries.values())
            entry.dispose();
        this.entries.clear();
        this.neutralBuffers.clear();
    }
    private readonly neutralBuffer = (size: number): Uint8Array => {
        let buffer = this.neutralBuffers.get(size);
        if (!buffer) {
            buffer = new Uint8Array(size * size * 4);
            this.neutralBuffers.set(size, buffer);
        }
        return buffer;
    };
}
