import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { GL } from '@/engine/renderer/gl/context';
import { clearHdrColor, colorInternalFormat, type ColorFormat } from '@/engine/renderer/gl/color-render-target';
import { framebufferStatus } from '@/engine/renderer/gl/framebuffer-status';
import type { FullscreenTriangle } from '@/engine/renderer/gl/fullscreen-triangle';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { withDefines, type ShaderDefines } from '@/engine/renderer/gl/shader-source';
import { FULLSCREEN_VERTEX_SHADER } from '@/engine/renderer/shaders/chunks/fullscreen.glsl';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import { PROBE_PREFILTER_FRAGMENT_SHADER } from '../shaders/probe-prefilter.glsl';
import { CubeFaceCamera } from './cube-face-camera';
const FACES = 6;
const REFRESH_DISTANCE = 0.02;
const LEAD_FRAMES = 8;
const MAX_LEAD = 1.0;
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
    readonly position = vec3.create();
    private readonly capturedSun = vec3.create(0, 1, 0);
    private readonly lastCameraPosition = vec3.create();
    private readonly cameraStep = vec3.create();
    private capturedExposure = 1;
    private nextFace = 0;
    private cycleActive = false;
    private invalidated = true;
    private readonly cameras: CubeFaceCamera[] = [];
    private readonly faceFramebuffer: WebGLFramebuffer;
    private readonly prefilterFramebuffer: WebGLFramebuffer;
    private readonly prefilterProgram: ShaderProgram;
    private readonly captureLevels: number;
    constructor(private readonly gl: GL, private readonly triangle: FullscreenTriangle, readonly size: number, readonly format: ColorFormat, defines: ShaderDefines) {
        this.captureLevels = Math.floor(Math.log2(size)) + 1;
        this.levels = Math.min(MAX_LEVELS, this.captureLevels - 1);
        for (let face = 0; face < FACES; face++)
            this.cameras.push(new CubeFaceCamera(face));
        this.capture = this.allocateCubemap(this.captureLevels);
        this.prefiltered = this.allocateCubemap(this.levels);
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
    get capturing(): boolean {
        return this.cycleActive;
    }
    invalidate(): void {
        this.invalidated = true;
    }
    update(camera: PerspectiveCamera, sunDirection: Vec3, sceneAnimating: boolean): boolean {
        this.stats.facesRendered = 0;
        this.stats.prefiltered = false;
        this.stats.drawCalls = 0;
        vec3.subtract(this.cameraStep, camera.position, this.lastCameraPosition);
        vec3.copy(this.lastCameraPosition, camera.position);
        if (this.cycleActive)
            return true;
        const moved = vec3.distance(camera.position, this.position) > REFRESH_DISTANCE;
        const sunTurned = vec3.dot(sunDirection, this.capturedSun) < SUN_REFRESH_COS;
        const exposureChanged = Math.abs(camera.exposure - this.capturedExposure) > EXPOSURE_REFRESH * Math.max(this.capturedExposure, 1e-3);
        if (!(this.invalidated || !this.valid || moved || sunTurned || exposureChanged || sceneAnimating))
            return false;
        const stepLength = vec3.length(this.cameraStep);
        const lead = stepLength > 0 && stepLength < MAX_LEAD ? Math.min(stepLength * LEAD_FRAMES, MAX_LEAD) / stepLength : 0;
        vec3.scaleAndAdd(this.position, camera.position, this.cameraStep, lead);
        vec3.copy(this.capturedSun, sunDirection);
        this.capturedExposure = camera.exposure;
        this.invalidated = false;
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
        vec3.copy(camera.position, this.position);
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
        if (this.nextFace >= FACES) {
            this.prefilter();
            this.nextFace = 0;
            this.cycleActive = false;
            this.valid = true;
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    dispose(): void {
        const { gl } = this;
        gl.deleteTexture(this.capture);
        gl.deleteTexture(this.prefiltered);
        gl.deleteTexture(this.depth);
        gl.deleteFramebuffer(this.faceFramebuffer);
        gl.deleteFramebuffer(this.prefilterFramebuffer);
        this.prefilterProgram.dispose();
    }
    private prefilter(): void {
        const { gl, prefilterProgram: program, triangle } = this;
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
            for (let face = 0; face < FACES; face++) {
                gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_X + face, this.prefiltered, level);
                gl.uniform1i(program.uniform('u_face'), face);
                triangle.draw();
                this.stats.drawCalls++;
            }
        }
        gl.enable(gl.DEPTH_TEST);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
        this.stats.prefiltered = true;
    }
    private allocateCubemap(levels: number): WebGLTexture {
        const { gl } = this;
        const texture = gl.createTexture();
        if (!texture)
            throw new Error('Não foi possível alocar o cubemap da sonda de reflexo.');
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
        gl.texStorage2D(gl.TEXTURE_CUBE_MAP, levels, colorInternalFormat(gl, this.format), this.size, this.size);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
        return texture;
    }
}
