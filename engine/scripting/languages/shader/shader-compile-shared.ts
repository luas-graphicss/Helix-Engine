import type { ReflectedUniform } from '@/engine/renderer/gl/program-reflection';
import { standardInputsFor, SURFACE_ALIASED_INPUTS, type ShaderModel, type StandardShaderInput, type StandardShaderInputSpec } from '@/engine/renderer/shaders/custom/custom-shader.glsl';
import { isBindableSamplerType, isSamplerType, type ShaderUniformDeclaration } from '@/engine/renderer/shaders/custom/shader-bundle';
import { uniformComponentCount } from '@/engine/renderer/shaders/custom/shader-uniform-binder';
import type { CompileDiagnostic } from '../../compiler/compile-types';
import { SHADER_DIAGNOSTIC_SOURCE, type ShaderLanguage } from './shader-preprocessor';
export type PendingUniform = Omit<ShaderUniformDeclaration, 'active'>;
export function isSettableUniformType(type: string): boolean {
    return uniformComponentCount(type) > 0 || isSamplerType(type);
}
export function settleUniforms(pending: readonly PendingUniform[], reflected: readonly ReflectedUniform[] | null, textuallyActive: (declaration: PendingUniform) => boolean): ShaderUniformDeclaration[] {
    const names = reflected ? new Set(reflected.map((uniform) => uniform.baseName)) : null;
    return pending.map((declaration) => ({ ...declaration, active: names ? names.has(declaration.glslName) : textuallyActive(declaration) }));
}
export function standardInputMap(model: ShaderModel, glslNameOf: (spec: StandardShaderInputSpec) => string, isActive: (glslName: string) => boolean, includeAliased = false): Partial<Record<StandardShaderInput, string>> {
    const map: Partial<Record<StandardShaderInput, string>> = {};
    for (const spec of standardInputsFor(model)) {
        if (!includeAliased && model === 'surface' && SURFACE_ALIASED_INPUTS.has(spec.input))
            continue;
        const name = glslNameOf(spec);
        if (isActive(name))
            map[spec.input] = name;
    }
    return map;
}
export function uniformDiagnostics(uniforms: readonly ShaderUniformDeclaration[], language: ShaderLanguage, driverChecked: boolean): CompileDiagnostic[] {
    const source = SHADER_DIAGNOSTIC_SOURCE[language];
    const diagnostics: CompileDiagnostic[] = [];
    for (const uniform of uniforms) {
        const display = uniform.owner ? `${uniform.owner}.${uniform.name}` : uniform.name;
        if (isSamplerType(uniform.type) && !isBindableSamplerType(uniform.type)) {
            diagnostics.push({ severity: 'warning', message: `"${display}" é ${uniform.type}: a engine só vincula texturas 2D (sampler2D) por uniforms.set; este amostrador fica sem textura.`, line: uniform.line, column: 1, code: 'shader-uniform', source });
        }
        else if (!isSettableUniformType(uniform.type)) {
            diagnostics.push({ severity: 'warning', message: `"${display}" é ${uniform.type}, que uniforms.set não preenche; use float, int, uint, bool, vetores, matrizes ou sampler2D.`, line: uniform.line, column: 1, code: 'shader-uniform', source });
        }
        else if (driverChecked && !uniform.active) {
            diagnostics.push({ severity: 'info', message: `"${display}" é declarado mas nunca lido: o driver o removeu do programa e uniforms.set("${display}", …) não terá efeito.`, line: uniform.line, column: 1, code: 'shader-unused-uniform', source });
        }
    }
    return diagnostics;
}
export function countUserSamplers(uniforms: readonly ShaderUniformDeclaration[]): number {
    return uniforms.filter((uniform) => isSamplerType(uniform.type) && uniform.active).length;
}
export function mentions(text: string, name: string): boolean {
    return new RegExp(`(^|[^\\w.])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text);
}
