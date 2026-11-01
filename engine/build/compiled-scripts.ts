import type { CompiledScript } from '@/engine/scripting/compiler/compile-types';
export const COMPILED_SCRIPTS_FORMAT = 'helix-compiled-scripts';
export const COMPILED_SCRIPTS_VERSION = 1;
export interface SerializedCompiledScript extends Omit<CompiledScript, 'artifact'> {
    readonly artifact: string | null;
}
export interface CompiledScriptsDocument {
    readonly format: typeof COMPILED_SCRIPTS_FORMAT;
    readonly version: number;
    readonly buildId: string;
    readonly compiledAt: number;
    readonly scripts: readonly SerializedCompiledScript[];
}
function bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    const chunk = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunk)
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
    return btoa(binary);
}
function base64ToBytes(text: string): Uint8Array {
    const binary = atob(text);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++)
        bytes[index] = binary.charCodeAt(index);
    return bytes;
}
export function serializeCompiledScripts(buildId: string, scripts: readonly CompiledScript[]): CompiledScriptsDocument {
    return {
        format: COMPILED_SCRIPTS_FORMAT,
        version: COMPILED_SCRIPTS_VERSION,
        buildId,
        compiledAt: Date.now(),
        scripts: scripts.map((script) => ({ ...script, artifact: script.artifact ? bytesToBase64(script.artifact) : null })),
    };
}
export function deserializeCompiledScripts(input: unknown): CompiledScript[] {
    const document = input as Partial<CompiledScriptsDocument> | null;
    if (!document || document.format !== COMPILED_SCRIPTS_FORMAT || !Array.isArray(document.scripts)) {
        throw new Error('Os scripts pré-compilados do jogo estão num formato desconhecido.');
    }
    if ((document.version ?? 0) > COMPILED_SCRIPTS_VERSION)
        throw new Error('Os scripts foram compilados por uma versão mais nova da engine.');
    return document.scripts.map((script) => ({ ...script, artifact: script.artifact ? base64ToBytes(script.artifact) : null }));
}
