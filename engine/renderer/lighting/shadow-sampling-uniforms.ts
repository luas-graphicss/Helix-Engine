import type { GL } from '@/engine/renderer/gl/context';
import type { ShaderProgram } from '@/engine/renderer/gl/shader-program';
import type { ShadowMapBinding } from '@/engine/renderer/passes/shadow-pass';
import type { SkyLightingBinding } from '@/engine/renderer/sky/sky-system';
export type CloudShadowBinding = SkyLightingBinding['cloudShadow'];
export function bindShadowSamplingUniforms(gl: GL, program: ShaderProgram, shadow: ShadowMapBinding, unit: number): void {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, shadow.texture);
    gl.uniform1i(program.uniform('u_shadowMap'), unit);
    gl.uniform1f(program.uniform('u_shadowEnabled'), shadow.active ? 1 : 0);
    gl.uniformMatrix4fv(program.uniform('u_shadowMatrix[0]'), false, shadow.shadowMatrices);
    gl.uniform1fv(program.uniform('u_shadowTexelWorld[0]'), shadow.texelWorldSizes);
    gl.uniform1i(program.uniform('u_shadowCascadeCount'), shadow.cascadeCount);
    gl.uniform1f(program.uniform('u_shadowMapSize'), shadow.size);
}
export function bindCloudShadowUniforms(gl: GL, program: ShaderProgram, cloudShadow: CloudShadowBinding, unit: number): void {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, cloudShadow.texture);
    gl.uniform1i(program.uniform('u_cloudShadowMap'), unit);
    gl.uniform4fv(program.uniform('u_cloudShadowRegion'), cloudShadow.region);
    gl.uniform1f(program.uniform('u_cloudShadowEnabled'), cloudShadow.enabled ? 1 : 0);
}
