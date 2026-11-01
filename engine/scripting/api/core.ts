import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import * as aabbMath from '@/engine/core/math/aabb';
import { ENGINE_NAME, ENGINE_VERSION } from '@/engine/core/engine-info';
import type { LogLevel } from '@/engine/editor/session/editor-log';
import { API_VERSION } from '../api-manifest';
import { HelixArgumentError, HelixError } from '../runtime/script-errors';
import type { RuntimeHost } from '../runtime/runtime-host';
import { formatArguments } from '../runtime/script-console';
import { requireEntity, requireFunction, requireNumber, requireString, toLinearColor, toVec3 } from '../runtime/values';
export interface DebugLine {
    readonly a: Vec3;
    readonly b: Vec3;
    readonly color: Vec3;
    readonly alpha: number;
    expiresAt: number;
    frames: number;
}
export interface DebugText {
    readonly position: Vec3;
    readonly text: string;
    readonly color: string;
    expiresAt: number;
    frames: number;
}
export class DebugDrawQueue {
    readonly lines: DebugLine[] = [];
    readonly texts: DebugText[] = [];
    expire(now: number): void {
        const keepLine = (entry: DebugLine) => {
            if (entry.frames > 0)
                return --entry.frames > 0;
            return entry.expiresAt > now;
        };
        let write = 0;
        for (const line of this.lines)
            if (keepLine(line))
                this.lines[write++] = line;
        this.lines.length = write;
        write = 0;
        for (const text of this.texts) {
            const keep = text.frames > 0 ? --text.frames > 0 : text.expiresAt > now;
            if (keep)
                this.texts[write++] = text;
        }
        this.texts.length = write;
    }
    clear(): void {
        this.lines.length = 0;
        this.texts.length = 0;
    }
}
const DEFAULT_DEBUG_COLOR = vec3.create(0.2, 0.9, 0.4);
function durationOf(seconds: unknown, now: number, member: string): {
    expiresAt: number;
    frames: number;
} {
    if (seconds === undefined || seconds === null || seconds === 0)
        return { expiresAt: 0, frames: 1 };
    const value = requireNumber(seconds, member, 'a duração em segundos');
    return { expiresAt: now + Math.max(0, value), frames: 0 };
}
export function createTimeApi(host: RuntimeHost) {
    const { scheduler } = host;
    return {
        get now() {
            return host.time.now;
        },
        get delta() {
            return host.time.delta;
        },
        get fixedDelta() {
            return host.time.fixedDelta;
        },
        get unscaledDelta() {
            return host.time.unscaledDelta;
        },
        get frame() {
            return host.time.frame;
        },
        get realtime() {
            return (performance.now() - host.time.startedAt) / 1000;
        },
        get scale() {
            return host.session.playtest.timeScale;
        },
        set scale(value: number) {
            host.session.playtest.setTimeScale(requireNumber(value, 'helix.time.scale', 'a escala de tempo'));
        },
        wait: (seconds: unknown) => scheduler.wait(host.current, requireNumber(seconds, 'helix.time.wait', 'os segundos')),
        waitFrames: (frames: unknown) => scheduler.waitFrames(host.current, requireNumber(frames, 'helix.time.waitFrames', 'os frames')),
        delay: (seconds: unknown, fn: unknown) => {
            const handle = scheduler.delay(host.current, requireNumber(seconds, 'helix.time.delay', 'os segundos'), requireFunction(fn, 'helix.time.delay'));
            return () => handle.cancel();
        },
        every: (seconds: unknown, fn: unknown) => {
            const handle = scheduler.every(host.current, requireNumber(seconds, 'helix.time.every', 'o intervalo'), requireFunction(fn, 'helix.time.every'));
            return () => handle.cancel();
        },
        nextFrame: (fn: unknown) => {
            const handle = scheduler.nextFrame(host.current, requireFunction(fn, 'helix.time.nextFrame'));
            return () => handle.cancel();
        },
    };
}
export function createTaskApi(host: RuntimeHost) {
    const { scheduler } = host;
    return {
        spawn: (fn: unknown) => scheduler.spawn(host.current, requireFunction(fn, 'helix.task.spawn', 'a tarefa')),
        cancel: (handle: unknown) => {
            if (!handle || typeof (handle as {
                cancel?: unknown;
            }).cancel !== 'function')
                throw new HelixArgumentError('helix.task.cancel', 'esperava o handle devolvido por helix.task.spawn.');
            (handle as {
                cancel(): void;
            }).cancel();
        },
        all: (handles: unknown) => {
            if (!Array.isArray(handles))
                throw new HelixArgumentError('helix.task.all', 'esperava uma lista de handles de tarefa.');
            return Promise.all(handles.map((handle: {
                done?: Promise<void>;
            }) => handle?.done ?? Promise.resolve()));
        },
        get running() {
            return scheduler.runningTasks;
        },
    };
}
function describeFirstArgument(level: LogLevel, args: unknown[]): {
    source: string | undefined;
    message: string;
} {
    if (args.length >= 2 && typeof args[0] === 'string' && args[0].length <= 40 && !/\s{2,}/.test(args[0])) {
        return { source: args[0], message: formatArguments(args.slice(1)) };
    }
    void level;
    return { source: undefined, message: formatArguments(args) };
}
export function createLogApi(host: RuntimeHost) {
    const emit = (level: LogLevel) => (...args: unknown[]) => {
        const { source, message } = describeFirstArgument(level, args);
        host.log(level, message, { source });
    };
    return {
        info: emit('info'),
        warn: emit('warn'),
        error: emit('error'),
        debug: emit('debug'),
        assert: (condition: unknown, message?: unknown) => {
            if (condition)
                return;
            const text = message === undefined ? 'Asserção falhou.' : `Asserção falhou: ${formatArguments([message])}`;
            throw new HelixError(text);
        },
        trace: (...args: unknown[]) => {
            const mapped = host.stacks.map(new Error().stack);
            const text = host.stacks.format(mapped);
            host.log('debug', args.length > 0 ? formatArguments(args) : 'Pilha de chamadas', { details: text || '(sem quadros de script)' });
        },
        clear: () => host.session.log.clear(),
    };
}
