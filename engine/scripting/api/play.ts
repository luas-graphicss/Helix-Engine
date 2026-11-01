import { HelixNotImplementedError } from '../runtime/script-errors';
import type { RuntimeHost } from '../runtime/runtime-host';
import { requireFunction, requireNumber } from '../runtime/values';
import type { ScriptRunContext } from '../script-document';
export function createPlayApi(host: RuntimeHost) {
    const { session, bus } = host;
    const { playtest } = session;
    function defer(action: () => void): void {
        queueMicrotask(() => {
            try {
                action();
            }
            catch (cause) {
                host.log('error', `helix.play: ${cause instanceof Error ? cause.message : String(cause)}`);
            }
        });
    }
    return {
        get state() {
            return playtest.state;
        },
        get isRunning() {
            return playtest.isRunning;
        },
        get isPossessing() {
            return playtest.isPossessing;
        },
        get pointerLocked() {
            return playtest.pointerLocked;
        },
        get timeScale() {
            return playtest.timeScale;
        },
        set timeScale(value: number) {
            playtest.setTimeScale(requireNumber(value, 'helix.play.timeScale', 'a escala de tempo'));
        },
        get elapsed() {
            return playtest.elapsedSeconds;
        },
        standalone: false as boolean,
        play: () => defer(() => playtest.play()),
        pause: () => defer(() => playtest.pause()),
        togglePlayPause: () => defer(() => playtest.togglePlayPause()),
        stop: () => defer(() => playtest.stop()),
        stepOnce: () => defer(() => playtest.stepOnce()),
        setTimeScale: (value: unknown) => playtest.setTimeScale(requireNumber(value, 'helix.play.setTimeScale', 'a escala de tempo')),
        restart: () => defer(() => {
            playtest.stop();
            playtest.play();
        }),
        reloadScene: () => defer(() => {
            playtest.stop();
            playtest.play();
        }),
        onStarted: (handler: unknown) => bus.on('play.started', (payload) => requireFunction<(payload: unknown) => void>(handler, 'helix.play.onStarted')(payload), host.current),
        onPaused: (handler: unknown) => bus.on('play.paused', (payload) => requireFunction<(payload: unknown) => void>(handler, 'helix.play.onPaused')(payload), host.current),
        onResumed: (handler: unknown) => bus.on('play.resumed', (payload) => requireFunction<(payload: unknown) => void>(handler, 'helix.play.onResumed')(payload), host.current),
        onStopped: (handler: unknown) => bus.on('play.stopped', (payload) => requireFunction<(payload: unknown) => void>(handler, 'helix.play.onStopped')(payload), host.current),
        export: (options?: unknown) => {
            void options;
            throw new HelixNotImplementedError('helix.play.export');
        },
    };
}
export type PlayApi = ReturnType<typeof createPlayApi>;
export function netRealmFor(host: RuntimeHost, context: ScriptRunContext | null | undefined): ScriptRunContext {
    return host.net.isAuthoritative ? (context ?? 'shared') : 'shared';
}
export function createNetApi(host: RuntimeHost): Record<string, unknown> {
    const current = () => host.net.facade(netRealmFor(host, host.current?.runContext));
    return new Proxy({} as Record<string, unknown>, {
        get: (_target, property) => Reflect.get(current(), property),
        has: (_target, property) => property in current(),
        ownKeys: () => Reflect.ownKeys(current()),
        getOwnPropertyDescriptor: (_target, property) => {
            const descriptor = Object.getOwnPropertyDescriptor(current(), property);
            return descriptor ? { ...descriptor, configurable: true } : undefined;
        },
    });
}
