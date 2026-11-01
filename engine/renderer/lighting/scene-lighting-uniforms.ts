import type { GL } from '@/engine/renderer/gl/context';
import type { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import type { ShaderDefines } from '@/engine/renderer/gl/shader-source';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import type { SkyLightingBinding } from '@/engine/renderer/sky/sky-system';
import type { ShadowMaskBinding } from '@/engine/renderer/passes/shadow-mask-pass';
import { SHADOW_MAP_TEXTURE_UNIT, type ShadowMapBinding } from '@/engine/renderer/passes/shadow-pass';
import type { LocalShadowBinding } from '@/engine/renderer/passes/local-shadow-pass';
import type { LocalLightDataBinding } from './local-light-set';
import type { FrameLighting } from './frame-lighting';
import { bindCloudShadowUniforms, bindShadowSamplingUniforms } from './shadow-sampling-uniforms';
import { bindReflectionUniforms, type ReflectionBinding } from '@/engine/renderer/reflections/reflection-binding';
export const SHADOW_MASK_TEXTURE_UNIT = SHADOW_MAP_TEXTURE_UNIT;
export const SKY_LIGHTING_TEXTURE_UNIT = 1;
export const LOCAL_LIGHT_DATA_TEXTURE_UNIT = 2;
export const LOCAL_LIGHT_SHADOW_TEXTURE_UNIT = 3;
export const FIRST_PASS_TEXTURE_UNIT = 4;
export const CLOUD_SHADOW_TEXTURE_UNIT = 15;
export type ShadowSource = 'mask' | 'direct';
export function sceneLightingDefines(defines: ShaderDefines, shadowSource: ShadowSource): ShaderDefines {
    return shadowSource === 'direct' ? { ...defines, SCENE_LIGHTING_DIRECT_SHADOW: true } : defines;
}
export interface LocalLightsBinding {
    data: LocalLightDataBinding;
    shadow: LocalShadowBinding;
}
export interface SceneLightingInput {
    camera: PerspectiveCamera;
    lighting: FrameLighting;
    shadowMask: ShadowMaskBinding;
    shadow: ShadowMapBinding;
    sky: SkyLightingBinding;
    localLights: LocalLightsBinding;
    reflections: ReflectionBinding;
    fogDensity: number;
    selection: ReadonlySet<number> | null;
}
export function fogDensityForSky(enabled: boolean, haze: number): number {
    return enabled ? 0.0005 + Math.min(Math.max(haze, 0), 1) * 0.0025 : 0;
}
export function bindSceneLightingUniforms(gl: GL, program: ShaderProgram, input: SceneLightingInput, shadowSource: ShadowSource): void {
    const { camera, lighting, sky, fogDensity } = input;
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
    if (shadowSource === 'mask')
        bindShadowMaskUniforms(gl, program, input.shadowMask);
    else {
        bindShadowSamplingUniforms(gl, program, input.shadow, SHADOW_MAP_TEXTURE_UNIT);
        bindCloudShadowUniforms(gl, program, sky.cloudShadow, CLOUD_SHADOW_TEXTURE_UNIT);
    }
    gl.activeTexture(gl.TEXTURE0 + SKY_LIGHTING_TEXTURE_UNIT);
    gl.bindTexture(gl.TEXTURE_2D, sky.lightingLut);
    gl.uniform1i(program.uniform('u_skyLightingLut'), SKY_LIGHTING_TEXTURE_UNIT);
    gl.uniform1f(program.uniform('u_skyLightingEnabled'), sky.skyLighting ? 1 : 0);
    bindLocalLightUniforms(gl, program, input.localLights);
    bindReflectionUniforms(gl, program, input.reflections, shadowSource === 'mask');
}
function bindShadowMaskUniforms(gl: GL, program: ShaderProgram, shadowMask: ShadowMaskBinding): void {
    gl.activeTexture(gl.TEXTURE0 + SHADOW_MASK_TEXTURE_UNIT);
    gl.bindTexture(gl.TEXTURE_2D, shadowMask.texture);
    gl.uniform1i(program.uniform('u_shadowMask'), SHADOW_MASK_TEXTURE_UNIT);
    gl.uniform1f(program.uniform('u_shadowMaskEnabled'), shadowMask.valid ? 1 : 0);
    gl.uniform1f(program.uniform('u_shadowMaskScale'), shadowMask.scale);
}
export function bindLocalLightUniforms(gl: GL, program: ShaderProgram, { data, shadow }: LocalLightsBinding): void {
    gl.activeTexture(gl.TEXTURE0 + LOCAL_LIGHT_DATA_TEXTURE_UNIT);
    gl.bindTexture(gl.TEXTURE_2D, data.texture);
    gl.uniform1i(program.uniform('u_localLightData'), LOCAL_LIGHT_DATA_TEXTURE_UNIT);
    gl.uniform1i(program.uniform('u_localLightCount'), data.count);
    gl.uniform3i(program.uniform('u_localLightTiles'), data.tileSize, data.tilesX, data.tilesOffset);
    gl.uniform2f(program.uniform('u_localLightViewport'), data.viewportWidth, data.viewportHeight);
    gl.activeTexture(gl.TEXTURE0 + LOCAL_LIGHT_SHADOW_TEXTURE_UNIT);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, shadow.texture);
    gl.uniform1i(program.uniform('u_localShadowAtlas'), LOCAL_LIGHT_SHADOW_TEXTURE_UNIT);
    gl.uniform1f(program.uniform('u_localShadowTexel'), 1 / shadow.size);
}
