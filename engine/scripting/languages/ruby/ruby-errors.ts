import { ForeignScriptError, stripLocationPrefix } from '../foreign-values';
import type { ForeignLocation } from '../language-engine';
export interface RubyFailure {
    readonly message: string;
    readonly name: string;
    readonly frames: ReadonlyArray<readonly [
        string,
        number,
        string
    ]>;
}
export const RUBY_ERROR_NAME = 'Erro de Ruby';
export function isRubyFailure(value: unknown): value is RubyFailure {
    if (!value || typeof value !== 'object')
        return false;
    const record = value as Record<string, unknown>;
    return typeof record.message === 'string' && Array.isArray(record.frames);
}
export function rubyScriptError(failure: RubyFailure, assetIdOfFile: (file: string) => string | null): ForeignScriptError {
    const frames = failure.frames.filter((frame) => Array.isArray(frame) && typeof frame[0] === 'string');
    const first = frames[0];
    const origin: ForeignLocation | null = first ? { file: first[0], line: Number(first[1]) || 0, assetId: assetIdOfFile(first[0]), functionName: first[2] || null } : null;
    const message = origin ? stripLocationPrefix(failure.message, origin.file) : failure.message;
    const traceback = frames.map(([file, line, fn]) => (fn ? `  em ${fn} (${file}:${line})` : `  em ${file}:${line}`)).join('\n');
    const name = typeof failure.name === 'string' && failure.name && failure.name !== 'HelixError' ? failure.name : RUBY_ERROR_NAME;
    return new ForeignScriptError(message, name, origin, traceback || null);
}
