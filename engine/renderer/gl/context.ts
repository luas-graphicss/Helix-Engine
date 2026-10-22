export type GL = WebGL2RenderingContext;
export class WebGLUnsupportedError extends Error {
    constructor() {
        super('WebGL2 não está disponível neste navegador.');
        this.name = 'WebGLUnsupportedError';
    }
}
export function createContext(canvas: HTMLCanvasElement): GL {
    const gl = canvas.getContext('webgl2', {
        antialias: false,
        alpha: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        powerPreference: 'high-performance',
    });
    if (!gl)
        throw new WebGLUnsupportedError();
    return gl;
}
export function syncCanvasSize(canvas: HTMLCanvasElement, maxPixelRatio = 2): boolean {
    const ratio = Math.min(window.devicePixelRatio || 1, maxPixelRatio);
    const width = Math.max(1, Math.floor(canvas.clientWidth * ratio));
    const height = Math.max(1, Math.floor(canvas.clientHeight * ratio));
    if (canvas.width === width && canvas.height === height)
        return false;
    canvas.width = width;
    canvas.height = height;
    return true;
}
