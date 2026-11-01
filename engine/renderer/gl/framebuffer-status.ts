import type { GL } from './context';
const verified = new WeakMap<GL, Set<string>>();
export function framebufferStatus(gl: GL, signature: string): number {
    let seen = verified.get(gl);
    if (!seen) {
        seen = new Set();
        verified.set(gl, seen);
    }
    if (seen.has(signature))
        return gl.FRAMEBUFFER_COMPLETE;
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status === gl.FRAMEBUFFER_COMPLETE)
        seen.add(signature);
    return status;
}
