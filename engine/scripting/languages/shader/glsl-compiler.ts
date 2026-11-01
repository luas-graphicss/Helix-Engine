import { POST_SHADER_HELPER_FUNCTIONS, POST_SHADER_VERTEX, SHADER_MODEL_LABEL, SHADER_SOURCE_ENGINE, STANDARD_SHADER_UNIFORM_NAMES, standardInputByGlslName, standardUniformLines, SURFACE_ALIASED_INPUTS, SURFACE_STRUCT_NAME, type ShaderModel, } from '@/engine/renderer/shaders/custom/custom-shader.glsl';
import { encodeShaderBundle, shaderKey, type CompiledShaderBundle } from '@/engine/renderer/shaders/custom/shader-bundle';
import { POST_USER_TEXTURE_UNITS, SURFACE_USER_TEXTURE_UNITS } from '@/engine/renderer/shaders/custom/shader-texture-units';
import { declaredNames, MESH_VERTEX_SHADER, meshFragmentShader } from '@/engine/renderer/shaders/mesh.glsl';
import type { CompileDiagnostic } from '../../compiler/compile-types';
import type { ForeignCompileInput, ForeignCompileOutput } from '../language-engine';
import { countUserSamplers, isSettableUniformType, mentions, settleUniforms, standardInputMap, uniformDiagnostics, type PendingUniform } from './shader-compile-shared';
import { lineOfOffset, preprocessShader, ShaderProgramText, stripComments, type ShaderSegment } from './shader-preprocessor';
import { validateShaderProgram } from './shader-validator';
const SOURCE = 'GLSL';
const SURFACE_FUNCTION = /\bvoid\s+surface\s*\(\s*inout\s+HelixSurface\s+\w+\s*\)/;
const MAIN_FUNCTION = /\bvoid\s+main\s*\(/;
const UNIFORM_DECLARATION = /\buniform\s+(?:(?:lowp|mediump|highp)\s+)?([A-Za-z_]\w*)\s+([^;{}]+?)\s*;/g;
const DECLARATOR = /^([A-Za-z_]\w*)\s*(?:\[\s*(\d+)\s*\])?$/;
const USER_OUTPUT = /\bout\s+(?:(?:lowp|mediump|highp)\s+)?\w+\s+\w+/;
export function compileGlslShader(input: ForeignCompileInput): ForeignCompileOutput {
    const pre = preprocessShader(input, 'glsl');
    const diagnostics: CompileDiagnostic[] = [...pre.diagnostics];
    const output = (code: string | null): ForeignCompileOutput => ({ artifact: null, code: hasErrors(diagnostics) ? null : code, diagnostics, dependencies: pre.dependencies });
    if (hasErrors(diagnostics))
        return output(null);
    const userBlock = new ShaderProgramText(true).addSegments(pre.segments);
    const userText = stripComments(userBlock.text);
    const rootText = stripComments(pre.rootText);
    const model = pre.model ?? inferModel(rootText);
    if (!model) {
        diagnostics.push(error('Não dá para saber o modelo do shader: escreva void main() (pós-processamento) ou void surface(inout HelixSurface s) (superfície), ou declare #pragma helix model(post) / model(surface) no topo.', 1, 'shader-model'));
        return output(null);
    }
    if (model === 'post' && !MAIN_FUNCTION.test(rootText)) {
        diagnostics.push(error('Um shader de pós-processamento precisa de void main() que escreva fragColor (a imagem de entrada vem em uSceneColor e a coordenada em vUv).', 1, 'shader-model'));
    }
    if (model === 'surface' && !SURFACE_FUNCTION.test(userText)) {
        diagnostics.push(error('Um shader de superfície precisa de void surface(inout HelixSurface s): a engine a chama depois de ler os mapas do material e antes da iluminação.', 1, 'shader-model'));
    }
    if (hasErrors(diagnostics))
        return output(null);
    const pending = collectUniforms(pre.segments, model, diagnostics);
    if (hasErrors(diagnostics))
        return output(null);
    const declared = declaredNames(userBlock.text);
    let fragment: string;
    let vertex: string;
    let originOf: (physicalLine: number) => ReturnType<ShaderProgramText['originOf']>;
    if (model === 'post') {
        const program = new ShaderProgramText(true);
        program.addEngine('#version 300 es');
        program.addEngine(`#line 2 ${SHADER_SOURCE_ENGINE}`);
        program.addEngine('precision highp float;\nprecision highp int;');
        program.addEngine(standardUniformLines('post', declared));
        if (!declared.has('vUv'))
            program.addEngine('in vec2 vUv;');
        if (!USER_OUTPUT.test(userText))
            program.addEngine('out vec4 fragColor;');
        for (const helper of POST_SHADER_HELPER_FUNCTIONS) {
            if (!new RegExp(`\\b${helper.name}\\s*\\([^)]*\\)\\s*\\{`).test(userText))
                program.addEngine(helper.source);
        }
        program.addSegments(pre.segments);
        fragment = program.text;
        vertex = POST_SHADER_VERTEX;
        originOf = (line) => program.originOf(line);
    }
    else {
        fragment = meshFragmentShader(userBlock.text);
        vertex = MESH_VERTEX_SHADER;
        const start = lineOfOffset(fragment, fragment.indexOf(userBlock.text)) - 1;
        originOf = (line) => userBlock.originOf(line - start);
    }
    const validation = validateShaderProgram({ vertex, fragment, language: 'glsl', files: pre.files, originOf });
    diagnostics.push(...validation.diagnostics);
    if (!validation.available) {
        diagnostics.push({ severity: 'info', message: 'Sem WebGL2 nesta aba o shader não foi conferido pelo driver; erros de compilação aparecerão no console ao usá-lo.', line: 1, column: 1, code: 'driver-unavailable', source: SOURCE });
    }
    if (hasErrors(diagnostics))
        return output(null);
    const reflected = validation.available && validation.ok ? validation.uniforms : null;
    const reflectedNames = reflected ? new Set(reflected.map((uniform) => uniform.baseName)) : null;
    const occurrences = (name: string) => (userText.match(new RegExp(`\\b${name}\\b`, 'g')) ?? []).length;
    const uniforms = settleUniforms(pending, reflected, (declaration) => occurrences(declaration.name) > 1);
    if (reflected) {
        const known = new Set(uniforms.map((uniform) => uniform.glslName));
        for (const uniform of reflected) {
            if (known.has(uniform.baseName) || STANDARD_SHADER_UNIFORM_NAMES.has(uniform.baseName) || uniform.baseName.startsWith('u_') || uniform.baseName.startsWith('gl_'))
                continue;
            uniforms.push({ name: uniform.baseName, glslName: uniform.baseName, type: uniform.type, arraySize: uniform.size, line: 1, active: true });
        }
    }
    const helpersText = POST_SHADER_HELPER_FUNCTIONS.filter((helper) => mentions(userText, helper.name))
        .map((helper) => helper.source)
        .join('\n');
    const standard = standardInputMap(model, (spec) => spec.glslName, (name) => (reflectedNames ? reflectedNames.has(name) : mentions(userText, name) || mentions(helpersText, name)));
    diagnostics.push(...uniformDiagnostics(uniforms, 'glsl', reflected !== null));
    const budget = model === 'post' ? POST_USER_TEXTURE_UNITS : SURFACE_USER_TEXTURE_UNITS;
    const samplers = countUserSamplers(uniforms);
    if (samplers > budget) {
        diagnostics.push({ severity: 'warning', message: `O shader usa ${samplers} texturas próprias, mas o passe de ${SHADER_MODEL_LABEL[model]} só tem ${budget} unidades livres; as últimas ficarão sem textura.`, line: 1, column: 1, code: 'shader-textures', source: SOURCE });
    }
    const code = model === 'post' ? fragment : userBlock.text;
    const bundle: CompiledShaderBundle = {
        format: 'helix-shader',
        version: 2,
        language: 'glsl',
        model,
        name: input.file,
        fragment: code,
        standard,
        uniforms,
        key: shaderKey('glsl', model, code),
        readsDepth: standard.sceneDepth !== undefined,
    };
    return output(encodeShaderBundle(bundle));
}
function inferModel(rootText: string): ShaderModel | null {
    if (SURFACE_FUNCTION.test(rootText))
        return 'surface';
    if (MAIN_FUNCTION.test(rootText))
        return 'post';
    return null;
}
function collectUniforms(segments: readonly ShaderSegment[], model: ShaderModel, diagnostics: CompileDiagnostic[]): PendingUniform[] {
    const pending: PendingUniform[] = [];
    const seen = new Map<string, number>();
    for (const segment of segments) {
        const text = stripComments(segment.text);
        UNIFORM_DECLARATION.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = UNIFORM_DECLARATION.exec(text)) !== null) {
            const type = match[1];
            const lineInFile = segment.firstLine + lineOfOffset(text, match.index) - 1;
            const line = segment.file.includedAt ?? lineInFile;
            const where = segment.file.includedAt === null ? '' : `${segment.file.name}:${lineInFile}: `;
            for (const part of match[2].split(',')) {
                const declarator = DECLARATOR.exec(part.trim());
                if (!declarator)
                    continue;
                const name = declarator[1];
                const arraySize = declarator[2] ? Math.max(1, Number(declarator[2])) : 1;
                if (STANDARD_SHADER_UNIFORM_NAMES.has(name)) {
                    const spec = standardInputByGlslName(name)!;
                    if (!spec.models.includes(model)) {
                        diagnostics.push(error(`${where}"${name}" é reservado ao modelo ${SHADER_MODEL_LABEL[spec.models[0]]}; neste modelo a engine não o preenche, escolha outro nome.`, line, 'shader-uniform'));
                    }
                    else if (model === 'surface' && SURFACE_ALIASED_INPUTS.has(spec.input)) {
                        diagnostics.push(error(`${where}"${name}" já vem da engine no modelo de superfície; apague a declaração e use o nome direto.`, line, 'shader-uniform'));
                    }
                    else if (spec.glslType !== type || arraySize !== 1) {
                        diagnostics.push(error(`${where}"${name}" é ${spec.glslType} na engine: declare "uniform ${spec.glslType} ${name};" ou apague a linha, que a engine a escreve.`, line, 'shader-uniform'));
                    }
                    continue;
                }
                if (name === SURFACE_STRUCT_NAME)
                    continue;
                const previous = seen.get(name);
                if (previous !== undefined) {
                    diagnostics.push(error(`${where}"${name}" já foi declarado na linha ${previous}.`, line, 'shader-uniform'));
                    continue;
                }
                seen.set(name, line);
                if (!isSettableUniformType(type) && /^[A-Z]/.test(type)) {
                    diagnostics.push({ severity: 'warning', message: `${where}"${name}" é um struct (${type}); uniforms.set não preenche structs, declare os campos como uniformes soltos.`, line, column: 1, code: 'shader-uniform', source: SOURCE });
                    continue;
                }
                pending.push({ name, glslName: name, type, arraySize, line });
            }
        }
    }
    return pending;
}
function error(message: string, line: number, code: string): CompileDiagnostic {
    return { severity: 'error', message, line, column: 1, code, source: SOURCE };
}
function hasErrors(diagnostics: readonly CompileDiagnostic[]): boolean {
    return diagnostics.some((diagnostic) => diagnostic.severity === 'error');
}
