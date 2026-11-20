import { DeviceRegistry } from '@/engine/input/devices/device-registry';
import { BrowserInputSources } from '@/engine/input/devices/sources/browser-input-sources';
export type FrameListener = (delta: number) => void;
const MILLISECONDS_PER_SECOND = 1000;
export class LiveDevices {
    readonly registry = new DeviceRegistry();
    frame = 0;
    private readonly sources = new BrowserInputSources(this.registry);
    private readonly listeners = new Set<FrameListener>();
    private request = 0;
    private previous = 0;
    attach(): void {
        this.sources.attach({ surface: null, acceptsKeyboard: () => true });
    }
    detach(): void {
        this.sources.detach();
        cancelAnimationFrame(this.request);
    }
    onFrame(listener: FrameListener): () => void {
        this.listeners.add(listener);
        if (this.listeners.size === 1) {
            this.previous = performance.now();
            this.request = requestAnimationFrame(this.tick);
        }
        return () => {
            this.listeners.delete(listener);
            if (this.listeners.size === 0)
                cancelAnimationFrame(this.request);
        };
    }
    private readonly tick = (now: number): void => {
        const delta = (now - this.previous) / MILLISECONDS_PER_SECOND;
        this.previous = now;
        this.frame++;
        this.sources.poll();
        for (const listener of Array.from(this.listeners))
            listener(delta);
        this.sources.endFrame();
        if (this.listeners.size > 0)
            this.request = requestAnimationFrame(this.tick);
    };
}
