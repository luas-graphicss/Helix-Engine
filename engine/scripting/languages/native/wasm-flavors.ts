import { wasmTraceback, type CrashReport, type WasmFlavor } from '../c/c-game';
import type { ForeignLocation } from '../language-engine';
const RUST_PANIC = /^thread '([^']*)'(?: \(\d+\))? panicked at (.+?):(\d+):(\d+):?$/;
const RUST_PANIC_LEGACY = /^thread '([^']*)'(?: \(\d+\))? panicked at '(.*)', (.+?):(\d+):(\d+)$/;
const RUST_NOTE = /^(note: run with `RUST_BACKTRACE=1`|stack backtrace:$)/;
export const RUST_FLAVOR: WasmFlavor = {
    errorName: () => 'Erro de Rust',
    captureStderr: true,
    describeTrap(message) {
        const lower = message.toLowerCase();
        if (lower.includes('unreachable'))
            return 'o script abortou (panic sem relatório ou abort explícito).';
        if (lower.includes('out of bounds'))
            return 'acesso à memória fora dos limites: código unsafe com ponteiro inválido ou estouro de pilha.';
        if (lower.includes('divide by zero'))
            return 'divisão inteira por zero.';
        if (lower.includes('integer overflow') || lower.includes('invalid conversion'))
            return 'conversão de ponto flutuante para inteiro fora do intervalo.';
        if (lower.includes('indirect call') || lower.includes('signature mismatch'))
            return 'chamada por ponteiro de função com assinatura errada.';
        if (lower.includes('stack'))
            return 'estouro de pilha: recursão sem fim ou estruturas locais grandes demais.';
        return `falha do WebAssembly: ${message}`;
    },
    parseCrash(stderr, { file }) {
        for (let index = 0; index < stderr.length; index++) {
            const line = stderr[index];
            const legacy = RUST_PANIC_LEGACY.exec(line);
            if (legacy) {
                return { message: legacy[2], location: locate(file, legacy[3], legacy[4], legacy[5]), traceback: rustTraceback(stderr, index) };
            }
            const modern = RUST_PANIC.exec(line);
            if (!modern)
                continue;
            const message: string[] = [];
            for (let cursor = index + 1; cursor < stderr.length; cursor++) {
                if (RUST_NOTE.test(stderr[cursor]))
                    break;
                message.push(stderr[cursor]);
            }
            return {
                message: message.join('\n').trim() || 'panic sem mensagem.',
                location: locate(file, modern[2], modern[3], modern[4]),
                traceback: rustTraceback(stderr, index),
            };
        }
        return null;
    },
};
function rustTraceback(stderr: readonly string[], from: number): string | null {
    const lines = stderr.slice(from).filter((line) => !RUST_NOTE.test(line));
    return lines.length > 0 ? lines.join('\n') : null;
}
const GO_PANIC = /^panic: (.*)$/;
const GO_FATAL = /^fatal error: (.*)$/;
const GO_FRAME_FILE = /^\s+(\S+?\.go):(\d+)(?: \+0x[0-9a-f]+)?$/;
export const GO_FLAVOR: WasmFlavor = {
    errorName: () => 'Erro de Go',
    captureStderr: true,
    describeTrap(message) {
        const lower = message.toLowerCase();
        if (lower.includes('unreachable'))
            return 'o programa Go abortou (panic ou erro fatal do runtime sem relatório).';
        if (lower.includes('out of bounds'))
            return 'acesso à memória fora dos limites dentro do runtime Go.';
        if (lower.includes('stack'))
            return 'estouro de pilha: recursão sem fim.';
        return `falha do WebAssembly: ${message}`;
    },
    parseCrash(stderr, { file }) {
        const start = stderr.findIndex((line) => GO_PANIC.test(line) || GO_FATAL.test(line));
        if (start === -1)
            return null;
        const head = stderr[start];
        const panicked = GO_PANIC.exec(head);
        const message = (panicked ? panicked[1] : GO_FATAL.exec(head)![1]).replace(/ \[recovered\]$/, '').trim();
        const extra: string[] = [];
        let cursor = start + 1;
        while (cursor < stderr.length && stderr[cursor] !== '' && !/^goroutine \d+ \[/.test(stderr[cursor]) && !/^runtime stack:/.test(stderr[cursor])) {
            extra.push(stderr[cursor]);
            cursor++;
        }
        const location = goLocation(stderr, cursor, file);
        const trace = stderr.slice(cursor).filter((line) => line !== '');
        const traceback = trace.length > 0 ? trace.slice(0, 40).join('\n') : null;
        return { message: [message, ...extra].join('\n'), location, traceback };
    },
};
function goLocation(stderr: readonly string[], from: number, file: string): ForeignLocation | null {
    const stem = file.replace(/\.[^.]+$/, '');
    let functionName: string | null = null;
    for (let index = from; index < stderr.length; index++) {
        const line = stderr[index];
        const frame = GO_FRAME_FILE.exec(line);
        if (!frame) {
            const call = /^(main\.\S+?)\(/.exec(line) ?? /^(\S+)\(/.exec(line);
            functionName = call ? call[1] : null;
            continue;
        }
        const base = frame[1].split('/').pop() ?? frame[1];
        if (base === file || base === `${stem}.go`)
            return { file, line: Number(frame[2]), functionName };
    }
    return null;
}
const SWIFT_FATAL = /^(?:.*\/)?(.+?\.swift):(\d+): (Fatal error|Precondition failed|Assertion failed|Swift runtime failure): ?(.*)$/;
export const SWIFT_FLAVOR: WasmFlavor = {
    errorName: () => 'Erro de Swift',
    captureStderr: true,
    describeTrap(message) {
        const lower = message.toLowerCase();
        if (lower.includes('unreachable'))
            return 'o script abortou (fatalError, precondition, índice fora do array ou estouro aritmético).';
        if (lower.includes('out of bounds'))
            return 'acesso à memória fora dos limites: ponteiro inseguro inválido ou estouro de pilha.';
        if (lower.includes('divide by zero'))
            return 'divisão inteira por zero.';
        if (lower.includes('integer overflow') || lower.includes('invalid conversion'))
            return 'conversão de ponto flutuante para inteiro fora do intervalo.';
        if (lower.includes('indirect call') || lower.includes('signature mismatch'))
            return 'chamada por ponteiro de função com assinatura errada.';
        if (lower.includes('stack'))
            return 'estouro de pilha: recursão sem fim ou estruturas locais grandes demais.';
        return `falha do WebAssembly: ${message}`;
    },
    parseCrash(stderr, { file }) {
        for (let index = 0; index < stderr.length; index++) {
            const match = SWIFT_FATAL.exec(stderr[index]);
            if (!match)
                continue;
            const [, reported, line, kind, text] = match;
            const message = text.trim() || kind;
            const location = reported === file ? { file, line: Number(line) } : null;
            const rest = stderr.slice(index + 1).filter((entry) => entry.trim() !== '');
            return { message, location, traceback: rest.length > 0 ? rest.join('\n') : null };
        }
        return null;
    },
};
const ZIG_PANIC = /^panic: (.*)$/;
const ZIG_RUNTIME_FRAME = /^\s+em (?:\S+?\.wasm\.)?(?:helix\.|debug\.|start\.|mem\.|fmt\.|heap\.|Io\.|hash_map\.|__|FullPanic|panicExtra|defaultPanic)/;
export const ZIG_FLAVOR: WasmFlavor = {
    errorName: () => 'Erro de Zig',
    captureStderr: true,
    describeTrap(message) {
        const lower = message.toLowerCase();
        if (lower.includes('unreachable'))
            return 'o script abortou (panic sem relatório, `unreachable` alcançado ou @trap).';
        if (lower.includes('out of bounds'))
            return 'acesso à memória fora dos limites: ponteiro inválido ou estouro de pilha.';
        if (lower.includes('divide by zero'))
            return 'divisão inteira por zero.';
        if (lower.includes('integer overflow') || lower.includes('invalid conversion'))
            return 'conversão de ponto flutuante para inteiro fora do intervalo.';
        if (lower.includes('indirect call') || lower.includes('signature mismatch'))
            return 'chamada por ponteiro de função com assinatura errada.';
        if (lower.includes('stack'))
            return 'estouro de pilha: recursão sem fim ou estruturas locais grandes demais.';
        return `falha do WebAssembly: ${message}`;
    },
    parseCrash(stderr, { cause }) {
        const index = stderr.findIndex((line) => ZIG_PANIC.test(line));
        if (index === -1)
            return null;
        const message = [ZIG_PANIC.exec(stderr[index])![1], ...stderr.slice(index + 1).filter((line) => line.trim() !== '')].join('\n').trim() || 'panic sem mensagem.';
        const frames = (wasmTraceback(cause) ?? '').split('\n').filter((line) => line && !ZIG_RUNTIME_FRAME.test(line));
        return { message, location: null, traceback: frames.length > 0 ? frames.join('\n') : null };
    },
};
export const WAT_FLAVOR: WasmFlavor = {
    errorName: () => 'Erro de WebAssembly',
    captureStderr: false,
    describeTrap(message) {
        const lower = message.toLowerCase();
        if (lower.includes('unreachable'))
            return 'a instrução `unreachable` foi executada.';
        if (lower.includes('out of bounds memory'))
            return 'acesso à memória fora dos limites: um load/store com endereço além das páginas declaradas em (memory …).';
        if (lower.includes('out of bounds table') || lower.includes('table index'))
            return 'índice fora dos limites da tabela em call_indirect.';
        if (lower.includes('out of bounds'))
            return 'acesso fora dos limites: endereço de memória ou índice de tabela inválido.';
        if (lower.includes('divide by zero') || lower.includes('remainder by zero'))
            return 'divisão inteira por zero (i32.div/i32.rem com divisor 0).';
        if (lower.includes('integer overflow'))
            return 'estouro em divisão inteira (INT_MIN / -1) ou em trunc de ponto flutuante fora do intervalo.';
        if (lower.includes('invalid conversion') || lower.includes('float unrepresentable'))
            return 'conversão de ponto flutuante para inteiro fora do intervalo (i32.trunc_* com NaN ou infinito; use trunc_sat_*).';
        if (lower.includes('indirect call') || lower.includes('signature mismatch') || lower.includes('null function'))
            return 'call_indirect com assinatura diferente da função na tabela, ou entrada nula.';
        if (lower.includes('stack') || lower.includes('too much recursion'))
            return 'estouro de pilha: recursão sem fim.';
        if (lower.includes('uninitialized element') || lower.includes('null reference'))
            return 'referência nula: a entrada da tabela não foi inicializada.';
        return `falha do WebAssembly: ${message}`;
    },
};
function locate(file: string, reported: string, line: string, column: string): ForeignLocation | null {
    const base = reported.split(/[\\/]/).pop() ?? reported;
    if (base !== file)
        return null;
    return { file, line: Number(line), column: Number(column) };
}
export type { CrashReport };
