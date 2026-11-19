import type { PixelLevel } from '@/engine/renderer/textures/mips/pixel-level';
import type { CompressedMipChain } from './compressed-mip-chain';
import type { TextureCompressionRequest, TextureCompressionResponse } from './texture-compression.worker';
export type CompressionListener = (chain: CompressedMipChain | null) => void;
function createWorker(): Worker | null {
    if (typeof Worker === 'undefined')
        return null;
    try {
        return new Worker(new URL('./texture-compression.worker.ts', import.meta.url), { type: 'module', name: 'helix-texture-compression' });
    }
    catch {
        return null;
    }
}
export class TextureCompressor {
    private worker: Worker | null;
    private readonly listeners = new Map<number, CompressionListener>();
    private nextJobId = 1;
    constructor() {
        this.worker = createWorker();
        if (!this.worker)
            return;
        this.worker.onmessage = (event: MessageEvent<TextureCompressionResponse>) => this.finish(event.data.jobId, event.data.chain);
        this.worker.onerror = () => this.abandonWorker();
    }
    get inFlight(): number {
        return this.listeners.size;
    }
    compress(base: PixelLevel, srgb: boolean, listener: CompressionListener): number {
        const jobId = this.nextJobId++;
        if (!this.worker) {
            listener(null);
            return jobId;
        }
        this.listeners.set(jobId, listener);
        const request: TextureCompressionRequest = { jobId, base, srgb };
        this.worker.postMessage(request, [base.pixels.buffer]);
        return jobId;
    }
    cancel(jobId: number): void {
        this.listeners.delete(jobId);
    }
    dispose(): void {
        this.worker?.terminate();
        this.worker = null;
        this.listeners.clear();
    }
    private finish(jobId: number, chain: CompressedMipChain): void {
        const listener = this.listeners.get(jobId);
        if (!listener)
            return;
        this.listeners.delete(jobId);
        listener(chain);
    }
    private abandonWorker(): void {
        this.worker?.terminate();
        this.worker = null;
        const abandoned = [...this.listeners.values()];
        this.listeners.clear();
        for (const listener of abandoned)
            listener(null);
    }
}
