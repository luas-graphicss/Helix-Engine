import { ForeignScriptError } from '../foreign-values';
import type { ForeignLocation } from '../language-engine';
import { PHP_SCRIPT_DIR } from './php-prelude';
export type PhpFrame = readonly [
    path: string,
    line: number,
    functionName: string
];
export interface PhpFailure {
    readonly message: string;
    readonly name: string;
    readonly frames: readonly PhpFrame[];
}
export function isPhpFailure(value: unknown): value is PhpFailure {
    if (!value || typeof value !== 'object')
        return false;
    const record = value as Record<string, unknown>;
    return typeof record.message === 'string' && typeof record.name === 'string' && Array.isArray(record.frames);
}
export function scriptFileOfPath(path: string): string {
    return path.startsWith(PHP_SCRIPT_DIR) ? path.slice(PHP_SCRIPT_DIR.length) : path;
}
export function phpScriptError(failure: PhpFailure, assetIdOfFile: (file: string) => string | null): ForeignScriptError {
    const frames = failure.frames.filter((frame) => Array.isArray(frame) && typeof frame[0] === 'string').map((frame) => ({ file: scriptFileOfPath(frame[0]), line: Number(frame[1]) || 0, functionName: frame[2] || null }));
    const innermost = frames[frames.length - 1];
    const location: ForeignLocation | null = innermost ? { file: innermost.file, line: innermost.line, assetId: assetIdOfFile(innermost.file), functionName: innermost.functionName } : null;
    const traceback = frames
        .slice()
        .reverse()
        .map((frame) => (frame.functionName ? `  em ${frame.functionName} (${frame.file}:${frame.line})` : `  em ${frame.file}:${frame.line}`))
        .join('\n');
    return new ForeignScriptError(failure.message, failure.name || 'Erro de PHP', location, traceback || null);
}
