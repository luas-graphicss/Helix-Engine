import type { GL } from '@/engine/renderer/gl/context';
import { framebufferStatus } from '@/engine/renderer/gl/framebuffer-status';
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
const EDGE_STENCIL_REF = 1;
class SmaaTarget {
    framebuffer!: WebGLFramebuffer;
    texture!: WebGLTexture;
    width = 0;
    height = 0;
    constructor(private readonly gl: GL, private readonly internalFormat: number) {
        this.allocate(1, 1, null);
    }
    resize(width: number, height: number, stencil: WebGLRenderbuffer | null): boolean {
        if (width === this.width && height === this.height)
            return false;
        this.dispose();
        this.allocate(width, height, stencil);
        return true;
    }
    bind(): void {
        const { gl } = this;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        gl.viewport(0, 0, this.width, this.height);
    }
    dispose(): void {
        this.gl.deleteFramebuffer(this.framebuffer);
        this.gl.deleteTexture(this.texture);
    }
    private allocate(width: number, height: number, stencil: WebGLRenderbuffer | null): void {
        const { gl } = this;
        const texture = gl.createTexture();
        const framebuffer = gl.createFramebuffer();
        if (!texture || !framebuffer)
            throw new Error('Não foi possível alocar o alvo do SMAA.');
        this.width = Math.max(1, Math.floor(width));
        this.height = Math.max(1, Math.floor(height));
        this.texture = texture;
        this.framebuffer = framebuffer;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, this.internalFormat, this.width, this.height);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        if (stencil)
            gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, stencil);
        const status = framebufferStatus(gl, `smaa:${this.internalFormat}:${stencil ? 'stencil' : 'color'}`);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
            this.dispose();
            throw new Error(`Alvo do SMAA incompleto (0x${status.toString(16)}).`);
        }
    }
}
export class SmaaPass {
    readonly stats = { drawCalls: 0 };
    private readonly edgesProgram: ShaderProgram;
    private readonly weightsProgram: ShaderProgram;
    private readonly blendProgram: ShaderProgram;
    private readonly blitProgram: ShaderProgram;
    private readonly edges: SmaaTarget;
    private readonly weights: SmaaTarget;
    private readonly area: WebGLTexture;
    private readonly search: WebGLTexture;
    private readonly useStencil: boolean;
    private stencil: WebGLRenderbuffer | null = null;
    private stencilWidth = 0;
    private stencilHeight = 0;
    private lookupsReady = 0;
    private lookupsPending = 2;
    private disposed = false;
    constructor(private readonly gl: GL, private readonly triangle: FullscreenTriangle, profile: RenderProfile) {
        const steps = SEARCH_STEPS[profile.tier];
        this.useStencil = profile.smaaStencil;
        this.edgesProgram = new ShaderProgram(gl, FULLSCREEN_VERTEX_SHADER, SMAA_EDGES_FRAGMENT_SHADER);
        this.weightsProgram = new ShaderProgram(gl, FULLSCREEN_VERTEX_SHADER, withDefines(SMAA_WEIGHTS_FRAGMENT_SHADER, { SMAA_MAX_SEARCH_STEPS: steps }));
        this.blendProgram = new ShaderProgram(gl, FULLSCREEN_VERTEX_SHADER, SMAA_BLEND_FRAGMENT_SHADER);
        this.blitProgram = new ShaderProgram(gl, FULLSCREEN_VERTEX_SHADER, BLIT_FRAGMENT_SHADER);
        this.edges = new SmaaTarget(gl, gl.RG8);
        this.weights = new SmaaTarget(gl, gl.RGBA8);
        this.area = this.createLookup(gl.LINEAR);
        this.search = this.createLookup(gl.NEAREST);
        this.loadLookup(AREA_TEXTURE_URL, this.area, gl.RGBA8, gl.RGBA);
        this.loadLookup(SEARCH_TEXTURE_URL, this.search, gl.R8, gl.RED);
    }
    get antialiasing(): boolean {
        return this.lookupsReady === 2;
    }
    get loading(): boolean {
        return this.lookupsPending > 0;
    }
    bypass = false;
    render(color: WebGLTexture, width: number, height: number, target: WebGLFramebuffer | null): void {
        const { gl, triangle } = this;
        this.stats.drawCalls = 0;
        if (!this.antialiasing || this.bypass) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, target);
            gl.viewport(0, 0, width, height);
            this.blitProgram.use();
            this.bindColor(color, this.blitProgram);
            triangle.draw();
            this.stats.drawCalls = 1;
        }
        else {
            this.ensureTargets(width, height);
            const texelX = 1 / width;
            const texelY = 1 / height;
            const stencil = this.useStencil;
            this.edges.bind();
            gl.clearColor(0, 0, 0, 0);
            if (stencil) {
                gl.stencilMask(0xff);
                gl.clearStencil(0);
                gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
                gl.enable(gl.STENCIL_TEST);
                gl.stencilFunc(gl.ALWAYS, EDGE_STENCIL_REF, 0xff);
                gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
            }
            else {
                gl.clear(gl.COLOR_BUFFER_BIT);
            }
            this.edgesProgram.use();
            this.bindColor(color, this.edgesProgram);
            gl.uniform2f(this.edgesProgram.uniform('u_texel'), texelX, texelY);
            triangle.draw();
            this.weights.bind();
            gl.clear(gl.COLOR_BUFFER_BIT);
            if (stencil) {
                gl.stencilFunc(gl.EQUAL, EDGE_STENCIL_REF, 0xff);
                gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
                gl.stencilMask(0);
            }
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
            if (stencil) {
                gl.disable(gl.STENCIL_TEST);
                gl.stencilMask(0xff);
            }
            gl.bindFramebuffer(gl.FRAMEBUFFER, target);
            gl.viewport(0, 0, width, height);
            this.blendProgram.use();
            this.bindColor(color, this.blendProgram);
            gl.activeTexture(gl.TEXTURE0 + EDGES_UNIT);
            gl.bindTexture(gl.TEXTURE_2D, this.weights.texture);
            gl.uniform1i(this.blendProgram.uniform('u_weights'), EDGES_UNIT);
            gl.uniform2f(this.blendProgram.uniform('u_texel'), texelX, texelY);
            triangle.draw();
            this.stats.drawCalls = 3;
        }
        gl.activeTexture(gl.TEXTURE0 + COLOR_UNIT);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }
    private ensureTargets(width: number, height: number): void {
        const { gl } = this;
        if (this.useStencil && (width !== this.stencilWidth || height !== this.stencilHeight)) {
            if (this.stencil)
                gl.deleteRenderbuffer(this.stencil);
            const stencil = gl.createRenderbuffer();
            if (!stencil)
                throw new Error('Não foi possível alocar o stencil do SMAA.');
            gl.bindRenderbuffer(gl.RENDERBUFFER, stencil);
            gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH24_STENCIL8, width, height);
            gl.bindRenderbuffer(gl.RENDERBUFFER, null);
            this.stencil = stencil;
            this.stencilWidth = width;
            this.stencilHeight = height;
        }
        this.edges.resize(width, height, this.stencil);
        this.weights.resize(width, height, this.stencil);
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
            this.lookupsPending--;
        };
        image.onerror = () => {
            this.lookupsPending--;
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
        if (this.stencil)
            gl.deleteRenderbuffer(this.stencil);
        this.stencil = null;
        gl.deleteTexture(this.area);
        gl.deleteTexture(this.search);
    }
}
