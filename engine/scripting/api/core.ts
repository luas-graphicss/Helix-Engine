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
export function createDebugApi(host: RuntimeHost, queue: DebugDrawQueue) {
    const push = (a: Vec3, b: Vec3, color: Vec3, duration: {
        expiresAt: number;
        frames: number;
    }, alpha = 1) => {
        queue.lines.push({ a, b, color, alpha, ...duration });
    };
    const parseColor = (value: unknown, member: string) => (value === undefined || value === null ? vec3.copy(vec3.create(), DEFAULT_DEBUG_COLOR) : toLinearColor(value, member));
    return {
        line: (a: unknown, b: unknown, color?: unknown, seconds?: unknown) => {
            push(toVec3(a, 'helix.debug.line'), toVec3(b, 'helix.debug.line'), parseColor(color, 'helix.debug.line'), durationOf(seconds, host.time.now, 'helix.debug.line'));
        },
        ray: (origin: unknown, direction: unknown, length?: unknown, color?: unknown, seconds?: unknown) => {
            const start = toVec3(origin, 'helix.debug.ray');
            const dir = vec3.normalize(vec3.create(), toVec3(direction, 'helix.debug.ray'));
            const end = vec3.scaleAndAdd(vec3.create(), start, dir, length === undefined ? 1 : requireNumber(length, 'helix.debug.ray', 'o comprimento'));
            push(start, end, parseColor(color, 'helix.debug.ray'), durationOf(seconds, host.time.now, 'helix.debug.ray'));
        },
        sphere: (center: unknown, radius: unknown, color?: unknown, seconds?: unknown) => {
            const c = toVec3(center, 'helix.debug.sphere');
            const r = requireNumber(radius, 'helix.debug.sphere', 'o raio');
            const rgb = parseColor(color, 'helix.debug.sphere');
            const duration = durationOf(seconds, host.time.now, 'helix.debug.sphere');
            const segments = 24;
            const planes: Array<[
                number,
                number
            ]> = [
                [0, 1],
                [0, 2],
                [1, 2],
            ];
            for (const [u, v] of planes) {
                let previous: Vec3 | null = null;
                for (let index = 0; index <= segments; index++) {
                    const angle = (index / segments) * Math.PI * 2;
                    const point = vec3.copy(vec3.create(), c);
                    point[u] += Math.cos(angle) * r;
                    point[v] += Math.sin(angle) * r;
                    if (previous)
                        push(previous, point, rgb, { ...duration });
                    previous = point;
                }
            }
        },
        box: (box: unknown, color?: unknown, seconds?: unknown) => {
            let min: Vec3;
            let max: Vec3;
            const candidate = box as {
                min?: unknown;
                max?: unknown;
                center?: unknown;
                size?: unknown;
            };
            if (candidate && candidate.min !== undefined && candidate.max !== undefined) {
                min = toVec3(candidate.min, 'helix.debug.box.min');
                max = toVec3(candidate.max, 'helix.debug.box.max');
            }
            else if (candidate && candidate.center !== undefined && candidate.size !== undefined) {
                const center = toVec3(candidate.center, 'helix.debug.box.center');
                const size = toVec3(candidate.size, 'helix.debug.box.size');
                min = vec3.create(center[0] - size[0] / 2, center[1] - size[1] / 2, center[2] - size[2] / 2);
                max = vec3.create(center[0] + size[0] / 2, center[1] + size[1] / 2, center[2] + size[2] / 2);
            }
            else {
                throw new HelixArgumentError('helix.debug.box', 'esperava { min, max } ou { center, size }.');
            }
            const rgb = parseColor(color, 'helix.debug.box');
            const duration = durationOf(seconds, host.time.now, 'helix.debug.box');
            const corner = (x: number, y: number, z: number) => vec3.create(x ? max[0] : min[0], y ? max[1] : min[1], z ? max[2] : min[2]);
            const edges: Array<[
                [
                    number,
                    number,
                    number
                ],
                [
                    number,
                    number,
                    number
                ]
            ]> = [
                [[0, 0, 0], [1, 0, 0]], [[1, 0, 0], [1, 0, 1]], [[1, 0, 1], [0, 0, 1]], [[0, 0, 1], [0, 0, 0]],
                [[0, 1, 0], [1, 1, 0]], [[1, 1, 0], [1, 1, 1]], [[1, 1, 1], [0, 1, 1]], [[0, 1, 1], [0, 1, 0]],
                [[0, 0, 0], [0, 1, 0]], [[1, 0, 0], [1, 1, 0]], [[1, 0, 1], [1, 1, 1]], [[0, 0, 1], [0, 1, 1]],
            ];
            for (const [a, b] of edges)
                push(corner(...a), corner(...b), rgb, { ...duration });
        },
        bounds: (entity: unknown, color?: unknown, seconds?: unknown) => {
            const target = requireEntity(entity, 'helix.debug.bounds');
            const box = host.boundsOf(target);
            if (aabbMath.isEmpty(box))
                return;
            const api = createDebugApi(host, queue);
            api.box({ min: box.min, max: box.max }, color, seconds);
        },
        axes: (entity: unknown, size?: unknown, seconds?: unknown) => {
            const target = requireEntity(entity, 'helix.debug.axes');
            const length = size === undefined ? 1 : requireNumber(size, 'helix.debug.axes', 'o tamanho');
            host.session.scene.updateWorldMatrices();
            const m = target.worldMatrix;
            const origin = vec3.create(m[12], m[13], m[14]);
            const duration = durationOf(seconds, host.time.now, 'helix.debug.axes');
            const axis = (x: number, y: number, z: number, color: Vec3) => {
                const dir = vec3.normalize(vec3.create(), vec3.create(x, y, z));
                push(origin, vec3.scaleAndAdd(vec3.create(), origin, dir, length), color, { ...duration });
            };
            axis(m[0], m[1], m[2], vec3.create(0.95, 0.25, 0.25));
            axis(m[4], m[5], m[6], vec3.create(0.35, 0.9, 0.35));
            axis(m[8], m[9], m[10], vec3.create(0.3, 0.5, 1));
        },
        text: (position: unknown, text: unknown, color?: unknown, seconds?: unknown) => {
            queue.texts.push({
                position: toVec3(position, 'helix.debug.text'),
                text: formatArguments([text]),
                color: typeof color === 'string' ? color : '#8ff0a4',
                ...durationOf(seconds, host.time.now, 'helix.debug.text'),
            });
        },
        clear: () => queue.clear(),
    };
}
export function createEventsApi(host: RuntimeHost) {
    const { bus } = host;
    return {
        on: (name: unknown, handler: unknown) => bus.on(requireString(name, 'helix.events.on', 'o nome do evento'), requireFunction(handler, 'helix.events.on'), host.current),
        once: (name: unknown, handler: unknown) => bus.once(requireString(name, 'helix.events.once', 'o nome do evento'), requireFunction(handler, 'helix.events.once'), host.current),
        off: (name: unknown, handler: unknown) => bus.off(requireString(name, 'helix.events.off', 'o nome do evento'), requireFunction(handler, 'helix.events.off')),
        emit: (name: unknown, payload?: unknown) => bus.emit(requireString(name, 'helix.events.emit', 'o nome do evento'), payload),
        onEntity: (entity: unknown, name: unknown, handler: unknown) => {
            const target = requireEntity(entity, 'helix.events.onEntity');
            return bus.on(requireString(name, 'helix.events.onEntity', 'o nome do evento'), requireFunction(handler, 'helix.events.onEntity'), host.current, { entityId: target.id });
        },
        emitEntity: (entity: unknown, name: unknown, payload?: unknown) => {
            const target = requireEntity(entity, 'helix.events.emitEntity');
            return bus.emit(requireString(name, 'helix.events.emitEntity', 'o nome do evento'), payload, target.id);
        },
        listenerCount: (name: unknown) => bus.listenerCount(requireString(name, 'helix.events.listenerCount', 'o nome do evento')),
        names: () => bus.names(),
    };
}
export function createEngineInfo() {
    return Object.freeze({ name: ENGINE_NAME, version: ENGINE_VERSION, apiVersion: API_VERSION });
}
