import { DEFAULT_SCRIPT_LANGUAGE, scriptExtension, scriptLanguage, type ScriptLanguageId } from './script-languages';
export type ScriptRunContext = 'shared' | 'client' | 'server';
export const SCRIPT_RUN_CONTEXTS: readonly ScriptRunContext[] = ['shared', 'client', 'server'];
export const SCRIPT_RUN_CONTEXT_LABEL: Record<ScriptRunContext, string> = {
    shared: 'Compartilhado',
    client: 'Cliente',
    server: 'Servidor',
};
export const SCRIPT_RUN_CONTEXT_DESCRIPTION: Record<ScriptRunContext, string> = {
    shared: 'Roda onde for preciso; a engine decide pelo que o código usa.',
    client: 'Roda só na máquina de cada jogador: câmera, interface e entrada.',
    server: 'Roda só com autoridade: regras, pontuação e estado compartilhado.',
};
export const SCRIPT_FORMAT_VERSION = 1;
export interface ScriptDocument {
    readonly version: number;
    readonly name: string;
    readonly language: ScriptLanguageId;
    readonly source: string;
    readonly runContext: ScriptRunContext;
    readonly entry: boolean;
    readonly createdAt: number;
}
export interface CreateScriptDocumentOptions {
    name?: string;
    language?: ScriptLanguageId;
    source?: string;
    runContext?: ScriptRunContext;
    entry?: boolean;
}
export function createScriptDocument(options: CreateScriptDocumentOptions = {}): ScriptDocument {
    return {
        version: SCRIPT_FORMAT_VERSION,
        name: options.name?.trim() || 'Script',
        language: options.language ?? DEFAULT_SCRIPT_LANGUAGE,
        source: options.source ?? '',
        runContext: options.runContext ?? 'shared',
        entry: options.entry ?? false,
        createdAt: Date.now(),
    };
}
export function isScriptRunContext(value: unknown): value is ScriptRunContext {
    return typeof value === 'string' && (SCRIPT_RUN_CONTEXTS as readonly string[]).includes(value);
}
export function countScriptLines(source: string): number {
    if (source.length === 0)
        return 1;
    let lines = 1;
    for (let index = 0; index < source.length; index++)
        if (source.charCodeAt(index) === 10)
            lines++;
    return lines;
}
export function scriptByteLength(source: string): number {
    return new TextEncoder().encode(source).byteLength;
}
export function scriptFileName(name: string, language: ScriptLanguageId): string {
    const safe = name.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ') || 'Script';
    return `${safe}.${scriptExtension(language)}`;
}
export function scriptMimeType(language: ScriptLanguageId): string {
    return scriptLanguage(language).mimeType;
}
