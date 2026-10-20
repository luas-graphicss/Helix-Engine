import type { GL } from './context';
export interface GlCapabilities {
    readonly floatColorTargets: boolean;
}
export function detectCapabilities(gl: GL): GlCapabilities {
    const floatColorTargets = gl.getExtension('EXT_color_buffer_float') !== null || gl.getExtension('EXT_color_buffer_half_float') !== null;
    return { floatColorTargets };
}
