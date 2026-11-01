import type { BloomSettings } from '@/engine/core/environment/post-process-settings';
import type { GL } from '@/engine/renderer/gl/context';
import { ColorRenderTarget, type ColorFormat } from '@/engine/renderer/gl/color-render-target';
import type { FullscreenTriangle } from '@/engine/renderer/gl/fullscreen-triangle';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { withDefines, type ShaderDefines } from '@/engine/renderer/gl/shader-source';
import { FULLSCREEN_VERTEX_SHADER } from '@/engine/renderer/shaders/chunks/fullscreen.glsl';
import { BLOOM_DOWNSAMPLE_FRAGMENT_SHADER, BLOOM_PREFILTER_FRAGMENT_SHADER, BLOOM_UPSAMPLE_FRAGMENT_SHADER } from '@/engine/renderer/shaders/post/bloom.glsl';
const SOURCE_UNIT = 0;
const CURRENT_UNIT = 1;
const MIN_LEVEL_SIZE = 8;
export class BloomPass {
    readonly stats = { drawCalls: 0 };
    private readonly prefilterProgram: ShaderProgram;
    private readonly downsampleProgram: ShaderProgram;
    private readonly upsampleProgram: ShaderProgram;
    private readonly down: ColorRenderTarget[] = [];
    private readonly up: ColorRenderTarget[] = [];
    private readonly prefilterTapScale: number;
    private width = 0;
    private height = 0;
    private levels = 0;
    levelsDrop = 0;
    constructor(private readonly gl: GL, private readonly triangle: FullscreenTriangle, private readonly format: ColorFormat, private readonly maxLevels: number, private readonly startScale: number, defines: ShaderDefines) {
        this.prefilterTapScale = 0.5 / startScale;
        this.prefilterProgram = new ShaderProgram(gl, FULLSCREEN_VERTEX_SHADER, withDefines(BLOOM_PREFILTER_FRAGMENT_SHADER, defines));
        this.downsampleProgram = new ShaderProgram(gl, FULLSCREEN_VERTEX_SHADER, withDefines(BLOOM_DOWNSAMPLE_FRAGMENT_SHADER, defines));
        this.upsampleProgram = new ShaderProgram(gl, FULLSCREEN_VERTEX_SHADER, withDefines(BLOOM_UPSAMPLE_FRAGMENT_SHADER, defines));
    }
    render(sceneColor: WebGLTexture, width: number, height: number, settings: BloomSettings): WebGLTexture {
        const { gl, triangle } = this;
        this.ensureTargets(width, height);
        const { down, up } = this;
        const levels = Math.max(Math.min(2, this.levels), this.levels - Math.max(0, Math.floor(this.levelsDrop)));
        this.stats.drawCalls = 0;
        const first = down[0];
        first.bind();
        this.prefilterProgram.use();
        this.bindSource(this.prefilterProgram, sceneColor, this.prefilterTapScale / width, this.prefilterTapScale / height, first);
        const knee = settings.threshold * settings.softKnee + 1e-5;
        gl.uniform1f(this.prefilterProgram.uniform('u_threshold'), settings.threshold);
        gl.uniform1f(this.prefilterProgram.uniform('u_knee'), knee);
        triangle.draw();
        this.stats.drawCalls++;
        this.downsampleProgram.use();
        for (let i = 1; i < levels; i++) {
            const source = down[i - 1];
            const target = down[i];
            target.bind();
            this.bindSource(this.downsampleProgram, source.texture, 1 / source.width, 1 / source.height, target);
            triangle.draw();
            this.stats.drawCalls++;
        }
        if (levels < 2)
            return first.texture;
        this.upsampleProgram.use();
        const scatter = 0.3 + 0.65 * Math.min(1, Math.max(0, settings.radius));
        gl.uniform1f(this.upsampleProgram.uniform('u_scatter'), scatter);
        gl.uniform1i(this.upsampleProgram.uniform('u_current'), CURRENT_UNIT);
        for (let i = levels - 2; i >= 0; i--) {
            const lower = i === levels - 2 ? down[i + 1] : up[i + 1];
            const target = up[i];
            target.bind();
            this.bindSource(this.upsampleProgram, lower.texture, 1 / lower.width, 1 / lower.height, target);
            gl.activeTexture(gl.TEXTURE0 + CURRENT_UNIT);
            gl.bindTexture(gl.TEXTURE_2D, down[i].texture);
            triangle.draw();
            this.stats.drawCalls++;
        }
        gl.activeTexture(gl.TEXTURE0 + CURRENT_UNIT);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return up[0].texture;
    }
    private bindSource(program: ShaderProgram, texture: WebGLTexture, texelX: number, texelY: number, target: ColorRenderTarget): void {
        const { gl } = this;
        gl.activeTexture(gl.TEXTURE0 + SOURCE_UNIT);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(program.uniform('u_source'), SOURCE_UNIT);
        gl.uniform2f(program.uniform('u_sourceTexel'), texelX, texelY);
        gl.uniform2f(program.uniform('u_targetTexel'), 1 / target.width, 1 / target.height);
    }
    private ensureTargets(width: number, height: number): void {
        if (width === this.width && height === this.height)
            return;
        this.width = width;
        this.height = height;
        let halfWidth = Math.max(1, Math.floor(width * this.startScale));
        let halfHeight = Math.max(1, Math.floor(height * this.startScale));
        const levels = Math.max(1, Math.min(this.maxLevels, Math.floor(Math.log2(Math.min(halfWidth, halfHeight) / MIN_LEVEL_SIZE)) + 1));
        this.levels = levels;
        for (const target of this.down)
            target.dispose();
        for (const target of this.up)
            target.dispose();
        this.down.length = 0;
        this.up.length = 0;
        for (let i = 0; i < levels; i++) {
            this.down.push(new ColorRenderTarget(this.gl, { width: halfWidth, height: halfHeight, format: this.format, filter: 'linear' }));
            if (i < levels - 1)
                this.up.push(new ColorRenderTarget(this.gl, { width: halfWidth, height: halfHeight, format: this.format, filter: 'linear' }));
            halfWidth = Math.max(1, Math.floor(halfWidth / 2));
            halfHeight = Math.max(1, Math.floor(halfHeight / 2));
        }
    }
    dispose(): void {
        this.prefilterProgram.dispose();
        this.downsampleProgram.dispose();
        this.upsampleProgram.dispose();
        for (const target of this.down)
            target.dispose();
        for (const target of this.up)
            target.dispose();
        this.down.length = 0;
        this.up.length = 0;
    }
}
