import { nagaResourceName, nagaVaryingName, POST_SHADER_VERTEX, SHADER_MODEL_LABEL, SURFACE_STRUCT_NAME, WGSL_FRAME_BINDING, WGSL_FRAME_GROUP, WGSL_FRAME_VARIABLE, WGSL_SCENE_COLOR_BINDING, WGSL_SCENE_DEPTH_BINDING, WGSL_SURFACE_ENTRY, WGSL_SURFACE_ENTRY_SOURCE, wgslPrelude, type ShaderModel, } from '@/engine/renderer/shaders/custom/custom-shader.glsl';
import { encodeShaderBundle, shaderKey, type CompiledShaderBundle } from '@/engine/renderer/shaders/custom/shader-bundle';
import { POST_USER_TEXTURE_UNITS, SURFACE_USER_TEXTURE_UNITS } from '@/engine/renderer/shaders/custom/shader-texture-units';
import { MESH_VERTEX_SHADER, meshFragmentShader } from '@/engine/renderer/shaders/mesh.glsl';
import type { CompileDiagnostic } from '../../compiler/compile-types';
import type { ForeignCompileInput, ForeignCompileOutput } from '../language-engine';
import { countUserSamplers, settleUniforms, standardInputMap, uniformDiagnostics, type PendingUniform } from './shader-compile-shared';
import { diagnosticAt, lineOfOffset, preprocessShader, ShaderProgramText, stripComments, type ShaderOrigin } from './shader-preprocessor';
import { validateShaderProgram } from './shader-validator';
export type NagaModule = Pick<typeof import('naga-wasm'), 'parseWgsl' | 'validate' | 'writeGlsl'>;
const SOURCE = 'WGSL';
const SURFACE_SIGNATURE = /\bfn\s+surface\s*\(\s*\w+\s*:\s*ptr\s*<\s*function\s*,\s*HelixSurface\s*>\s*\)/;
const SURFACE_FUNCTION = /\bfn\s+surface\s*\(/;
const FRAGMENT_ENTRY = /@fragment\b[^{;]*?\bfn\s+(\w+)\s*\(/;
const RESOURCE = /((?:@(?:group|binding)\(\s*\d+\s*\)\s*){2})var\b\s*(?:<([^>]*)>)?\s*(\w+)\s*:\s*([^;]+);/g;
const STRUCT = /\bstruct\s+(\w+)\s*\{([^}]*)\}/g;
const NAGA_LOCATION = /wgsl:(\d+):(\d+)/;
const RESERVED_NAMES = [WGSL_FRAME_VARIABLE, 'HelixFrame', SURFACE_STRUCT_NAME, 'sceneColor', 'sceneDepth', 'sceneSampler', 'helixLinearDepth', 'helixWorldPosition', WGSL_SURFACE_ENTRY];
interface WgslStruct {
    readonly name: string;
    readonly fields: ReadonlyArray<{
        name: string;
        type: string;
    }>;
}
export function compileWgslShader(naga: NagaModule, input: ForeignCompileInput): ForeignCompileOutput {
    const pre = preprocessShader(input, 'wgsl');
    const diagnostics: CompileDiagnostic[] = [...pre.diagnostics];
    const output = (code: string | null): ForeignCompileOutput => ({ artifact: null, code: hasErrors(diagnostics) ? null : code, diagnostics, dependencies: pre.dependencies });
    if (hasErrors(diagnostics))
        return output(null);
    const userBlock = new ShaderProgramText(false).addSegments(pre.segments);
    const userText = stripComments(userBlock.text);
    const rootText = stripComments(pre.rootText);
    const at = (offsetInUserText: number): ShaderOrigin | null => userBlock.originOf(lineOfOffset(userText, offsetInUserText));
    const report = (origin: ShaderOrigin | null, severity: CompileDiagnostic['severity'], message: string, code: string) => diagnostics.push(diagnosticAt(origin, severity, message, 'wgsl', code));
    const model = pre.model ?? inferModel(rootText);
    if (!model) {
        report({ file: pre.files[0], line: 1 }, 'error', 'Não dá para saber o modelo do shader: escreva uma função @fragment (pós-processamento) ou fn surface(s: ptr<function, HelixSurface>) (superfície), ou declare #pragma helix model(post) / model(surface) no topo.', 'shader-model');
        return output(null);
    }
    let entryPoint = WGSL_SURFACE_ENTRY;
    if (model === 'post') {
        const entry = FRAGMENT_ENTRY.exec(userText);
        if (!entry) {
            report({ file: pre.files[0], line: 1 }, 'error', 'Um efeito de pós-processamento precisa de uma função @fragment que receba @location(0) uv: vec2<f32> e devolva @location(0) vec4<f32>.', 'shader-model');
            return output(null);
        }
        entryPoint = entry[1];
        const locations = /@location\(\s*([1-9]\d*)\s*\)/g;
        let match: RegExpExecArray | null;
        while ((match = locations.exec(userText)) !== null) {
            report(at(match.index), 'error', `@location(${match[1]}) não existe aqui: o efeito recebe só @location(0) uv: vec2<f32> (mais @builtin(position), se quiser) e escreve só @location(0) vec4<f32>.`, 'shader-entry');
        }
    }
    else if (!SURFACE_SIGNATURE.test(userText)) {
        const found = SURFACE_FUNCTION.exec(userText);
        report(found ? at(found.index) : { file: pre.files[0], line: 1 }, 'error', found ? 'A função surface precisa ter a assinatura fn surface(s: ptr<function, HelixSurface>) e alterar os campos por (*s).campo.' : 'Um shader de superfície precisa de fn surface(s: ptr<function, HelixSurface>): a engine a chama depois de ler os mapas do material e antes da iluminação.', 'shader-model');
    }
    for (const name of RESERVED_NAMES) {
        const declared = new RegExp(`\\b(?:fn|var|struct|let|const|override)\\s*(?:<[^>]*>)?\\s*${name}\\b`).exec(userText);
        if (declared)
            report(at(declared.index), 'error', `"${name}" é um nome do prelúdio da engine; escolha outro.`, 'shader-reserved');
    }
    if (hasErrors(diagnostics))
        return output(null);
    const structs = collectStructs(userText);
    const pending = collectResources(userText, structs, at, report);
    if (hasErrors(diagnostics))
        return output(null);
    const prelude = wgslPrelude(model);
    const preludeLines = prelude.split('\n').length - 1;
    const full = prelude + userBlock.text + '\n' + (model === 'surface' ? WGSL_SURFACE_ENTRY_SOURCE : '');
    const nagaOrigin = (line: number): ShaderOrigin | null => {
        const userLine = line - preludeLines;
        if (userLine < 1)
            return null;
        if (userLine > userBlock.lineCount) {
            const found = SURFACE_FUNCTION.exec(userText);
            return found ? at(found.index) : { file: pre.files[0], line: 1 };
        }
        return userBlock.originOf(userLine);
    };
    let glsl: string;
    try {
        const module = naga.parseWgsl(full);
        const info = naga.validate(module);
        const result = naga.writeGlsl(module, info, { version: '300 es', stage: 'fragment', entryPoint, reflect: true });
        glsl = typeof result === 'string' ? result : result.code;
    }
    catch (cause) {
        const failure = describeNagaError(cause);
        const origin = failure.line === null ? { file: pre.files[0], line: 1 } : nagaOrigin(failure.line);
        const message = failure.line !== null && failure.line <= preludeLines ? `${failure.message} (no prelúdio da engine: provavelmente o shader redefine um nome dela, como ${RESERVED_NAMES.slice(0, 4).join(', ')})` : failure.message;
        report(origin, 'error', message, failure.kind);
        return output(null);
    }
    const code = model === 'post' ? glsl.replace(new RegExp(`\\b${nagaVaryingName(0)}\\b`, 'g'), 'vUv') : surfaceCodeFrom(glsl);
    const glslLines = code.split('\n');
    const rootFile = pre.files[0];
    const annotate = (message: string, _fileIndex: number, line: number): string => {
        const text = glslLines[line - 1]?.trim();
        return `No GLSL gerado pelo naga (linha ${line}${text ? `: "${text}"` : ''}): ${message}`;
    };
    let fragment: string;
    let vertex: string;
    if (model === 'post') {
        fragment = code;
        vertex = POST_SHADER_VERTEX;
    }
    else {
        fragment = meshFragmentShader(code);
        vertex = MESH_VERTEX_SHADER;
    }
    const validation = validateShaderProgram({
        vertex,
        fragment,
        language: 'wgsl',
        files: [rootFile, pre.files[1]],
        originOf: () => ({ file: rootFile, line: 1 }),
        logicalOrigin: () => ({ file: rootFile, line: 1 }),
        annotate,
    });
    diagnostics.push(...validation.diagnostics);
    if (!validation.available) {
        diagnostics.push({ severity: 'info', message: 'Sem WebGL2 nesta aba o GLSL gerado não foi conferido pelo driver; erros aparecerão no console ao usá-lo.', line: 1, column: 1, code: 'driver-unavailable', source: SOURCE });
    }
    if (hasErrors(diagnostics))
        return output(null);
    const reflected = validation.available && validation.ok ? validation.uniforms : null;
    const reflectedNames = reflected ? new Set(reflected.map((uniform) => uniform.baseName)) : null;
    const inCode = (name: string) => code.includes(name.split('.')[0]);
    const uniforms = settleUniforms(pending, reflected, (declaration) => inCode(declaration.glslName));
    const frame = nagaResourceName(WGSL_FRAME_GROUP, WGSL_FRAME_BINDING);
    const standard = standardInputMap(model, (spec) => (spec.input === 'sceneColor' ? nagaResourceName(WGSL_FRAME_GROUP, WGSL_SCENE_COLOR_BINDING) : spec.input === 'sceneDepth' ? nagaResourceName(WGSL_FRAME_GROUP, WGSL_SCENE_DEPTH_BINDING) : `${frame}.${spec.wgslName}`), (name) => (reflectedNames ? reflectedNames.has(name) : inCode(name)), true);
    diagnostics.push(...uniformDiagnostics(uniforms, 'wgsl', reflected !== null));
    const budget = model === 'post' ? POST_USER_TEXTURE_UNITS : SURFACE_USER_TEXTURE_UNITS;
    const samplers = countUserSamplers(uniforms);
    if (samplers > budget) {
        diagnostics.push({ severity: 'warning', message: `O shader usa ${samplers} texturas próprias, mas o passe de ${SHADER_MODEL_LABEL[model]} só tem ${budget} unidades livres; as últimas ficarão sem textura.`, line: 1, column: 1, code: 'shader-textures', source: SOURCE });
    }
    const bundle: CompiledShaderBundle = {
        format: 'helix-shader',
        version: 2,
        language: 'wgsl',
        model,
        name: input.file,
        fragment: code,
        standard,
        uniforms,
        key: shaderKey('wgsl', model, code),
        readsDepth: standard.sceneDepth !== undefined,
    };
    return output(encodeShaderBundle(bundle));
}
function inferModel(rootText: string): ShaderModel | null {
    if (SURFACE_FUNCTION.test(rootText))
        return 'surface';
    if (/@fragment\b/.test(rootText))
        return 'post';
    return null;
}
function surfaceCodeFrom(glsl: string): string {
    const lines = glsl.split('\n').filter((line) => !/^\s*#version\b/.test(line) && !/^\s*precision\s+\w+\s+\w+\s*;/.test(line) && !/^\s*layout\(location\s*=\s*0\)\s*out\s+vec4\s+_fs2p_location0\s*;/.test(line));
    let text = lines.join('\n');
    const main = text.lastIndexOf('\nvoid main(');
    if (main >= 0)
        text = text.slice(0, main);
    return text.trim() + '\n';
}
function describeNagaError(cause: unknown): {
    message: string;
    line: number | null;
    kind: string;
} {
    const error = cause as {
        message?: string;
        formatted?: string;
        kind?: string;
    };
    const formatted = typeof error?.formatted === 'string' ? error.formatted : '';
    const location = NAGA_LOCATION.exec(formatted);
    const notes = formatted
        .split('\n')
        .filter((line) => /^\s*=\s/.test(line))
        .map((line) => line.replace(/^\s*=\s*/, '').trim())
        .filter((line) => line.length > 0);
    const base = (typeof error?.message === 'string' && error.message.trim()) || 'o naga recusou o shader';
    const message = notes.length > 0 && !notes.includes(base) ? `${base} (${notes.join('; ')})` : base;
    return { message, line: location ? Number(location[1]) : null, kind: `naga-${error?.kind ?? 'error'}` };
}
function collectStructs(text: string): Map<string, WgslStruct> {
    const structs = new Map<string, WgslStruct>();
    STRUCT.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = STRUCT.exec(text)) !== null) {
        const fields: Array<{
            name: string;
            type: string;
        }> = [];
        for (const part of splitTopLevel(match[2])) {
            const field = /(?:@\w+(?:\([^)]*\))?\s*)*(\w+)\s*:\s*(.+)$/s.exec(part.trim());
            if (field)
                fields.push({ name: field[1], type: field[2].trim() });
        }
        structs.set(match[1], { name: match[1], fields });
    }
    return structs;
}
function splitTopLevel(text: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let start = 0;
    for (let index = 0; index < text.length; index++) {
        const char = text[index];
        if (char === '<' || char === '(')
            depth++;
        else if (char === '>' || char === ')')
            depth--;
        else if (char === ',' && depth === 0) {
            parts.push(text.slice(start, index));
            start = index + 1;
        }
    }
    const tail = text.slice(start);
    if (tail.trim().length > 0)
        parts.push(tail);
    return parts;
}
function collectResources(text: string, structs: Map<string, WgslStruct>, at: (offset: number) => ShaderOrigin | null, report: (origin: ShaderOrigin | null, severity: CompileDiagnostic['severity'], message: string, code: string) => void): PendingUniform[] {
    const pending: PendingUniform[] = [];
    const bindings = new Map<string, string>();
    RESOURCE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = RESOURCE.exec(text)) !== null) {
        const origin = at(match.index);
        const line = origin?.file.includedAt ?? origin?.line ?? 1;
        const group = Number(/@group\(\s*(\d+)\s*\)/.exec(match[1])?.[1] ?? -1);
        const binding = Number(/@binding\(\s*(\d+)\s*\)/.exec(match[1])?.[1] ?? -1);
        const space = (match[2] ?? '').split(',')[0].trim();
        const name = match[3];
        const type = match[4].trim();
        if (group === WGSL_FRAME_GROUP) {
            report(origin, 'error', `O grupo ${WGSL_FRAME_GROUP} é da engine (${WGSL_FRAME_VARIABLE}, sceneColor, sceneDepth); declare "${name}" no grupo 1 em diante.`, 'shader-binding');
            continue;
        }
        const slot = `${group}:${binding}`;
        const taken = bindings.get(slot);
        if (taken) {
            report(origin, 'error', `@group(${group}) @binding(${binding}) já é de "${taken}".`, 'shader-binding');
            continue;
        }
        bindings.set(slot, name);
        const glslName = nagaResourceName(group, binding);
        if (space === 'uniform') {
            const struct = structs.get(type);
            if (struct) {
                for (const field of struct.fields) {
                    const mapped = glslTypeOf(field.type, structs);
                    if (!mapped) {
                        report(origin, 'warning', `"${name}.${field.name}" é ${field.type}, que uniforms.set não preenche (use escalares, vetores, matrizes ou arrays deles).`, 'shader-uniform');
                        continue;
                    }
                    pending.push({ name: field.name, owner: name, glslName: `${glslName}.${field.name}`, type: mapped.type, arraySize: mapped.arraySize, line });
                }
                continue;
            }
            const mapped = glslTypeOf(type, structs);
            if (!mapped) {
                report(origin, 'warning', `"${name}" é ${type}, que uniforms.set não preenche (use escalares, vetores, matrizes, arrays deles ou uma struct com esses campos).`, 'shader-uniform');
                continue;
            }
            pending.push({ name, glslName, type: mapped.type, arraySize: mapped.arraySize, line });
            continue;
        }
        if (space === 'storage') {
            report(origin, 'error', `"${name}": o WebGL2 não tem storage buffers; use var<uniform> ou uma textura.`, 'shader-binding');
            continue;
        }
        if (space)
            continue;
        const sampler = samplerTypeOf(type);
        if (sampler)
            pending.push({ name, glslName, type: sampler, arraySize: 1, line });
    }
    return pending;
}
const SCALARS: Record<string, {
    glsl: string;
    vec: string;
}> = {
    f32: { glsl: 'float', vec: 'vec' },
    i32: { glsl: 'int', vec: 'ivec' },
    u32: { glsl: 'uint', vec: 'uvec' },
    bool: { glsl: 'bool', vec: 'bvec' },
};
const VEC_SUFFIX: Record<string, string> = { f: 'f32', i: 'i32', u: 'u32', h: 'f16' };
function glslTypeOf(wgslType: string, structs: Map<string, WgslStruct>): {
    type: string;
    arraySize: number;
} | null {
    const type = wgslType.replace(/\s+/g, '');
    const array = /^array<(.+),(\d+)>$/.exec(type);
    if (array) {
        const element = glslTypeOf(array[1], structs);
        return element && element.arraySize === 1 ? { type: element.type, arraySize: Number(array[2]) } : null;
    }
    const scalar = SCALARS[type];
    if (scalar)
        return { type: scalar.glsl, arraySize: 1 };
    const vector = /^vec([234])(?:<(\w+)>|([fiuh]))$/.exec(type);
    if (vector) {
        const inner = vector[2] ?? VEC_SUFFIX[vector[3]];
        const base = SCALARS[inner];
        return base ? { type: `${base.vec}${vector[1]}`, arraySize: 1 } : null;
    }
    const matrix = /^mat([234])x([234])(?:<(\w+)>|([fh]))$/.exec(type);
    if (matrix) {
        const inner = matrix[3] ?? VEC_SUFFIX[matrix[4]];
        if (inner !== 'f32')
            return null;
        return { type: matrix[1] === matrix[2] ? `mat${matrix[1]}` : `mat${matrix[1]}x${matrix[2]}`, arraySize: 1 };
    }
    if (structs.has(type))
        return null;
    return null;
}
function samplerTypeOf(wgslType: string): string | null {
    const type = wgslType.replace(/\s+/g, '');
    const texture = /^texture_(2d|2d_array|3d|cube|cube_array)<(f32|i32|u32)>$/.exec(type);
    if (texture) {
        const prefix = texture[2] === 'i32' ? 'i' : texture[2] === 'u32' ? 'u' : '';
        const kind: Record<string, string> = { '2d': 'sampler2D', '2d_array': 'sampler2DArray', '3d': 'sampler3D', cube: 'samplerCube', cube_array: 'samplerCubeArray' };
        return `${prefix}${kind[texture[1]]}`;
    }
    if (type === 'texture_depth_2d')
        return 'sampler2DShadow';
    if (type === 'texture_depth_cube')
        return 'samplerCubeShadow';
    return null;
}
function hasErrors(diagnostics: readonly CompileDiagnostic[]): boolean {
    return diagnostics.some((diagnostic) => diagnostic.severity === 'error');
}
