import type { GL } from './context';
export type GpuTier = 'low' | 'mid' | 'high';
export interface GlCapabilities {
    readonly floatColorTargets: boolean;
    readonly renderer: string;
    readonly software: boolean;
    readonly tier: GpuTier;
    readonly parallelShaderCompile: KHR_parallel_shader_compile | null;
}
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software|microsoft basic render|warp/i;
const LOW_TIER_RENDERER = /intel.*\b(uhd|hd graphics|iris)\b|vega [3-8]\b|radeon r[2-5]\b|radeon\(tm\) graphics|mali|adreno|powervr|apple gpu|apple m1\b/i;
const HIGH_TIER_RENDERER = /gtx 1[0-6]\d0|rtx|rx [5-7]\d{3}|radeon pro|arc a[57]|m[1-4] (pro|max|ultra)/i;
export function classifyGpuTier(renderer: string, software: boolean): GpuTier {
    if (software)
        return 'low';
    if (LOW_TIER_RENDERER.test(renderer))
        return 'low';
    if (HIGH_TIER_RENDERER.test(renderer))
        return 'high';
    return 'mid';
}
export function detectCapabilities(gl: GL): GlCapabilities {
    const floatColorTargets = gl.getExtension('EXT_color_buffer_float') !== null || gl.getExtension('EXT_color_buffer_half_float') !== null;
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = debugInfo ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) ?? '') : String(gl.getParameter(gl.RENDERER) ?? '');
    const software = SOFTWARE_RENDERER.test(renderer);
    const parallelShaderCompile = gl.getExtension('KHR_parallel_shader_compile');
    return { floatColorTargets, renderer, software, tier: classifyGpuTier(renderer, software), parallelShaderCompile };
}
