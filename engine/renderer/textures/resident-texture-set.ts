import type { Texture } from '@/engine/core/scene/texture';
import type { GL } from '@/engine/renderer/gl/context';
import { detectBlockCompression, type BlockCompressionSupport, type BlockInternalFormats } from './compression/block-compression-support';
import { canBlockCompress, type CompressedMipChain } from './compression/compressed-mip-chain';
import { TextureCompressor } from './compression/texture-compressor';
import { mipChainBytes, rgbaLevelBytes } from './mips/mip-levels';
import { fitTopLevelsToBudget } from './streaming/mip-budget';
import { maxTopLevel, topLevelForSize } from './streaming/mip-demand';
import { uploadCompressedMipChain } from './upload/compressed-mip-upload';
import { uploadImageMipChain } from './upload/image-mip-upload';
import { readImagePixels } from './upload/texture-readback';
import type { TextureSampling } from './upload/texture-sampling';
const PLAN_INTERVAL_MS = 100;
const DROP_DELAY_MS = 2000;
const MAX_LEVEL_CHANGES_PER_PLAN = 8;
const MAX_FORMAT_CHANGES_PER_FRAME = 2;
const MAX_COMPRESSIONS_IN_FLIGHT = 2;
const BYTES_PER_MEGABYTE = 1024 * 1024;
export interface TextureResidencySettings {
    textureCompression: boolean;
    mipStreaming: boolean;
    textureBudgetMb: number;
}
export interface ResidentTextureStats {
    resident: number;
    bytes: number;
    compressed: number;
    reduced: number;
    compressing: number;
}
export interface UploadCounter {
    uploads: number;
}
type CompressionState = 'waiting' | 'running' | 'done' | 'unavailable';
interface ResidentTexture {
    readonly texture: Texture;
    readonly version: number;
    readonly width: number;
    readonly height: number;
    readonly maxTopLevel: number;
    readonly blockFormats: BlockInternalFormats | null;
    handle: WebGLTexture | null;
    topLevel: number;
    bytes: number;
    chain: CompressedMipChain | null;
    blocksOnGpu: boolean;
    compression: CompressionState;
    compressionJob: number;
    blockCompressible: boolean;
    neededSize: number;
    used: boolean;
    droppableSince: number | null;
}
interface LevelChange {
    resident: ResidentTexture;
    topLevel: number;
}
function byLargestUpgradeFirst(a: LevelChange, b: LevelChange): number {
    return a.topLevel - a.resident.topLevel - (b.topLevel - b.resident.topLevel);
}
export class ResidentTextureSet {
    readonly stats: ResidentTextureStats = { resident: 0, bytes: 0, compressed: 0, reduced: 0, compressing: 0 };
    readonly compressionAvailable: boolean;
    private readonly residents = new Map<number, ResidentTexture>();
    private readonly support: BlockCompressionSupport | null;
    private compressor: TextureCompressor | null = null;
    private settings: TextureResidencySettings = { textureCompression: false, mipStreaming: false, textureBudgetMb: 0 };
    private nextPlanAt = 0;
    private deferredLevelChanges = 0;
    private deferredFormatChanges = 0;
    constructor(private readonly gl: GL, private readonly sampling: TextureSampling, private readonly counter: UploadCounter) {
        this.support = detectBlockCompression(gl);
        this.compressionAvailable = this.support !== null && typeof Worker !== 'undefined';
    }
    get active(): boolean {
        return this.settings.mipStreaming || this.compressing;
    }
    private get compressing(): boolean {
        return this.settings.textureCompression && this.compressionAvailable;
    }
    beginFrame(settings: TextureResidencySettings, now: number): void {
        this.settings = settings;
        if (!this.active) {
            this.releaseAll();
            return;
        }
        this.dropStale();
        this.syncFormats();
        this.startCompression();
        if (now >= this.nextPlanAt) {
            this.nextPlanAt = now + PLAN_INTERVAL_MS;
            this.planLevels(now);
        }
        this.publishStats();
        this.counter.uploads += this.deferredLevelChanges + this.deferredFormatChanges + this.stats.compressing;
    }
    resolve(texture: Texture, neededSize: number, blockCompressible: boolean): WebGLTexture | null {
        let resident = this.residents.get(texture.id);
        if (resident && resident.version !== texture.version) {
            this.discard(resident);
            resident = undefined;
        }
        resident ??= this.admit(texture, neededSize);
        resident.used = true;
        if (neededSize > resident.neededSize)
            resident.neededSize = neededSize;
        if (!blockCompressible)
            resident.blockCompressible = false;
        return resident.handle;
    }
    release(texture: Texture): void {
        const resident = this.residents.get(texture.id);
        if (resident)
            this.discard(resident);
    }
    releaseAll(): void {
        for (const resident of this.residents.values())
            this.gl.deleteTexture(resident.handle);
        this.residents.clear();
        this.compressor?.dispose();
        this.compressor = null;
        this.deferredLevelChanges = 0;
        this.deferredFormatChanges = 0;
        this.publishStats();
    }
    private admit(texture: Texture, neededSize: number): ResidentTexture {
        const { width, height } = texture;
        const maxLevel = maxTopLevel(width, height);
        const blockFormats = this.support?.formats[texture.colorSpace] ?? null;
        const smoothFiltered = texture.magFilter === 'linear' && texture.minFilter === 'linear';
        const resident: ResidentTexture = {
            texture,
            version: texture.version,
            width,
            height,
            maxTopLevel: maxLevel,
            blockFormats,
            handle: null,
            topLevel: 0,
            bytes: 0,
            chain: null,
            blocksOnGpu: false,
            compression: blockFormats !== null && smoothFiltered && canBlockCompress(width, height) ? 'waiting' : 'unavailable',
            compressionJob: 0,
            blockCompressible: true,
            neededSize: 0,
            used: false,
            droppableSince: null,
        };
        this.residents.set(texture.id, resident);
        this.upload(resident, this.settings.mipStreaming ? topLevelForSize(Math.max(width, height), neededSize, maxLevel) : 0);
        return resident;
    }
    private discard(resident: ResidentTexture): void {
        this.compressor?.cancel(resident.compressionJob);
        this.gl.deleteTexture(resident.handle);
        this.residents.delete(resident.texture.id);
    }
    private dropStale(): void {
        for (const resident of this.residents.values()) {
            if (resident.texture.version !== resident.version || !resident.texture.image)
                this.discard(resident);
        }
    }
    private syncFormats(): void {
        const { compressing } = this;
        if (!compressing) {
            this.compressor?.dispose();
            this.compressor = null;
        }
        this.deferredFormatChanges = 0;
        let changes = 0;
        for (const resident of this.residents.values()) {
            if (!compressing || !resident.blockCompressible)
                this.forgetCompression(resident);
            if ((resident.chain !== null) === resident.blocksOnGpu)
                continue;
            if (changes === MAX_FORMAT_CHANGES_PER_FRAME) {
                this.deferredFormatChanges++;
                continue;
            }
            this.upload(resident, resident.topLevel);
            changes++;
        }
    }
    private forgetCompression(resident: ResidentTexture): void {
        if (resident.compression === 'unavailable' || resident.compression === 'waiting')
            return;
        this.compressor?.cancel(resident.compressionJob);
        resident.chain = null;
        resident.compression = 'waiting';
    }
    private startCompression(): void {
        if (!this.compressing)
            return;
        this.compressor ??= new TextureCompressor();
        if (this.compressor.inFlight >= MAX_COMPRESSIONS_IN_FLIGHT)
            return;
        for (const resident of this.residents.values()) {
            if (resident.compression !== 'waiting' || !resident.blockCompressible)
                continue;
            this.compress(resident, this.compressor);
            return;
        }
    }
    private compress(resident: ResidentTexture, compressor: TextureCompressor): void {
        const { texture, width, height } = resident;
        if (!texture.image)
            return;
        const pixels = readImagePixels(this.gl, texture.image, width, height);
        resident.compression = 'running';
        resident.compressionJob = compressor.compress({ pixels, width, height }, texture.colorSpace === 'srgb', (chain) => this.finishCompression(resident, chain));
    }
    private finishCompression(resident: ResidentTexture, chain: CompressedMipChain | null): void {
        if (this.residents.get(resident.texture.id) !== resident || resident.compression !== 'running')
            return;
        resident.chain = chain;
        resident.compression = chain ? 'done' : 'unavailable';
    }
    private planLevels(now: number): void {
        const residents = [...this.residents.values()];
        const wanted = residents.map((resident) => this.wantedTopLevel(resident, now));
        const levels = this.settings.mipStreaming ? this.fitToBudget(residents, wanted) : wanted;
        const changes: LevelChange[] = [];
        for (let index = 0; index < residents.length; index++) {
            if (levels[index] !== residents[index].topLevel)
                changes.push({ resident: residents[index], topLevel: levels[index] });
        }
        changes.sort(byLargestUpgradeFirst);
        const applied = Math.min(changes.length, MAX_LEVEL_CHANGES_PER_PLAN);
        for (let index = 0; index < applied; index++)
            this.upload(changes[index].resident, changes[index].topLevel);
        this.deferredLevelChanges = changes.length - applied;
    }
    private fitToBudget(residents: readonly ResidentTexture[], wanted: readonly number[]): number[] {
        const entries = residents.map((resident, index) => ({
            topLevel: wanted[index],
            maxTopLevel: resident.maxTopLevel,
            bytesAt: (topLevel: number) => this.bytesAt(resident, topLevel),
        }));
        return fitTopLevelsToBudget(entries, this.settings.textureBudgetMb * BYTES_PER_MEGABYTE);
    }
    private wantedTopLevel(resident: ResidentTexture, now: number): number {
        if (!this.settings.mipStreaming)
            return 0;
        const { used, neededSize } = resident;
        resident.used = false;
        resident.neededSize = 0;
        const wanted = used ? topLevelForSize(Math.max(resident.width, resident.height), neededSize, resident.maxTopLevel) : resident.maxTopLevel;
        if (wanted <= resident.topLevel) {
            resident.droppableSince = null;
            return wanted;
        }
        resident.droppableSince ??= now;
        return now - resident.droppableSince >= DROP_DELAY_MS ? wanted : resident.topLevel;
    }
    private bytesAt(resident: ResidentTexture, topLevel: number): number {
        const { chain } = resident;
        if (!chain)
            return mipChainBytes(resident.width, resident.height, topLevel, rgbaLevelBytes);
        let bytes = 0;
        for (let level = topLevel; level < chain.levels.length; level++)
            bytes += chain.levels[level].byteLength;
        return bytes;
    }
    private upload(resident: ResidentTexture, topLevel: number): void {
        const { gl } = this;
        const { texture, chain, blockFormats, width, height } = resident;
        const { image } = texture;
        if (!image)
            return;
        const handle = gl.createTexture();
        if (!handle)
            throw new Error(`Não foi possível alocar a textura "${texture.name}" na GPU.`);
        if (chain && blockFormats)
            uploadCompressedMipChain(gl, handle, { chain, internalFormat: blockFormats[chain.format] }, topLevel);
        else
            uploadImageMipChain(gl, handle, { image, colorSpace: texture.colorSpace, width, height }, topLevel);
        this.sampling.applyToBound(texture);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.deleteTexture(resident.handle);
        resident.handle = handle;
        resident.topLevel = topLevel;
        resident.blocksOnGpu = chain !== null && blockFormats !== null;
        resident.bytes = this.bytesAt(resident, topLevel);
        resident.droppableSince = null;
        this.counter.uploads++;
    }
    private publishStats(): void {
        const { stats, compressing } = this;
        stats.resident = this.residents.size;
        stats.bytes = 0;
        stats.compressed = 0;
        stats.reduced = 0;
        stats.compressing = 0;
        for (const resident of this.residents.values()) {
            stats.bytes += resident.bytes;
            if (resident.blocksOnGpu)
                stats.compressed++;
            if (resident.topLevel > 0)
                stats.reduced++;
            if (resident.compression === 'running' || (compressing && resident.blockCompressible && resident.compression === 'waiting'))
                stats.compressing++;
        }
    }
}
