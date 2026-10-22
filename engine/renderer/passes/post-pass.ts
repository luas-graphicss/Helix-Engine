import type { GL } from '@/engine/renderer/gl/context';
import { ColorRenderTarget } from '@/engine/renderer/gl/color-render-target';
import type { FullscreenTriangle } from '@/engine/renderer/gl/fullscreen-triangle';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { withDefines } from '@/engine/renderer/gl/shader-source';
import { FULLSCREEN_VERTEX_SHADER } from '@/engine/renderer/shaders/chunks/fullscreen.glsl';
import { BLIT_FRAGMENT_SHADER, SMAA_BLEND_FRAGMENT_SHADER, SMAA_EDGES_FRAGMENT_SHADER, SMAA_WEIGHTS_FRAGMENT_SHADER } from '@/engine/renderer/shaders/smaa.glsl';
import type { RenderProfile } from '@/engine/renderer/quality/render-profile';
const COLOR_UNIT = 0;
const EDGES_UNIT = 1;
const AREA_UNIT = 2;
const SEARCH_UNIT = 3;
const AREA_TEXTURE_URL = '/smaa/area.png';
const SEARCH_TEXTURE_URL = '/smaa/search.png';
const SEARCH_STEPS: Record<RenderProfile['tier'], number> = { low: 8, mid: 16, high: 16 };
export class PostPass {
    readonly stats = { drawCalls: 0 };
    private readonly edgesProgram: ShaderProgram;
    private readonly weightsProgram: ShaderProgram;
    private readonly blendProgram: ShaderProgram;
    private readonly blitProgram: ShaderProgram;
    private readonly edges: ColorRenderTarget;
    private readonly weights: ColorRenderTarget;
    private readonly area: WebGLTexture;
    private readonly search: WebGLTexture;
    private lookupsReady = 0;
    private disposed = false;
    constructor(private readonly gl: GL, private readonly triangle: FullscreenTriangle, profile: RenderProfile) {
        const steps = SEARCH_STEPS[profile.tier];
        this.edgesProgram = new ShaderProgram(gl, FULLSCREEN_VERTEX_SHADER, SMAA_EDGES_FRAGMENT_SHADER);
        this.weightsProgram = new ShaderProgram(gl, FULLSCREEN_VERTEX_SHADER, withDefines(SMAA_WEIGHTS_FRAGMENT_SHADER, { SMAA_MAX_SEARCH_STEPS: steps }));
        this.blendProgram = new ShaderProgram(gl, FULLSCREEN_VERTEX_SHADER, SMAA_BLEND_FRAGMENT_SHADER);
        this.blitProgram = new ShaderProgram(gl, FULLSCREEN_VERTEX_SHADER, BLIT_FRAGMENT_SHADER);
        this.edges = new ColorRenderTarget(gl, { width: 1, height: 1, format: 'rgba8', filter: 'linear' });
        this.weights = new ColorRenderTarget(gl, { width: 1, height: 1, format: 'rgba8', filter: 'linear' });
        this.area = this.createLookup(gl.LINEAR);
        this.search = this.createLookup(gl.NEAREST);
        this.loadLookup(AREA_TEXTURE_URL, this.area, gl.RGBA8, gl.RGBA);
        this.loadLookup(SEARCH_TEXTURE_URL, this.search, gl.R8, gl.RED);
    }
    get antialiasing(): boolean {
        return this.lookupsReady === 2;
    }
    render(sceneColor: WebGLTexture, width: number, height: number): void {
        const { gl, triangle } = this;
        this.stats.drawCalls = 0;
        gl.disable(gl.DEPTH_TEST);
        gl.depthMask(false);
        if (!this.antialiasing) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, width, height);
            this.blitProgram.use();
            this.bindColor(sceneColor, this.blitProgram);
            triangle.draw();
            this.stats.drawCalls = 1;
        }
        else {
            this.edges.resize(width, height);
            this.weights.resize(width, height);
            const texelX = 1 / width;
            const texelY = 1 / height;
            this.edges.bind();
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            this.edgesProgram.use();
            this.bindColor(sceneColor, this.edgesProgram);
            gl.uniform2f(this.edgesProgram.uniform('u_texel'), texelX, texelY);
            triangle.draw();
            this.weights.bind();
            gl.clear(gl.COLOR_BUFFER_BIT);
            this.weightsProgram.use();
            gl.activeTexture(gl.TEXTURE0 + EDGES_UNIT);
            gl.bindTexture(gl.TEXTURE_2D, this.edges.texture);
            gl.uniform1i(this.weightsProgram.uniform('u_edges'), EDGES_UNIT);
            gl.activeTexture(gl.TEXTURE0 + AREA_UNIT);
            gl.bindTexture(gl.TEXTURE_2D, this.area);
            gl.uniform1i(this.weightsProgram.uniform('u_area'), AREA_UNIT);
            gl.activeTexture(gl.TEXTURE0 + SEARCH_UNIT);
            gl.bindTexture(gl.TEXTURE_2D, this.search);
            gl.uniform1i(this.weightsProgram.uniform('u_search'), SEARCH_UNIT);
            gl.uniform2f(this.weightsProgram.uniform('u_texel'), texelX, texelY);
            triangle.draw();
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, width, height);
            this.blendProgram.use();
            this.bindColor(sceneColor, this.blendProgram);
            gl.activeTexture(gl.TEXTURE0 + EDGES_UNIT);
            gl.bindTexture(gl.TEXTURE_2D, this.weights.texture);
            gl.uniform1i(this.blendProgram.uniform('u_weights'), EDGES_UNIT);
            gl.uniform2f(this.blendProgram.uniform('u_texel'), texelX, texelY);
            triangle.draw();
            this.stats.drawCalls = 3;
        }
        gl.activeTexture(gl.TEXTURE0 + COLOR_UNIT);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.depthMask(true);
        gl.enable(gl.DEPTH_TEST);
    }
    private bindColor(texture: WebGLTexture, program: ShaderProgram): void {
        const { gl } = this;
        gl.activeTexture(gl.TEXTURE0 + COLOR_UNIT);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(program.uniform('u_color'), COLOR_UNIT);
    }
    private createLookup(filter: number): WebGLTexture {
        const { gl } = this;
        const texture = gl.createTexture();
        if (!texture)
            throw new Error('Não foi possível criar a textura de consulta do SMAA.');
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return texture;
    }
    private loadLookup(url: string, texture: WebGLTexture, internalFormat: number, format: number): void {
        if (typeof Image === 'undefined')
            return;
        const image = new Image();
        image.onload = () => {
            if (this.disposed)
                return;
            const { gl } = this;
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
            gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
            gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, format, gl.UNSIGNED_BYTE, image);
            gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.BROWSER_DEFAULT_WEBGL);
            gl.bindTexture(gl.TEXTURE_2D, null);
            this.lookupsReady++;
        };
        image.onerror = () => {
            console.warn(`[Helix] Textura do SMAA indisponível (${url}); a composição segue sem antialiasing.`);
        };
        image.src = url;
    }
    dispose(): void {
        this.disposed = true;
        const { gl } = this;
        this.edgesProgram.dispose();
        this.weightsProgram.dispose();
        this.blendProgram.dispose();
        this.blitProgram.dispose();
        this.edges.dispose();
        this.weights.dispose();
        gl.deleteTexture(this.area);
        gl.deleteTexture(this.search);
    }
}
