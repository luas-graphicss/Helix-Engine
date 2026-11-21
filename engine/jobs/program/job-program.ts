import type { JobArray } from '../memory/job-buffer';
import type { JobRange } from '../protocol/job-messages';
import type { JobToolkit } from './job-toolkit';
export interface JobProgram {
    readonly id: number;
    readonly source: string;
}
export interface JobContext extends JobToolkit, JobRange {
    readonly thread: number;
    readonly output: JobArray;
}
export type JobFunction = (input: unknown, job: JobContext) => unknown;
export class JobProgramError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = 'JobProgramError';
    }
}
const BLOCKED_GLOBALS = ['helix', 'self', 'globalThis', 'window', 'document', 'navigator', 'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'BroadcastChannel', 'importScripts', 'postMessage', 'close', 'indexedDB', 'caches', 'localStorage', 'sessionStorage', 'Worker', 'SharedWorker'] as const;
const NATIVE_MARKER = '[native code]';
const CLASS_START = /^class\b/;
const FUNCTION_START = /^(?:async\s+)?(?:function\b|\(|[A-Za-z_$][\w$]*\s*=>)/;
const METHOD_PREFIX = /^(async\s+)?(\*\s*)?/;
function blockedGlobal(name: string): object {
    const fail = (): never => {
        throw new JobProgramError(`${name} não existe dentro de um job: ele roda em outra thread e só enxerga os argumentos input e job.`);
    };
    return new Proxy(fail, { get: fail, set: fail, has: fail, apply: fail, construct: fail });
}
const BLOCKED_VALUES = BLOCKED_GLOBALS.map(blockedGlobal);
export function compileJobProgram(source: string): JobFunction {
    let compiled: unknown;
    try {
        const factory = new Function(...BLOCKED_GLOBALS, `"use strict";\nreturn (${source}\n);`);
        compiled = factory(...BLOCKED_VALUES);
    }
    catch (cause) {
        const detail = cause instanceof Error ? cause.message : String(cause);
        throw new JobProgramError(`O código do job não pôde ser compilado: ${detail}`, { cause });
    }
    if (typeof compiled !== 'function')
        throw new JobProgramError('O código do job precisa ser uma função.');
    return compiled as JobFunction;
}
export function describeJobFunction(fn: (...args: never[]) => unknown): string {
    const source = Function.prototype.toString.call(fn).trim();
    if (source.includes(NATIVE_MARKER))
        throw new JobProgramError('Funções nativas ou de outra linguagem não rodam em jobs: escreva o job como uma função JavaScript ou TypeScript.');
    if (CLASS_START.test(source))
        throw new JobProgramError('Uma classe não pode ser usada como job: passe uma função.');
    if (FUNCTION_START.test(source))
        return source;
    return source.replace(METHOD_PREFIX, (_match, asyncPrefix = '', generatorMark = '') => `${asyncPrefix}function${generatorMark ? '*' : ''} `);
}
