import type { GL } from './context';
import type { Texture, TextureImage } from '@/engine/core/scene/texture';
import { mipChainBytes, rgbaLevelBytes } from '@/engine/renderer/textures/mips/mip-levels';
import { ResidentTextureSet, type TextureResidencySettings } from '@/engine/renderer/textures/resident-texture-set';
import { uploadImageMipChain } from '@/engine/renderer/textures/upload/image-mip-upload';
import { applyImageUnpackState, imageInternalFormat } from '@/engine/renderer/textures/upload/image-transfer';
import { TextureSampling } from '@/engine/renderer/textures/upload/texture-sampling';
interface CacheEntry {
    handle: WebGLTexture;
    version: number;
    width: number;
    height: number;
    dynamic: boolean;
    bytes: number;
}
export interface TextureResidencyStats {
    resident: number;
    residentBytes: number;
    compressed: number;
    reduced: number;
    compressing: number;
    compressionAvailable: boolean;
}
function createSolidTexture(gl: GL, r: number, g: number, b: number, a: number): WebGLTexture {
    const handle = gl.createTexture();
    if (!handle)
        throw new Error('Não foi possível alocar a textura de reserva.');
    gl.bindTexture(gl.TEXTURE_2D, handle);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([r, g, b, a]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return handle;
}
function residentBytes(texture: Texture): number {
    return texture.dynamic ? rgbaLevelBytes(texture.width, texture.height) : mipChainBytes(texture.width, texture.height, 0, rgbaLevelBytes);
}
export class GpuTextureCache {
    readonly white: WebGLTexture;
    readonly flatNormal: WebGLTexture;
    readonly stats = { uploads: 0, pending: 0 };
    readonly residency: TextureResidencyStats;
    frame = 0;
    private readonly entries = new Map<number, CacheEntry>();
    private readonly exactTextures = new Set<number>();
    private readonly sampling: TextureSampling;
    private readonly materialMaps: ResidentTextureSet;
    private settings: TextureResidencySettings = { textureCompression: false, mipStreaming: false, textureBudgetMb: 0 };
    private entryBytes = 0;
    private managingMaterialMaps = false;
    constructor(private readonly gl: GL) {
        this.white = createSolidTexture(gl, 255, 255, 255, 255);
        this.flatNormal = createSolidTexture(gl, 128, 128, 255, 255);
        this.sampling = new TextureSampling(gl);
        this.materialMaps = new ResidentTextureSet(gl, this.sampling, this.stats);
        this.residency = { resident: 0, residentBytes: 0, compressed: 0, reduced: 0, compressing: 0, compressionAvailable: this.materialMaps.compressionAvailable };
    }
    configure(settings: TextureResidencySettings): void {
        this.settings = settings;
    }
    beginFrame(): void {
        this.frame++;
        this.stats.uploads = 0;
        this.stats.pending = 0;
        this.materialMaps.beginFrame(this.settings, performance.now());
        this.handOverMaterialMaps();
        this.publishResidency();
    }
    resolve(texture: Texture): WebGLTexture | null {
        this.exactTextures.add(texture.id);
        this.materialMaps.release(texture);
        return this.resolveEntry(texture);
    }
    resolveMaterialMap(texture: Texture, neededSize: number, blockCompressible: boolean): WebGLTexture | null {
        if (!this.materialMaps.active || texture.dynamic || this.exactTextures.has(texture.id))
            return this.resolveEntry(texture);
        if (!texture.image) {
            this.stats.pending++;
            return null;
        }
        this.releaseEntry(texture.id);
        return this.materialMaps.resolve(texture, neededSize, blockCompressible);
    }
    release(texture: Texture): void {
        this.releaseEntry(texture.id);
        this.materialMaps.release(texture);
        this.exactTextures.delete(texture.id);
    }
    dispose(): void {
        for (const entry of this.entries.values())
            this.gl.deleteTexture(entry.handle);
        this.entries.clear();
        this.entryBytes = 0;
        this.materialMaps.releaseAll();
        this.gl.deleteTexture(this.white);
        this.gl.deleteTexture(this.flatNormal);
    }
    private resolveEntry(texture: Texture): WebGLTexture | null {
        const { image } = texture;
        if (!image) {
            this.stats.pending++;
            return null;
        }
        const entry = this.entries.get(texture.id);
        if (entry && entry.version === texture.version)
            return entry.handle;
        const handle = entry?.handle ?? this.gl.createTexture();
        if (!handle)
            return null;
        const reuse = entry !== undefined && entry.dynamic && texture.dynamic && entry.width === texture.width && entry.height === texture.height;
        if (reuse)
            this.update(handle, image);
        else
            this.upload(handle, texture, image);
        const bytes = residentBytes(texture);
        this.entryBytes += bytes - (entry?.bytes ?? 0);
        this.entries.set(texture.id, { handle, version: texture.version, width: texture.width, height: texture.height, dynamic: texture.dynamic, bytes });
        this.stats.uploads++;
        return handle;
    }
    private upload(handle: WebGLTexture, texture: Texture, image: TextureImage): void {
        const { gl } = this;
        if (texture.dynamic) {
            gl.bindTexture(gl.TEXTURE_2D, handle);
            applyImageUnpackState(gl);
            gl.texImage2D(gl.TEXTURE_2D, 0, imageInternalFormat(gl, texture.colorSpace), gl.RGBA, gl.UNSIGNED_BYTE, image);
        }
        else {
            uploadImageMipChain(gl, handle, { image, colorSpace: texture.colorSpace, width: texture.width, height: texture.height }, 0);
        }
        this.sampling.applyToBound(texture);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }
    private update(handle: WebGLTexture, image: TextureImage): void {
        const { gl } = this;
        gl.bindTexture(gl.TEXTURE_2D, handle);
        applyImageUnpackState(gl);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }
    private releaseEntry(id: number): void {
        const entry = this.entries.get(id);
        if (!entry)
            return;
        this.gl.deleteTexture(entry.handle);
        this.entryBytes -= entry.bytes;
        this.entries.delete(id);
    }
    private handOverMaterialMaps(): void {
        const managing = this.materialMaps.active;
        if (managing === this.managingMaterialMaps)
            return;
        this.managingMaterialMaps = managing;
        if (!managing)
            return;
        for (const [id, entry] of this.entries) {
            if (!entry.dynamic && !this.exactTextures.has(id))
                this.releaseEntry(id);
        }
    }
    private publishResidency(): void {
        const { residency } = this;
        const maps = this.materialMaps.stats;
        residency.resident = this.entries.size + maps.resident;
        residency.residentBytes = this.entryBytes + maps.bytes;
        residency.compressed = maps.compressed;
        residency.reduced = maps.reduced;
        residency.compressing = maps.compressing;
    }
}
