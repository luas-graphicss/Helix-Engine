import { captureFrameThumbnail } from '@/engine/project/scene-document/texture-baking';
import type { Renderer } from '@/engine/renderer/renderer';
const THUMBNAIL_WIDTH = 480;
const CAPTURE_TIMEOUT_MS = 2000;
interface Waiter {
    readonly width: number;
    readonly resolve: (blob: Blob | null) => void;
}
export class ViewportCapture {
    private waiters: Waiter[] = [];
    private timeout: ReturnType<typeof setTimeout> | null = null;
    get pending(): boolean {
        return this.waiters.length > 0;
    }
    request(canvas: HTMLCanvasElement | null, width = THUMBNAIL_WIDTH): Promise<Blob | null> {
        if (!canvas)
            return Promise.resolve(null);
        return new Promise((resolve) => {
            this.waiters.push({ width, resolve });
            if (!this.timeout)
                this.timeout = setTimeout(() => this.settle(null), CAPTURE_TIMEOUT_MS);
        });
    }
    fulfill(renderer: Renderer): void {
        if (!this.pending)
            return;
        const frame = renderer.capturedFrame;
        if (!frame)
            return;
        const captures = new Map<number, Promise<Blob | null>>();
        for (const waiter of this.take()) {
            const capture = captures.get(waiter.width) ?? captureFrameThumbnail(renderer.gl, frame, waiter.width).catch(() => null);
            captures.set(waiter.width, capture);
            void capture.then(waiter.resolve);
        }
    }
    private settle(blob: Blob | null): void {
        for (const waiter of this.take())
            waiter.resolve(blob);
    }
    private take(): Waiter[] {
        if (this.timeout)
            clearTimeout(this.timeout);
        this.timeout = null;
        const waiters = this.waiters;
        this.waiters = [];
        return waiters;
    }
}
