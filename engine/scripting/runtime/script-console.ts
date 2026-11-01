import { Entity } from '@/engine/core/scene/entity';
import type { LogLevel, LogLocation } from '@/engine/editor/session/editor-log';
export function formatValue(value: unknown, depth = 0, seen: Set<object> = new Set()): string {
    if (value === null)
        return 'null';
    if (value === undefined)
        return 'undefined';
    switch (typeof value) {
        case 'string':
            return depth === 0 ? value : JSON.stringify(value);
        case 'number':
            return Number.isInteger(value) ? String(value) : Number(value.toFixed(4)).toString();
        case 'bigint':
            return `${value}n`;
        case 'boolean':
        case 'symbol':
            return String(value);
        case 'function':
            return `[função ${value.name || 'anônima'}]`;
    }
    if (value instanceof Error)
        return `${value.name}: ${value.message}`;
    if (value instanceof Entity)
        return `Ator#${value.id} "${value.name}"`;
    if (value instanceof Float32Array || value instanceof Float64Array) {
        if (value.length <= 4)
            return `(${Array.from(value, (entry) => formatValue(entry, depth + 1, seen)).join(', ')})`;
        if (value.length === 16)
            return `Mat4[${Array.from(value, (entry) => formatValue(entry, depth + 1, seen)).join(', ')}]`;
        return `${value.constructor.name}(${value.length})`;
    }
    if (ArrayBuffer.isView(value))
        return `${value.constructor.name}(${(value as unknown as ArrayLike<number>).length})`;
    if (value instanceof Date)
        return value.toISOString();
    if (value instanceof RegExp)
        return value.toString();
    if (value instanceof Promise)
        return '[Promise]';
    if (typeof value === 'object') {
        if (seen.has(value))
            return '[circular]';
        if (depth >= 3)
            return Array.isArray(value) ? `[Array(${value.length})]` : `[${value.constructor?.name ?? 'Object'}]`;
        seen.add(value);
        try {
            if (Array.isArray(value)) {
                const items = value.slice(0, 20).map((entry) => formatValue(entry, depth + 1, seen));
                return `[${items.join(', ')}${value.length > 20 ? `, … +${value.length - 20}` : ''}]`;
            }
            if (value instanceof Map)
                return `Map(${value.size}) {${Array.from(value.entries()).slice(0, 10).map(([key, entry]) => `${formatValue(key, depth + 1, seen)} => ${formatValue(entry, depth + 1, seen)}`).join(', ')}}`;
            if (value instanceof Set)
                return `Set(${value.size}) {${Array.from(value.values()).slice(0, 10).map((entry) => formatValue(entry, depth + 1, seen)).join(', ')}}`;
            const entries = Object.entries(value as Record<string, unknown>).slice(0, 20);
            const name = value.constructor && value.constructor !== Object ? `${value.constructor.name} ` : '';
            return `${name}{ ${entries.map(([key, entry]) => `${key}: ${formatValue(entry, depth + 1, seen)}`).join(', ')} }`;
        }
        finally {
            seen.delete(value);
        }
    }
    return String(value);
}
export function formatArguments(args: readonly unknown[]): string {
    if (args.length === 0)
        return '';
    const [first, ...rest] = args;
    if (typeof first === 'string' && /%[sdifoOj]/.test(first) && rest.length > 0) {
        let index = 0;
        const formatted = first.replace(/%([sdifoOj%])/g, (match, kind: string) => {
            if (kind === '%')
                return '%';
            if (index >= rest.length)
                return match;
            const value = rest[index++];
            switch (kind) {
                case 'd':
                case 'i':
                    return String(Math.trunc(Number(value)));
                case 'f':
                    return String(Number(value));
                default:
                    return formatValue(value);
            }
        });
        return [formatted, ...rest.slice(index).map((value) => formatValue(value))].join(' ');
    }
    return args.map((value) => formatValue(value)).join(' ');
}
export interface ConsoleSink {
    (level: LogLevel, message: string, options?: {
        details?: string;
        location?: LogLocation | null;
        trace?: boolean;
    }): void;
}
export function createScriptConsole(sink: ConsoleSink): Console {
    const counters = new Map<string, number>();
    const timers = new Map<string, number>();
    let groupDepth = 0;
    const indent = () => '  '.repeat(groupDepth);
    const emit = (level: LogLevel, args: unknown[], options?: {
        details?: string;
        trace?: boolean;
    }) => sink(level, indent() + formatArguments(args), options);
    const console: Partial<Console> = {
        log: (...args: unknown[]) => emit('info', args),
        info: (...args: unknown[]) => emit('info', args),
        debug: (...args: unknown[]) => emit('debug', args),
        warn: (...args: unknown[]) => emit('warn', args),
        error: (...args: unknown[]) => emit('error', args, { details: args.find((value) => value instanceof Error)?.stack }),
        trace: (...args: unknown[]) => emit('debug', args.length > 0 ? args : ['Pilha'], { trace: true }),
        dir: (value: unknown) => emit('info', [formatValue(value)]),
        dirxml: (value: unknown) => emit('info', [formatValue(value)]),
        table: (data: unknown) => {
            if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && data[0] !== null) {
                const columns = Array.from(new Set(data.flatMap((row) => Object.keys(row as object)))).slice(0, 12);
                const lines = [columns.join(' | '), ...data.slice(0, 50).map((row) => columns.map((column) => formatValue((row as Record<string, unknown>)[column], 1)).join(' | '))];
                sink('info', `${indent()}Tabela (${data.length} ${data.length === 1 ? 'linha' : 'linhas'})`, { details: lines.join('\n') });
                return;
            }
            emit('info', [data]);
        },
        assert: (condition?: boolean, ...args: unknown[]) => {
            if (condition)
                return;
            emit('error', args.length > 0 ? ['Asserção falhou:', ...args] : ['Asserção falhou']);
        },
        count: (label = 'default') => {
            const next = (counters.get(label) ?? 0) + 1;
            counters.set(label, next);
            emit('info', [`${label}: ${next}`]);
        },
        countReset: (label = 'default') => {
            counters.delete(label);
        },
        time: (label = 'default') => {
            timers.set(label, performance.now());
        },
        timeLog: (label = 'default', ...args: unknown[]) => {
            const start = timers.get(label);
            if (start === undefined) {
                emit('warn', [`Cronômetro "${label}" não existe.`]);
                return;
            }
            emit('info', [`${label}: ${(performance.now() - start).toFixed(2)} ms`, ...args]);
        },
        timeEnd: (label = 'default') => {
            const start = timers.get(label);
            if (start === undefined) {
                emit('warn', [`Cronômetro "${label}" não existe.`]);
                return;
            }
            timers.delete(label);
            emit('info', [`${label}: ${(performance.now() - start).toFixed(2)} ms`]);
        },
        group: (...args: unknown[]) => {
            if (args.length > 0)
                emit('info', args);
            groupDepth++;
        },
        groupCollapsed: (...args: unknown[]) => {
            if (args.length > 0)
                emit('info', args);
            groupDepth++;
        },
        groupEnd: () => {
            groupDepth = Math.max(0, groupDepth - 1);
        },
        clear: () => undefined,
        profile: () => undefined,
        profileEnd: () => undefined,
        timeStamp: () => undefined,
    };
    return console as Console;
}
