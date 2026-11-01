import { ForeignScriptError } from '../foreign-values';
import type { ForeignLocation } from '../language-engine';
export type PythonFrame = readonly [
    file: string,
    line: number,
    functionName: string
];
export interface PythonFailure {
    readonly message: string;
    readonly name: string;
    readonly frames: readonly PythonFrame[];
}
const MODULE_FRAME = '<module>';
export function isPythonFailure(value: unknown): value is PythonFailure {
    if (!value || typeof value !== 'object')
        return false;
    const record = value as Record<string, unknown>;
    return typeof record.message === 'string' && typeof record.name === 'string' && Array.isArray(record.frames);
}
export function pythonScriptError(failure: PythonFailure, assetIdOfFile: (file: string) => string | null): ForeignScriptError {
    const frames = failure.frames.filter((frame) => Array.isArray(frame) && typeof frame[0] === 'string');
    const innermost = frames[frames.length - 1];
    const location: ForeignLocation | null = innermost
        ? { file: innermost[0], line: Number(innermost[1]) || 0, assetId: assetIdOfFile(innermost[0]), functionName: functionNameOf(innermost[2]) }
        : null;
    const traceback = frames
        .slice()
        .reverse()
        .map((frame) => {
        const functionName = functionNameOf(frame[2]);
        return functionName ? `  em ${functionName} (${frame[0]}:${frame[1]})` : `  em ${frame[0]}:${frame[1]}`;
    })
        .join('\n');
    return new ForeignScriptError(failure.message, failure.name || 'Erro de Python', location, traceback || null);
}
function functionNameOf(name: string | undefined): string | null {
    return name && name !== MODULE_FRAME ? name : null;
}
