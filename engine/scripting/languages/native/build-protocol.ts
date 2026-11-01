import type { CompileDiagnostic } from '../../compiler/compile-types';
export type NativeBuildLanguage = 'rust' | 'go' | 'zig' | 'java' | 'kotlin' | 'swift' | 'dart' | 'haxe';
export const NATIVE_BUILD_LANGUAGES: readonly NativeBuildLanguage[] = ['rust', 'go', 'zig', 'java', 'kotlin', 'swift', 'dart', 'haxe'];
export function isNativeBuildLanguage(value: string): value is NativeBuildLanguage {
    return (NATIVE_BUILD_LANGUAGES as readonly string[]).includes(value);
}
export const BUILD_ENDPOINT = '/api/build';
export interface NativeBuildSibling {
    readonly file: string;
    readonly source: string;
}
export interface NativeBuildRequest {
    readonly language: NativeBuildLanguage;
    readonly file: string;
    readonly source: string;
    readonly siblings?: readonly NativeBuildSibling[];
}
export const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
export const MAX_SIBLINGS = 256;
export type NativeArtifactKind = 'wasm' | 'js';
export interface NativeArtifactInfo {
    readonly kind: NativeArtifactKind;
    readonly sourceMap?: string;
}
export interface NativeBuildMeta {
    readonly ok: boolean;
    readonly diagnostics: readonly CompileDiagnostic[];
    readonly artifact: NativeArtifactInfo | null;
    readonly toolchain: string;
    readonly durationMs: number;
    readonly cached: boolean;
}
export interface NativeToolchainStatus {
    readonly language: NativeBuildLanguage;
    readonly available: boolean;
    readonly version: string | null;
    readonly detail: string;
}
export interface NativeBuildStatus {
    readonly toolchains: readonly NativeToolchainStatus[];
}
export const BUILD_ENVELOPE_CONTENT_TYPE = 'application/vnd.helix.build';
export function encodeBuildEnvelope(meta: NativeBuildMeta, artifact: Uint8Array | null): Uint8Array {
    const json = new TextEncoder().encode(JSON.stringify(meta));
    const out = new Uint8Array(4 + json.length + (artifact?.length ?? 0));
    new DataView(out.buffer).setUint32(0, json.length, true);
    out.set(json, 4);
    if (artifact)
        out.set(artifact, 4 + json.length);
    return out;
}
export function decodeBuildEnvelope(buffer: ArrayBuffer): {
    meta: NativeBuildMeta;
    artifact: Uint8Array | null;
} {
    if (buffer.byteLength < 4)
        throw new Error('resposta do serviço de build truncada.');
    const length = new DataView(buffer).getUint32(0, true);
    if (4 + length > buffer.byteLength)
        throw new Error('resposta do serviço de build corrompida.');
    const meta = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 4, length))) as NativeBuildMeta;
    const rest = buffer.byteLength - 4 - length;
    const artifact = meta.artifact && rest > 0 ? new Uint8Array(buffer.slice(4 + length)) : null;
    return { meta, artifact };
}
export function validateBuildRequest(value: unknown): string | null {
    if (typeof value !== 'object' || value === null)
        return 'o pedido precisa ser um objeto JSON.';
    const request = value as Partial<NativeBuildRequest>;
    if (typeof request.language !== 'string' || !isNativeBuildLanguage(request.language))
        return `linguagem inválida: ${String(request.language)}.`;
    if (typeof request.file !== 'string' || !/^[^\\/\0]+\.[A-Za-z0-9]+$/.test(request.file))
        return 'o nome do arquivo precisa ser um nome simples com extensão.';
    if (typeof request.source !== 'string')
        return 'o fonte precisa ser texto.';
    if (request.source.length > MAX_SOURCE_BYTES)
        return `o fonte passa do limite de ${MAX_SOURCE_BYTES} bytes.`;
    if (request.siblings !== undefined) {
        if (!Array.isArray(request.siblings))
            return 'siblings precisa ser uma lista.';
        if (request.siblings.length > MAX_SIBLINGS)
            return `há mais de ${MAX_SIBLINGS} scripts irmãos.`;
        for (const sibling of request.siblings) {
            if (typeof sibling !== 'object' || sibling === null)
                return 'cada script irmão precisa ser um objeto.';
            const entry = sibling as Partial<NativeBuildSibling>;
            if (typeof entry.file !== 'string' || !/^[^\\/\0]+\.[A-Za-z0-9]+$/.test(entry.file))
                return 'o nome de um script irmão é inválido.';
            if (typeof entry.source !== 'string' || entry.source.length > MAX_SOURCE_BYTES)
                return 'o fonte de um script irmão é inválido ou grande demais.';
        }
    }
    return null;
}
