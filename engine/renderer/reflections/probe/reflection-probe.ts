import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { GL } from '@/engine/renderer/gl/context';
import { clearHdrColor, type ColorFormat } from '@/engine/renderer/gl/color-render-target';
import { framebufferStatus } from '@/engine/renderer/gl/framebuffer-status';
import type { FullscreenTriangle } from '@/engine/renderer/gl/fullscreen-triangle';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { withDefines, type ShaderDefines } from '@/engine/renderer/gl/shader-source';
import { FULLSCREEN_VERTEX_SHADER } from '@/engine/renderer/shaders/chunks/fullscreen.glsl';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import { PROBE_PREFILTER_FRAGMENT_SHADER } from '../shaders/probe-prefilter.glsl';
import { CubeFaceCamera } from './cube-face-camera';
import { ProbeAnchor } from './probe-anchor';
import { ProbeCrossfade } from './probe-crossfade';
import { CUBE_FACE_COUNT, createProbeCubemap } from './probe-cubemap';
const SUN_REFRESH_COS = Math.cos((0.5 * Math.PI) / 180);
const EXPOSURE_REFRESH = 0.01;
const MAX_LEVELS = 6;
export interface ReflectionProbeStats {
    facesRendered: number;
    prefiltered: boolean;
    drawCalls: number;
}
export class ReflectionProbe {
    readonly levels: number;
    readonly capture: WebGLTexture;
    readonly prefiltered: WebGLTexture;
    readonly depth: WebGLTexture;
    readonly stats: ReflectionProbeStats = { facesRendered: 0, prefiltered: false, drawCalls: 0 };
    valid = false;
    private readonly anchor = new ProbeAnchor();
    private readonly capturePosition = vec3.create();
    private readonly capturedSun = vec3.create(0, 1, 0);
    private capturedExposure = 1;
    private nextFace = 0;
    private cycleActive = false;
    private cycleFollowsCamera = false;
    private fadeEndsWithTravel = false;
    private invalidated = true;
    private readonly cameras: CubeFaceCamera[] = [];
    private readonly faceFramebuffer: WebGLFramebuffer;
    private readonly prefilterFramebuffer: WebGLFramebuffer;
    private readonly prefilterProgram: ShaderProgram;
    private readonly crossfade: ProbeCrossfade;
    private readonly captureLevels: number;
    constructor(private readonly gl: GL, private readonly triangle: FullscreenTriangle, readonly size: number, readonly format: ColorFormat, defines: ShaderDefines) {
        this.captureLevels = Math.floor(Math.log2(size)) + 1;
        this.levels = Math.min(MAX_LEVELS, this.captureLevels - 1);
        for (let face = 0; face < CUBE_FACE_COUNT; face++)
            this.cameras.push(new CubeFaceCamera(face));
        this.capture = createProbeCubemap(gl, { size, levels: this.captureLevels, format });
        this.crossfade = new ProbeCrossfade(gl, triangle, { size, levels: this.levels, format }, defines);
        this.prefiltered = this.crossfade.displayed;
        const depth = gl.createTexture();
        const faceFramebuffer = gl.createFramebuffer();
        const prefilterFramebuffer = gl.createFramebuffer();
        if (!depth || !faceFramebuffer || !prefilterFramebuffer)
            throw new Error('Não foi possível alocar a sonda de reflexo.');
        this.depth = depth;
        this.faceFramebuffer = faceFramebuffer;
        this.prefilterFramebuffer = prefilterFramebuffer;
        gl.bindTexture(gl.TEXTURE_2D, depth);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, size, size);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, faceFramebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_X, this.capture, 0);
        const status = framebufferStatus(gl, `reflection-probe:${format}`);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        if (status !== gl.FRAMEBUFFER_COMPLETE)
            throw new Error(`Alvo da sonda de reflexo incompleto (0x${status.toString(16)}).`);
        this.prefilterProgram = new ShaderProgram(gl, FULLSCREEN_VERTEX_SHADER, withDefines(PROBE_PREFILTER_FRAGMENT_SHADER, defines));
    }
    get maxLod(): number {
        return this.levels - 1;
    }
    get refreshing(): boolean {
        return this.cycleActive || this.crossfade.active;
    }
    invalidate(): void {
        this.invalidated = true;
    }
    update(camera: PerspectiveCamera, sunDirection: Vec3, sceneAnimating: boolean): boolean {
        this.stats.facesRendered = 0;
        this.stats.prefiltered = false;
        this.anchor.trackCamera(camera.position);
        this.stats.drawCalls = this.fadeEndsWithTravel && !this.anchor.cameraMoving ? this.crossfade.finish() : this.crossfade.advance();
        const followCamera = !this.valid || this.anchor.shouldFollow(camera.position);
        if (this.cycleActive && this.cycleFollowsCamera && !followCamera)
            this.abandonCycle();
        if (this.cycleActive)
            return true;
        const sunTurned = vec3.dot(sunDirection, this.capturedSun) < SUN_REFRESH_COS;
        const exposureChanged = Math.abs(camera.exposure - this.capturedExposure) > EXPOSURE_REFRESH * Math.max(this.capturedExposure, 1e-3);
        if (!(followCamera || this.invalidated || sunTurned || exposureChanged || sceneAnimating))
            return false;
        vec3.copy(this.capturePosition, followCamera ? camera.position : this.anchor.position);
        vec3.copy(this.capturedSun, sunDirection);
        this.capturedExposure = camera.exposure;
        this.invalidated = false;
        this.cycleFollowsCamera = followCamera;
        this.nextFace = 0;
        this.cycleActive = true;
        return true;
    }
    beginFace(mainCamera: PerspectiveCamera, clearColor: readonly [
        number,
        number,
        number
    ] | null, encodedRange: number): CubeFaceCamera {
        const { gl } = this;
        const camera = this.cameras[this.nextFace];
        vec3.copy(camera.position, this.capturePosition);
        camera.near = mainCamera.near;
        camera.far = mainCamera.far;
        camera.exposure = this.capturedExposure;
        camera.updateMatrices();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.faceFramebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_X + this.nextFace, this.capture, 0);
        gl.viewport(0, 0, this.size, this.size);
        gl.clear(gl.DEPTH_BUFFER_BIT);
        if (clearColor)
            clearHdrColor(gl, this.format, clearColor, encodedRange);
        return camera;
    }
    bindFace(): void {
        const { gl } = this;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.faceFramebuffer);
        gl.viewport(0, 0, this.size, this.size);
    }
    endFace(): void {
        const { gl } = this;
        this.stats.facesRendered = 1;
        this.nextFace++;
        if (this.nextFace >= CUBE_FACE_COUNT) {
            this.prefilter();
            this.presentCapture();
            this.anchor.moveTo(this.capturePosition);
            this.nextFace = 0;
            this.cycleActive = false;
            this.valid = true;
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    dispose(): void {
        const { gl } = this;
        gl.deleteTexture(this.capture);
        gl.deleteTexture(this.depth);
        gl.deleteFramebuffer(this.faceFramebuffer);
        gl.deleteFramebuffer(this.prefilterFramebuffer);
        this.prefilterProgram.dispose();
        this.crossfade.dispose();
    }
    private abandonCycle(): void {
        this.cycleActive = false;
        this.nextFace = 0;
        this.invalidated = true;
    }
    private presentCapture(): void {
        if (this.valid) {
            this.fadeEndsWithTravel = this.cycleFollowsCamera && this.anchor.cameraTraveling;
            this.crossfade.fadeIn();
            return;
        }
        this.stats.drawCalls += this.crossfade.show();
    }
    private prefilter(): void {
        const { gl, prefilterProgram: program, triangle } = this;
        const target = this.crossfade.incoming;
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.capture);
        gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.prefilterFramebuffer);
        gl.disable(gl.DEPTH_TEST);
        program.use();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.capture);
        gl.uniform1i(program.uniform('u_source'), 0);
        gl.uniform1f(program.uniform('u_sourceSize'), this.size);
        for (let level = 0; level < this.levels; level++) {
            const levelSize = Math.max(1, this.size >> level);
            gl.viewport(0, 0, levelSize, levelSize);
            gl.uniform1f(program.uniform('u_targetSize'), levelSize);
            gl.uniform1f(program.uniform('u_roughness'), level / Math.max(1, this.levels - 1));
            for (let face = 0; face < CUBE_FACE_COUNT; face++) {
                gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_X + face, target, level);
                gl.uniform1i(program.uniform('u_face'), face);
                triangle.draw();
                this.stats.drawCalls++;
            }
        }
        gl.enable(gl.DEPTH_TEST);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
        this.stats.prefiltered = true;
    }
}
