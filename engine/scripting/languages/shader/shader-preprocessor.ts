import { SHADER_MODELS, SHADER_SOURCE_ENGINE, SHADER_SOURCE_FIRST_INCLUDE, SHADER_SOURCE_USER, type ShaderModel } from '@/engine/renderer/shaders/custom/custom-shader.glsl';
import type { CompileDiagnostic } from '../../compiler/compile-types';
import { closestName } from '../../compiler/script-compiler';
import type { ForeignCompileInput, ForeignSibling } from '../language-engine';
import { findGlslChunk, GLSL_CHUNK_NOTES, GLSL_CHUNKS } from './glsl-chunks';
export type ShaderLanguage = 'glsl' | 'wgsl';
export const SHADER_DIAGNOSTIC_SOURCE: Record<ShaderLanguage, string> = { glsl: 'GLSL', wgsl: 'WGSL' };
export interface ShaderSourceFile {
    readonly index: number;
    readonly name: string;
    readonly assetId: string | null;
    readonly includedAt: number | null;
}
export interface ShaderSegment {
    readonly file: ShaderSourceFile;
    readonly firstLine: number;
    readonly text: string;
}
export interface ShaderOrigin {
    readonly file: ShaderSourceFile;
    readonly line: number;
}
export interface PreprocessedShader {
    readonly model: ShaderModel | null;
    readonly segments: readonly ShaderSegment[];
    readonly files: readonly ShaderSourceFile[];
    readonly dependencies: readonly string[];
    readonly diagnostics: readonly CompileDiagnostic[];
    readonly rootText: string;
}
const INCLUDE = /^\s*#\s*include\s+(?:<([^>]+)>|"([^"]+)")\s*(?:\/\/.*)?$/;
const PRAGMA = /^\s*#\s*pragma\s+helix\b\s*(.*?)\s*$/;
const VERSION = /^\s*#\s*version\b\s*(.*?)\s*$/;
const SHADER_EXTENSION = /\.(glsl|frag|vert|wgsl)$/i;
export function preprocessShader(input: ForeignCompileInput, language: ShaderLanguage): PreprocessedShader {
    const diagnostics: CompileDiagnostic[] = [];
    const dependencies: string[] = [];
    const segments: ShaderSegment[] = [];
    const root: ShaderSourceFile = { index: SHADER_SOURCE_USER, name: input.file, assetId: input.assetId, includedAt: null };
    const files: ShaderSourceFile[] = [root, { index: SHADER_SOURCE_ENGINE, name: 'engine', assetId: null, includedAt: null }];
    const included = new Set<string>();
    const stack: string[] = [];
    let nextIndex = SHADER_SOURCE_FIRST_INCLUDE;
    let model: ShaderModel | null = null;
    const rootLines = input.source.split('\n');
    const source = SHADER_DIAGNOSTIC_SOURCE[language];
    const report = (severity: CompileDiagnostic['severity'], message: string, line: number, code: string) => {
        diagnostics.push({ severity, message, line, column: 1, code, source });
    };
    const walk = (file: ShaderSourceFile, text: string, isRoot: boolean, rootLine: number): void => {
        const lines = text.split('\n');
        let buffer: string[] = [];
        let bufferStart = 1;
        const flush = (endLine: number) => {
            if (buffer.length > 0)
                segments.push({ file, firstLine: bufferStart, text: buffer.join('\n') });
            buffer = [];
            bufferStart = endLine + 1;
        };
        for (let index = 0; index < lines.length; index++) {
            const lineNumber = index + 1;
            const line = lines[index];
            const atLine = isRoot ? lineNumber : rootLine;
            const include = INCLUDE.exec(line);
            if (include) {
                const chunkName = include[1];
                const fileName = include[2];
                if (isRoot)
                    rootLines[index] = '';
                flush(lineNumber);
                if (chunkName !== undefined) {
                    if (language === 'wgsl') {
                        report('error', `Os chunks da engine são GLSL; em WGSL inclua só outros arquivos .wgsl da biblioteca ("Nome").`, atLine, 'shader-include');
                        continue;
                    }
                    const chunk = findGlslChunk(chunkName.trim());
                    if (!chunk) {
                        const note = GLSL_CHUNK_NOTES[chunkName.trim()];
                        const suggestion = closestName(chunkName.trim(), GLSL_CHUNKS.map((entry) => entry.name));
                        const available = GLSL_CHUNKS.map((entry) => `<${entry.name}>`).join(', ');
                        report('error', note ? `O chunk <${chunkName}> não se inclui: ${note}` : `Chunk <${chunkName}> não existe.${suggestion ? ` Você quis dizer <${suggestion}>?` : ''} Disponíveis: ${available}.`, atLine, 'shader-include');
                        continue;
                    }
                    const key = `<${chunk.name}>`;
                    if (included.has(key))
                        continue;
                    included.add(key);
                    const chunkFile: ShaderSourceFile = { index: nextIndex++, name: key, assetId: null, includedAt: atLine };
                    files.push(chunkFile);
                    segments.push({ file: chunkFile, firstLine: 1, text: chunk.source });
                    continue;
                }
                const requested = fileName.trim().replace(/^\.?\//, '');
                const name = requested.replace(SHADER_EXTENSION, '');
                const sibling = findSibling(input.siblings ?? [], name);
                if (!sibling) {
                    const suggestion = closestName(name, (input.siblings ?? []).map((entry) => entry.name));
                    report('error', `Shader "${requested}" não encontrado na biblioteca${language === 'glsl' ? ' (só arquivos GLSL entram por #include)' : ''}.${suggestion ? ` Você quis dizer "${suggestion}"?` : ''}`, atLine, 'unresolved-include');
                    continue;
                }
                if (sibling.assetId === input.assetId) {
                    report('error', `"${input.name}" inclui a si mesmo.`, atLine, 'self-include');
                    continue;
                }
                if (stack.includes(sibling.assetId)) {
                    report('error', `Inclusão circular: ${[...stack.map((id) => nameOf(id)), sibling.name].join(' → ')}.`, atLine, 'circular-include');
                    continue;
                }
                if (!dependencies.includes(sibling.name))
                    dependencies.push(sibling.name);
                if (included.has(sibling.assetId))
                    continue;
                included.add(sibling.assetId);
                const siblingFile: ShaderSourceFile = { index: nextIndex++, name: sibling.file, assetId: sibling.assetId, includedAt: atLine };
                files.push(siblingFile);
                stack.push(sibling.assetId);
                walk(siblingFile, sibling.source, false, atLine);
                stack.pop();
                continue;
            }
            const pragma = PRAGMA.exec(line);
            if (pragma) {
                if (isRoot)
                    rootLines[index] = '';
                buffer.push('');
                const declared = /^(?:model\s*\(\s*(\w+)\s*\)|(\w+))$/.exec(pragma[1]);
                const value = declared ? (declared[1] ?? declared[2]) : null;
                if (!value || !(SHADER_MODELS as readonly string[]).includes(value)) {
                    report('warning', `Pragma desconhecido "#pragma helix ${pragma[1]}". Use #pragma helix model(post) ou #pragma helix model(surface).`, atLine, 'shader-pragma');
                }
                else if (!isRoot) {
                    report('warning', `O modelo do shader vem do ativo principal; o #pragma em ${file.name} foi ignorado.`, atLine, 'shader-pragma');
                }
                else if (model && model !== value) {
                    report('error', `O shader declara dois modelos (${model} e ${value}).`, atLine, 'shader-pragma');
                }
                else {
                    model = value as ShaderModel;
                }
                continue;
            }
            const version = VERSION.exec(line);
            if (version) {
                if (isRoot)
                    rootLines[index] = '';
                buffer.push('');
                if (language === 'wgsl') {
                    report('error', 'WGSL não tem #version; apague a linha.', atLine, 'shader-version');
                }
                else if (version[1].replace(/\s+/g, ' ') !== '300 es') {
                    report('error', `Só GLSL ES 3.00 roda no WebGL2: troque "#version ${version[1]}" por "#version 300 es" (ou apague a linha, que a engine a escreve).`, atLine, 'shader-version');
                }
                continue;
            }
            buffer.push(line);
        }
        flush(lines.length);
    };
    const nameOf = (assetId: string): string => (input.siblings ?? []).find((entry) => entry.assetId === assetId)?.name ?? assetId;
    walk(root, input.source, true, 0);
    return { model, segments, files, dependencies, diagnostics, rootText: rootLines.join('\n') };
}
function findSibling(siblings: readonly ForeignSibling[], name: string): ForeignSibling | null {
    const exact = siblings.find((entry) => entry.name === name || entry.file === name);
    if (exact)
        return exact;
    const lower = name.toLowerCase();
    return siblings.find((entry) => entry.name.toLowerCase() === lower || entry.file.toLowerCase() === lower) ?? null;
}
export class ShaderProgramText {
    private readonly lines: string[] = [];
    private readonly origins: Array<ShaderOrigin | null> = [];
    constructor(private readonly lineDirectives: boolean) { }
    addEngine(text: string): this {
        for (const line of text.split('\n')) {
            this.lines.push(line);
            this.origins.push(null);
        }
        return this;
    }
    addSegment(segment: ShaderSegment): this {
        if (this.lineDirectives) {
            this.lines.push(`#line ${segment.firstLine} ${segment.file.index}`);
            this.origins.push(null);
        }
        const lines = segment.text.split('\n');
        for (let index = 0; index < lines.length; index++) {
            this.lines.push(lines[index]);
            this.origins.push({ file: segment.file, line: segment.firstLine + index });
        }
        return this;
    }
    addSegments(segments: readonly ShaderSegment[]): this {
        for (const segment of segments)
            this.addSegment(segment);
        return this;
    }
    get text(): string {
        return this.lines.join('\n');
    }
    get lineCount(): number {
        return this.lines.length;
    }
    originOf(physicalLine: number): ShaderOrigin | null {
        return this.origins[physicalLine - 1] ?? null;
    }
}
export function stripComments(text: string): string {
    return text.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' ')).replace(/\/\/[^\n]*/g, '');
}
export function lineOfOffset(text: string, offset: number): number {
    let line = 1;
    for (let index = 0; index < offset && index < text.length; index++)
        if (text.charCodeAt(index) === 10)
            line++;
    return line;
}
export function diagnosticAt(origin: ShaderOrigin | null, severity: CompileDiagnostic['severity'], message: string, language: ShaderLanguage, code: string): CompileDiagnostic {
    const source = SHADER_DIAGNOSTIC_SOURCE[language];
    if (!origin)
        return { severity, message: `${message} (no código da engine; se o seu shader não o explica, é um problema da engine)`, line: 1, column: 1, code, source };
    if (origin.file.includedAt === null)
        return { severity, message, line: origin.line, column: 1, code, source };
    return { severity, message: `${origin.file.name}:${origin.line}: ${message}`, line: origin.file.includedAt, column: 1, code, source };
}
