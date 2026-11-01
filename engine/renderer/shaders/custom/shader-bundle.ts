import type { ShaderModel, StandardShaderInput } from './custom-shader.glsl';
export interface ShaderUniformDeclaration {
    readonly name: string;
    readonly owner?: string;
    readonly glslName: string;
    readonly type: string;
    readonly arraySize: number;
    readonly line: number;
    readonly active: boolean;
}
export interface CompiledShaderBundle {
    readonly format: 'helix-shader';
    readonly version: 2;
    readonly language: 'glsl' | 'wgsl';
    readonly model: ShaderModel;
    readonly name: string;
    readonly fragment: string;
    readonly standard: Readonly<Partial<Record<StandardShaderInput, string>>>;
    readonly uniforms: readonly ShaderUniformDeclaration[];
    readonly key: string;
    readonly readsDepth: boolean;
}
export function encodeShaderBundle(bundle: CompiledShaderBundle): string {
    return JSON.stringify(bundle);
}
export function decodeShaderBundle(code: string | null | undefined): CompiledShaderBundle | null {
    if (!code || code[0] !== '{')
        return null;
    try {
        const parsed = JSON.parse(code) as Partial<CompiledShaderBundle>;
        if (parsed.format !== 'helix-shader' || parsed.version !== 2 || typeof parsed.fragment !== 'string')
            return null;
        return parsed as CompiledShaderBundle;
    }
    catch {
        return null;
    }
}
export function isSamplerType(type: string): boolean {
    return type.includes('sampler');
}
export function isBindableSamplerType(type: string): boolean {
    return type === 'sampler2D';
}
export function shaderKey(...parts: string[]): string {
    let hash = 0x811c9dc5;
    for (const part of parts) {
        for (let index = 0; index < part.length; index++) {
            hash ^= part.charCodeAt(index);
            hash = Math.imul(hash, 0x01000193) >>> 0;
        }
        hash ^= 0x2d;
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
}
