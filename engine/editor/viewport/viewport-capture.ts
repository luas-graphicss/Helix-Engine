import { captureFrameThumbnail } from '@/engine/project/scene-document/texture-baking';
import type { Renderer } from '@/engine/renderer/renderer';
const THUMBNAIL_WIDTH = 480;
const CAPTURE_TIMEOUT_MS = 2000;
type Waiter = (blob: Blob | null) => void;
export class ViewportCapture {
    private waiters: Waiter[] = [];
    private timeout: ReturnType<typeof setTimeout> | null = null;
    get pending(): boolean {
        return this.waiters.length > 0;
    }
    request(canvas: HTMLCanvasElement | null): Promise<Blob | null> {
        if (!canvas)
            return Promise.resolve(null);
        return new Promise((resolve) => {
            this.waiters.push(resolve);
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
        const waiters = this.take();
        void captureFrameThumbnail(renderer.gl, frame, THUMBNAIL_WIDTH)
            .catch(() => null)
            .then((blob) => {
            for (const waiter of waiters)
                waiter(blob);
        });
    }
    private settle(blob: Blob | null): void {
        for (const waiter of this.take())
            waiter(blob);
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
