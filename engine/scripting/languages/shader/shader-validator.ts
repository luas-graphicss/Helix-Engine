import type { GL } from '@/engine/renderer/gl/context';
import { reflectUniforms, type ReflectedUniform } from '@/engine/renderer/gl/program-reflection';
import { SHADER_SOURCE_ENGINE } from '@/engine/renderer/shaders/custom/custom-shader.glsl';
import type { CompileDiagnostic } from '../../compiler/compile-types';
import { diagnosticAt, type ShaderLanguage, type ShaderOrigin, type ShaderSourceFile } from './shader-preprocessor';
export interface ShaderValidationInput {
    readonly vertex: string;
    readonly fragment: string;
    readonly language: ShaderLanguage;
    readonly files: readonly ShaderSourceFile[];
    readonly originOf: (physicalLine: number) => ShaderOrigin | null;
    readonly logicalOrigin?: (file: ShaderSourceFile, line: number) => ShaderOrigin | null;
    readonly annotate?: (message: string, fileIndex: number, reportedLine: number) => string;
}
export interface ShaderValidationResult {
    readonly available: boolean;
    readonly ok: boolean;
    readonly diagnostics: readonly CompileDiagnostic[];
    readonly uniforms: readonly ReflectedUniform[];
    readonly shadingLanguage: string | null;
}
interface LineDirectiveSupport {
    readonly honored: boolean;
    readonly bias: number;
}
const LOG_LINE = /^(ERROR|WARNING):\s*(\d+):(\d+):\s*(.*)$/;
let context: GL | null | undefined;
let lineSupport: LineDirectiveSupport | null = null;
export function validateShaderProgram(input: ShaderValidationInput): ShaderValidationResult {
    const gl = validationContext();
    if (!gl)
        return { available: false, ok: true, diagnostics: [], uniforms: [], shadingLanguage: null };
    const shadingLanguage = String(gl.getParameter(gl.SHADING_LANGUAGE_VERSION) ?? '');
    const support = (lineSupport ??= probeLineDirectives(gl));
    const diagnostics: CompileDiagnostic[] = [];
    let uniforms: ReflectedUniform[] = [];
    const vertex = compileStage(gl, gl.VERTEX_SHADER, input.vertex);
    const fragment = compileStage(gl, gl.FRAGMENT_SHADER, input.fragment);
    let ok = vertex.ok && fragment.ok;
    if (!vertex.ok)
        diagnostics.push({ severity: 'error', message: `O vértice da engine não compilou: ${firstLogLine(vertex.log)}`, line: 1, column: 1, code: 'driver', source: 'GLSL' });
    for (const diagnostic of mapLog(fragment.log, input, support))
        diagnostics.push(diagnostic);
    if (ok && vertex.shader && fragment.shader) {
        const program = gl.createProgram();
        if (program) {
            gl.attachShader(program, vertex.shader);
            gl.attachShader(program, fragment.shader);
            gl.linkProgram(program);
            if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
                uniforms = reflectUniforms(gl, program);
            }
            else {
                ok = false;
                const log = gl.getProgramInfoLog(program) ?? '';
                const mapped = mapLog(log, input, support);
                if (mapped.length > 0)
                    diagnostics.push(...mapped);
                else
                    diagnostics.push({ severity: 'error', message: `O driver não ligou o programa: ${firstLogLine(log) || 'sem detalhes no log'}.`, line: 1, column: 1, code: 'driver-link', source: input.language.toUpperCase() });
            }
            gl.deleteProgram(program);
        }
    }
    if (vertex.shader)
        gl.deleteShader(vertex.shader);
    if (fragment.shader)
        gl.deleteShader(fragment.shader);
    if (!ok && diagnostics.every((diagnostic) => diagnostic.severity !== 'error')) {
        diagnostics.push({ severity: 'error', message: `O driver recusou o shader sem apontar a linha: ${firstLogLine(fragment.log) || 'sem detalhes no log'}.`, line: 1, column: 1, code: 'driver', source: input.language.toUpperCase() });
    }
    return { available: true, ok, diagnostics, uniforms, shadingLanguage };
}
function mapLog(log: string, input: ShaderValidationInput, support: LineDirectiveSupport): CompileDiagnostic[] {
    const diagnostics: CompileDiagnostic[] = [];
    const seen = new Set<string>();
    for (const raw of log.split('\n')) {
        const line = raw.trim();
        if (!line)
            continue;
        const match = LOG_LINE.exec(line);
        if (!match) {
            if (/^ERROR\b/i.test(line) || /^WARNING\b/i.test(line)) {
                const severity = /^ERROR/i.test(line) ? 'error' : 'warning';
                const message = line.replace(/^(ERROR|WARNING):\s*/i, '');
                if (!seen.has(message)) {
                    seen.add(message);
                    diagnostics.push({ severity, message: polish(message), line: 1, column: 1, code: 'driver', source: input.language.toUpperCase() });
                }
            }
            continue;
        }
        const severity = match[1] === 'ERROR' ? 'error' : 'warning';
        const fileIndex = Number(match[2]);
        const reportedLine = Number(match[3]);
        const polished = polish(match[4]);
        const message = input.annotate ? input.annotate(polished, fileIndex, reportedLine) : polished;
        const origin = locate(input, support, fileIndex, reportedLine);
        const key = `${origin?.file.index ?? -1}:${origin?.line ?? 0}:${message}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        diagnostics.push(diagnosticAt(origin, severity, message, input.language, 'driver'));
    }
    return diagnostics;
}
function locate(input: ShaderValidationInput, support: LineDirectiveSupport, fileIndex: number, reportedLine: number): ShaderOrigin | null {
    if (!support.honored)
        return input.originOf(reportedLine);
    const file = input.files.find((entry) => entry.index === fileIndex);
    if (!file || file.index === SHADER_SOURCE_ENGINE)
        return null;
    const line = Math.max(1, reportedLine - support.bias);
    if (input.logicalOrigin)
        return input.logicalOrigin(file, line);
    return { file, line };
}
function polish(message: string): string {
    return message
        .replace(/\s+:\s+/g, ': ')
        .replace(/\s+$/, '')
        .replace(/^'(\w+)': redefinition$/, (_, name: string) => `'${name}': redefinição (o nome já existe no programa; no modelo "surface" os nomes do fragmento da engine também contam, renomeie)`);
}
function firstLogLine(log: string): string {
    return (log.split('\n').find((line) => line.trim().length > 0) ?? '').trim();
}
function compileStage(gl: GL, type: number, source: string): {
    ok: boolean;
    log: string;
    shader: WebGLShader | null;
} {
    const shader = gl.createShader(type);
    if (!shader)
        return { ok: false, log: 'createShader retornou null', shader: null };
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    const ok = Boolean(gl.getShaderParameter(shader, gl.COMPILE_STATUS));
    const log = gl.getShaderInfoLog(shader) ?? '';
    return { ok, log, shader };
}
function probeLineDirectives(gl: GL): LineDirectiveSupport {
    const probe = compileStage(gl, gl.FRAGMENT_SHADER, '#version 300 es\nprecision highp float;\nout vec4 o;\n#line 200 7\nvoid main() { o = helixProbeUndefined; }\n');
    if (probe.shader)
        gl.deleteShader(probe.shader);
    for (const raw of probe.log.split('\n')) {
        const match = LOG_LINE.exec(raw.trim());
        if (!match)
            continue;
        const fileIndex = Number(match[2]);
        const line = Number(match[3]);
        if (fileIndex === 7 && (line === 200 || line === 201))
            return { honored: true, bias: line - 200 };
        return { honored: false, bias: 0 };
    }
    return { honored: false, bias: 0 };
}
export function shadingLanguageVersion(): string | null {
    const gl = validationContext();
    if (!gl)
        return null;
    const version = String(gl.getParameter(gl.SHADING_LANGUAGE_VERSION) ?? '').trim();
    return version.length > 0 ? version : null;
}
function validationContext(): GL | null {
    if (context !== undefined)
        return context;
    context = null;
    try {
        const attributes: WebGLContextAttributes = { antialias: false, depth: false, stencil: false, alpha: false, preserveDrawingBuffer: false, powerPreference: 'low-power' };
        if (typeof OffscreenCanvas !== 'undefined') {
            context = (new OffscreenCanvas(1, 1).getContext('webgl2', attributes) as GL | null) ?? null;
        }
        if (!context && typeof document !== 'undefined') {
            context = (document.createElement('canvas').getContext('webgl2', attributes) as GL | null) ?? null;
        }
    }
    catch {
        context = null;
    }
    return context;
}
