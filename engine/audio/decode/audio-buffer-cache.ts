const DEFAULT_LIMIT_BYTES = 256 * 1024 * 1024;
function bufferBytes(buffer: AudioBuffer): number {
    return buffer.length * buffer.numberOfChannels * Float32Array.BYTES_PER_ELEMENT;
}
export class AudioBufferCache {
    private readonly entries = new Map<string, Promise<AudioBuffer>>();
    private readonly sizes = new Map<string, number>();
    private totalBytes = 0;
    constructor(private readonly limitBytes = DEFAULT_LIMIT_BYTES) { }
    get(key: string, load: () => Promise<AudioBuffer>): Promise<AudioBuffer> {
        const cached = this.entries.get(key);
        if (cached) {
            this.entries.delete(key);
            this.entries.set(key, cached);
            return cached;
        }
        const pending = load().then((buffer) => {
            if (this.entries.get(key) === pending) {
                this.sizes.set(key, bufferBytes(buffer));
                this.totalBytes += bufferBytes(buffer);
                this.evict();
            }
            return buffer;
        });
        this.entries.set(key, pending);
        pending.catch(() => this.delete(key));
        return pending;
    }
    peek(key: string): Promise<AudioBuffer> | null {
        return this.entries.get(key) ?? null;
    }
    delete(key: string): void {
        if (!this.entries.delete(key))
            return;
        this.totalBytes -= this.sizes.get(key) ?? 0;
        this.sizes.delete(key);
    }
    clear(): void {
        this.entries.clear();
        this.sizes.clear();
        this.totalBytes = 0;
    }
    private evict(): void {
        for (const key of this.entries.keys()) {
            if (this.totalBytes <= this.limitBytes || this.entries.size <= 1)
                return;
            this.delete(key);
        }
    }
}
