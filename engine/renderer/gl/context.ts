export type GL = WebGL2RenderingContext;
export class WebGLUnsupportedError extends Error {
    constructor() {
        super('WebGL2 não está disponível neste navegador.');
        this.name = 'WebGLUnsupportedError';
    }
}
export class WebGLContextLostError extends Error {
    constructor() {
        super('O contexto gráfico foi perdido pelo navegador.');
        this.name = 'WebGLContextLostError';
    }
}
export interface ContextOptions {
    offscreen?: boolean;
}
export function createContext(canvas: HTMLCanvasElement, { offscreen = false }: ContextOptions = {}): GL {
    const gl = canvas.getContext('webgl2', {
        antialias: false,
        alpha: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        powerPreference: 'high-performance',
        desynchronized: false,
        preserveDrawingBuffer: offscreen,
    });
    if (!gl)
        throw new WebGLUnsupportedError();
    return gl;
}
export const MAX_PIXEL_RATIO = 2;
function drawingBufferSize(cssSize: number, ratio: number): number {
    return Math.max(1, Math.floor(cssSize * ratio));
}
export function syncCanvasSize(canvas: HTMLCanvasElement, maxPixelRatio = MAX_PIXEL_RATIO): boolean {
    const ratio = Math.min(window.devicePixelRatio || 1, maxPixelRatio);
    const width = drawingBufferSize(canvas.clientWidth, ratio);
    const height = drawingBufferSize(canvas.clientHeight, ratio);
    if (canvas.width === width && canvas.height === height)
        return false;
    canvas.width = width;
    canvas.height = height;
    return true;
}
export class CanvasSizeTracker {
    private cssWidth: number;
    private cssHeight: number;
    private readonly observer: ResizeObserver | null;
    private pendingResize = false;
    private lastRatio = 0;
    private fixedWidth = 0;
    private fixedHeight = 0;
    maxPixelRatio: number = MAX_PIXEL_RATIO;
    holdResize = false;
    constructor(private readonly canvas: HTMLCanvasElement) {
        this.cssWidth = canvas.clientWidth;
        this.cssHeight = canvas.clientHeight;
        if (typeof ResizeObserver === 'undefined') {
            this.observer = null;
            return;
        }
        this.observer = new ResizeObserver((entries) => {
            const entry = entries[entries.length - 1];
            if (!entry)
                return;
            const box = entry.contentBoxSize?.[0];
            this.cssWidth = box ? box.inlineSize : entry.contentRect.width;
            this.cssHeight = box ? box.blockSize : entry.contentRect.height;
            this.pendingResize = true;
        });
        this.observer.observe(canvas);
    }
    get resized(): boolean {
        if (this.fixedWidth > 0)
            return this.pendingResize;
        if (this.holdResize)
            return false;
        return this.pendingResize || Math.min(window.devicePixelRatio || 1, this.maxPixelRatio) !== this.lastRatio;
    }
    get pixelRatio(): number {
        if (this.fixedWidth > 0)
            return 1;
        const cssWidth = this.observer ? this.cssWidth : this.canvas.clientWidth;
        return cssWidth > 0 ? this.canvas.width / cssWidth : 1;
    }
    setFixedSize(width: number, height: number): void {
        const nextWidth = Math.max(1, Math.floor(width));
        const nextHeight = Math.max(1, Math.floor(height));
        if (nextWidth === this.fixedWidth && nextHeight === this.fixedHeight)
            return;
        this.fixedWidth = nextWidth;
        this.fixedHeight = nextHeight;
        this.pendingResize = true;
    }
    sync(maxPixelRatio = this.maxPixelRatio): boolean {
        const { canvas } = this;
        if (this.holdResize && this.fixedWidth === 0)
            return false;
        this.pendingResize = false;
        if (this.fixedWidth > 0) {
            if (canvas.width === this.fixedWidth && canvas.height === this.fixedHeight)
                return false;
            canvas.width = this.fixedWidth;
            canvas.height = this.fixedHeight;
            return true;
        }
        const ratio = Math.min(window.devicePixelRatio || 1, maxPixelRatio);
        this.lastRatio = ratio;
        if (!this.observer)
            return syncCanvasSize(canvas, maxPixelRatio);
        const width = drawingBufferSize(this.cssWidth, ratio);
        const height = drawingBufferSize(this.cssHeight, ratio);
        if (canvas.width === width && canvas.height === height)
            return false;
        canvas.width = width;
        canvas.height = height;
        return true;
    }
    dispose(): void {
        this.observer?.disconnect();
    }
}
