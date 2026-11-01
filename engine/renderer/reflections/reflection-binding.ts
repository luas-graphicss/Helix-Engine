import type { GL } from '@/engine/renderer/gl/context';
import type { ShaderProgram } from '@/engine/renderer/gl/shader-program';
export const REFLECTION_PROBE_TEXTURE_UNIT = 14;
export const SCREEN_REFLECTION_TEXTURE_UNIT = 15;
export interface ReflectionBinding {
    probe: WebGLTexture;
    probeValid: boolean;
    probeMaxLod: number;
    screen: WebGLTexture;
    screenValid: boolean;
    screenMaxLod: number;
    readonly screenInverseSceneSize: Float32Array;
    screenRoughnessCutoff: number;
    intensity: number;
}
export function createReflectionBinding(probe: WebGLTexture, screen: WebGLTexture): ReflectionBinding {
    return {
        probe,
        probeValid: false,
        probeMaxLod: 0,
        screen,
        screenValid: false,
        screenMaxLod: 0,
        screenInverseSceneSize: new Float32Array([1, 1]),
        screenRoughnessCutoff: 0.6,
        intensity: 1,
    };
}
export function bindReflectionUniforms(gl: GL, program: ShaderProgram, binding: ReflectionBinding, screenReflections: boolean): void {
    const enabled = binding.intensity > 0;
    gl.activeTexture(gl.TEXTURE0 + REFLECTION_PROBE_TEXTURE_UNIT);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, binding.probe);
    gl.uniform1i(program.uniform('u_reflectionProbe'), REFLECTION_PROBE_TEXTURE_UNIT);
    gl.uniform1f(program.uniform('u_reflectionProbeEnabled'), enabled && binding.probeValid ? 1 : 0);
    gl.uniform1f(program.uniform('u_reflectionProbeMaxLod'), binding.probeMaxLod);
    gl.uniform1f(program.uniform('u_reflectionIntensity'), binding.intensity);
    if (!screenReflections)
        return;
    gl.activeTexture(gl.TEXTURE0 + SCREEN_REFLECTION_TEXTURE_UNIT);
    gl.bindTexture(gl.TEXTURE_2D, binding.screen);
    gl.uniform1i(program.uniform('u_screenReflections'), SCREEN_REFLECTION_TEXTURE_UNIT);
    gl.uniform1f(program.uniform('u_screenReflectionsEnabled'), enabled && binding.screenValid ? 1 : 0);
    gl.uniform1f(program.uniform('u_screenReflectionsMaxLod'), binding.screenMaxLod);
    gl.uniform2fv(program.uniform('u_screenReflectionsInverseSceneSize'), binding.screenInverseSceneSize);
    gl.uniform1f(program.uniform('u_screenReflectionsRoughnessCutoff'), binding.screenRoughnessCutoff);
}
