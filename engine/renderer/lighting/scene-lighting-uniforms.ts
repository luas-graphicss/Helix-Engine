import type { GL } from '@/engine/renderer/gl/context';
import type { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import type { SkyLightingBinding } from '@/engine/renderer/sky/sky-system';
import { SHADOW_MAP_TEXTURE_UNIT, type ShadowMapBinding } from '@/engine/renderer/passes/shadow-pass';
import type { FrameLighting } from './frame-lighting';
export const SKY_LIGHTING_TEXTURE_UNIT = 1;
export const CLOUD_SHADOW_TEXTURE_UNIT = 2;
export const FIRST_PASS_TEXTURE_UNIT = 3;
export interface SceneLightingInput {
    camera: PerspectiveCamera;
    lighting: FrameLighting;
    shadow: ShadowMapBinding;
    sky: SkyLightingBinding;
    fogDensity: number;
    selectedId: number | null;
}
export function fogDensityForSky(enabled: boolean, haze: number): number {
    return enabled ? 0.0005 + Math.min(Math.max(haze, 0), 1) * 0.0025 : 0;
}
export function bindSceneLightingUniforms(gl: GL, program: ShaderProgram, { camera, lighting, shadow, sky, fogDensity }: SceneLightingInput): void {
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
    gl.activeTexture(gl.TEXTURE0 + SHADOW_MAP_TEXTURE_UNIT);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, shadow.texture);
    gl.uniform1i(program.uniform('u_shadowMap'), SHADOW_MAP_TEXTURE_UNIT);
    gl.uniform1f(program.uniform('u_shadowEnabled'), shadow.active ? 1 : 0);
    gl.uniformMatrix4fv(program.uniform('u_shadowMatrix[0]'), false, shadow.shadowMatrices);
    gl.uniform1fv(program.uniform('u_shadowTexelWorld[0]'), shadow.texelWorldSizes);
    gl.uniform1i(program.uniform('u_shadowCascadeCount'), shadow.cascadeCount);
    gl.uniform1f(program.uniform('u_shadowMapSize'), shadow.size);
    gl.activeTexture(gl.TEXTURE0 + SKY_LIGHTING_TEXTURE_UNIT);
    gl.bindTexture(gl.TEXTURE_2D, sky.lightingLut);
    gl.uniform1i(program.uniform('u_skyLightingLut'), SKY_LIGHTING_TEXTURE_UNIT);
    gl.uniform1f(program.uniform('u_skyLightingEnabled'), sky.skyLighting ? 1 : 0);
    gl.activeTexture(gl.TEXTURE0 + CLOUD_SHADOW_TEXTURE_UNIT);
    gl.bindTexture(gl.TEXTURE_2D, sky.cloudShadow.texture);
    gl.uniform1i(program.uniform('u_cloudShadowMap'), CLOUD_SHADOW_TEXTURE_UNIT);
    gl.uniform4fv(program.uniform('u_cloudShadowRegion'), sky.cloudShadow.region);
    gl.uniform1f(program.uniform('u_cloudShadowEnabled'), sky.cloudShadow.enabled ? 1 : 0);
}
