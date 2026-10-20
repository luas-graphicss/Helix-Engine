import type { GL } from '@/engine/renderer/gl/context';
import type { FullscreenTriangle } from '@/engine/renderer/gl/fullscreen-triangle';
import { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import { withDefines, type ShaderDefines } from '@/engine/renderer/gl/shader-source';
import { FULLSCREEN_RAY_VERTEX_SHADER } from '@/engine/renderer/shaders/chunks/fullscreen.glsl';
import { SKY_FRAGMENT_SHADER } from '@/engine/renderer/shaders/sky/sky.glsl';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import { degToRad } from '@/engine/core/math/scalar';
import type { AtmosphereLuts } from './atmosphere-luts';
import type { SkyFrame } from './sky-frame';
const SKY_VIEW_UNIT = 1;
const LIGHTING_UNIT = 2;
const CLOUDS_UNIT = 3;
export interface SkyPassInput {
    camera: PerspectiveCamera;
    frame: SkyFrame;
    luts: AtmosphereLuts;
    clouds: WebGLTexture | null;
    width: number;
    height: number;
    elapsedSeconds: number;
}
export class SkyPass {
    private readonly program: ShaderProgram;
    private readonly inverseResolution = new Float32Array(2);
    constructor(private readonly gl: GL, defines: ShaderDefines, private readonly triangle: FullscreenTriangle) {
        this.program = new ShaderProgram(gl, FULLSCREEN_RAY_VERTEX_SHADER, withDefines(SKY_FRAGMENT_SHADER, defines));
    }
    render(input: SkyPassInput): void {
        const { gl, program } = this;
        const { camera, frame } = input;
        this.inverseResolution[0] = 1 / input.width;
        this.inverseResolution[1] = 1 / input.height;
        program.use();
        gl.uniformMatrix4fv(program.uniform('u_inverseViewProjection'), false, camera.inverseViewProjectionMatrix);
        gl.uniform2fv(program.uniform('u_inverseResolution'), this.inverseResolution);
        gl.uniform3fv(program.uniform('u_sunDirection'), frame.sunDirection);
        gl.uniform3fv(program.uniform('u_moonDirection'), frame.moonDirection);
        gl.uniform3fv(program.uniform('u_sunIrradiance'), frame.sunIrradiance);
        gl.uniform1f(program.uniform('u_sunAngularRadius'), frame.sunAngularRadius);
        gl.uniform1f(program.uniform('u_moonAngularRadius'), frame.moonAngularRadius);
        gl.uniformMatrix3fv(program.uniform('u_starRotation'), false, frame.starRotation);
        gl.uniform1f(program.uniform('u_starsIntensity'), frame.starsIntensity);
        gl.uniform1f(program.uniform('u_pixelAngle'), degToRad(camera.fovDegrees) / input.height);
        gl.uniform1f(program.uniform('u_time'), input.elapsedSeconds);
        gl.uniform1f(program.uniform('u_exposure'), camera.exposure);
        gl.uniform1f(program.uniform('u_mieScale'), frame.mieScale);
        gl.uniform1f(program.uniform('u_cloudsEnabled'), input.clouds ? 1 : 0);
        this.bindTexture(program, 'u_skyViewLut', SKY_VIEW_UNIT, input.luts.skyView.texture);
        this.bindTexture(program, 'u_skyLightingLut', LIGHTING_UNIT, input.luts.lighting.texture);
        this.bindTexture(program, 'u_clouds', CLOUDS_UNIT, input.clouds ?? input.luts.lighting.texture);
        gl.depthMask(false);
        this.triangle.draw();
        gl.depthMask(true);
    }
    dispose(): void {
        this.program.dispose();
    }
    private bindTexture(program: ShaderProgram, name: string, unit: number, texture: WebGLTexture): void {
        const { gl } = this;
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(program.uniform(name), unit);
    }
}
