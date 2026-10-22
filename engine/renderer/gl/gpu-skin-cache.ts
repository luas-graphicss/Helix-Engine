import type { GL } from './context';
import type { Skin } from '@/engine/core/scene/skin';
export const JOINT_MATRICES_TEXTURE_UNIT = 8;
const TEXELS_PER_MATRIX = 4;
const STALE_FRAMES = 240;
interface CacheEntry {
    texture: WebGLTexture;
    version: number;
    jointCount: number;
    lastUsedFrame: number;
}
export class GpuSkinCache {
    private readonly entries = new Map<Skin, CacheEntry>();
    private frame = 0;
    constructor(private readonly gl: GL) { }
    resolve(skin: Skin): WebGLTexture {
        const { gl } = this;
        let entry = this.entries.get(skin);
        if (entry && entry.jointCount !== skin.joints.length) {
            gl.deleteTexture(entry.texture);
            this.entries.delete(skin);
            entry = undefined;
        }
        if (!entry) {
            const texture = gl.createTexture();
            if (!texture)
                throw new Error('Não foi possível alocar a textura de matrizes de junta.');
            gl.activeTexture(gl.TEXTURE0 + JOINT_MATRICES_TEXTURE_UNIT);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, TEXELS_PER_MATRIX, skin.joints.length);
            entry = { texture, version: -1, jointCount: skin.joints.length, lastUsedFrame: this.frame };
            this.entries.set(skin, entry);
        }
        entry.lastUsedFrame = this.frame;
        if (entry.version !== skin.version) {
            gl.activeTexture(gl.TEXTURE0 + JOINT_MATRICES_TEXTURE_UNIT);
            gl.bindTexture(gl.TEXTURE_2D, entry.texture);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, TEXELS_PER_MATRIX, entry.jointCount, gl.RGBA, gl.FLOAT, skin.jointMatrices);
            entry.version = skin.version;
        }
        return entry.texture;
    }
    endFrame(): void {
        this.frame++;
        if (this.frame % STALE_FRAMES !== 0)
            return;
        for (const [skin, entry] of this.entries) {
            if (this.frame - entry.lastUsedFrame > STALE_FRAMES) {
                this.gl.deleteTexture(entry.texture);
                this.entries.delete(skin);
            }
        }
    }
    dispose(): void {
        for (const entry of this.entries.values())
            this.gl.deleteTexture(entry.texture);
        this.entries.clear();
    }
}
