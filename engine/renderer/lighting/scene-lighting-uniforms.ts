import type { GL } from '@/engine/renderer/gl/context';
import type { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import type { SkyLightingBinding } from '@/engine/renderer/sky/sky-system';
import type { ShadowMaskBinding } from '@/engine/renderer/passes/shadow-mask-pass';
import type { FrameLighting } from './frame-lighting';
export const SHADOW_MASK_TEXTURE_UNIT = 0;
export const SKY_LIGHTING_TEXTURE_UNIT = 1;
export const CLOUD_SHADOW_TEXTURE_UNIT = 2;
export const FIRST_PASS_TEXTURE_UNIT = 3;
export interface SceneLightingInput {
    camera: PerspectiveCamera;
    lighting: FrameLighting;
    shadowMask: ShadowMaskBinding;
    sky: SkyLightingBinding;
    fogDensity: number;
    selection: ReadonlySet<number> | null;
}
export function fogDensityForSky(enabled: boolean, haze: number): number {
    return enabled ? 0.0005 + Math.min(Math.max(haze, 0), 1) * 0.0025 : 0;
}
export function bindSceneLightingUniforms(gl: GL, program: ShaderProgram, { camera, lighting, shadowMask, sky, fogDensity }: SceneLightingInput): void {
    gl.uniformMatrix4fv(program.uniform('u_viewProjection'), false, camera.viewProjectionMatrix);
    gl.uniform3fv(program.uniform('u_cameraPosition'), camera.position);
    gl.uniform1f(program.uniform('u_exposure'), camera.exposure);
    gl.uniform1f(program.uniform('u_fogDensity'), fogDensity);
    gl.uniform3fv(program.uniform('u_sunDirection'), lighting.sunDirection);
    gl.uniform3fv(program.uniform('u_sunRadiance'), lighting.sunRadiance);
    gl.uniform3fv(program.uniform('u_moonDirection'), sky.moonDirection);
    gl.uniform3fv(program.uniform('u_moonRadiance'), sky.moonIrradiance);
    gl.uniform3fv(program.uniform('u_skyIrradiance'), lighting.skyIrradiance);
    gl.uniform3fv(program.uniform('u_groundIrradiance'), lighting.groundIrradiance);
    gl.uniform1f(program.uniform('u_shadowOnMoon'), sky.shadowOnMoon ? 1 : 0);
    gl.activeTexture(gl.TEXTURE0 + SHADOW_MASK_TEXTURE_UNIT);
    gl.bindTexture(gl.TEXTURE_2D, shadowMask.texture);
    gl.uniform1i(program.uniform('u_shadowMask'), SHADOW_MASK_TEXTURE_UNIT);
    gl.uniform1f(program.uniform('u_shadowMaskEnabled'), shadowMask.valid ? 1 : 0);
    gl.activeTexture(gl.TEXTURE0 + SKY_LIGHTING_TEXTURE_UNIT);
    gl.bindTexture(gl.TEXTURE_2D, sky.lightingLut);
    gl.uniform1i(program.uniform('u_skyLightingLut'), SKY_LIGHTING_TEXTURE_UNIT);
    gl.uniform1f(program.uniform('u_skyLightingEnabled'), sky.skyLighting ? 1 : 0);
}
