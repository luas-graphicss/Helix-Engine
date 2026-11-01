type Listener = () => void;
export type GuiImageSource = ImageBitmap | HTMLImageElement;
export class GuiImageCache {
    private readonly images = new Map<string, GuiImageSource>();
    private readonly pending = new Map<string, Promise<void>>();
    private readonly failed = new Set<string>();
    private readonly listeners = new Set<Listener>();
    loadFile: ((assetId: string) => Promise<File | null>) | null = null;
    subscribe = (listener: Listener): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };
    private notify(): void {
        for (const listener of this.listeners)
            listener();
    }
    get(assetId: string): GuiImageSource | null {
        const image = this.images.get(assetId);
        if (image)
            return image;
        if (!this.failed.has(assetId))
            void this.ensure(assetId);
        return null;
    }
    hasFailed(assetId: string): boolean {
        return this.failed.has(assetId);
    }
    ensure(assetId: string): Promise<void> {
        if (this.images.has(assetId) || this.failed.has(assetId))
            return Promise.resolve();
        let pending = this.pending.get(assetId);
        if (!pending) {
            pending = this.load(assetId).finally(() => this.pending.delete(assetId));
            this.pending.set(assetId, pending);
        }
        return pending;
    }
    invalidate(assetId: string): void {
        const image = this.images.get(assetId);
        if (image && 'close' in image)
            image.close();
        this.images.delete(assetId);
        this.failed.delete(assetId);
        this.notify();
    }
    private async load(assetId: string): Promise<void> {
        try {
            const file = await this.loadFile?.(assetId);
            if (!file)
                throw new Error('imagem ausente');
            const bitmap = await createImageBitmap(file);
            this.images.set(assetId, bitmap);
        }
        catch {
            this.failed.add(assetId);
        }
        this.notify();
    }
}
export const guiImages = new GuiImageCache();
