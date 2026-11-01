import { shortcutBindings } from '@/engine/editor/shortcuts/shortcut-bindings';
import type { ShortcutActionId, ShortcutScope } from '@/engine/editor/shortcuts/shortcut-actions';
import { HelixArgumentError } from '../runtime/script-errors';
import type { RuntimeHost } from '../runtime/runtime-host';
import type { InputCapture, KeyEventPayload, PointerEventPayload } from '../runtime/input-state';
import { requireFunction, requireNumber, requireObject, requireOneOf, requireString } from '../runtime/values';
const CAPTURE_MODES: readonly InputCapture[] = ['game', 'gui', 'both'];
const CURSORS = ['default', 'none', 'crosshair', 'pointer', 'grab', 'grabbing', 'move', 'text', 'wait', 'not-allowed', 'help', 'cell', 'zoom-in', 'zoom-out'] as const;
export function createInputApi(host: RuntimeHost) {
    const { input, bus, session } = host;
    function on<T>(name: string, handler: unknown, member: string): () => void {
        const fn = requireFunction<(payload: T) => void>(handler, member);
        return bus.on(name, (payload) => fn(payload as T), host.current);
    }
    const actions = {
        define: (name: unknown, bindings: unknown) => {
            const member = 'helix.input.actions.define';
            const action = requireString(name, member, 'o nome da ação');
            if (!Array.isArray(bindings) || bindings.some((binding) => typeof binding !== 'string'))
                throw new HelixArgumentError(member, 'as teclas precisam ser uma lista de strings.');
            input.defineAction(action, bindings as string[]);
        },
        bindings: (name: unknown) => input.actionBindings(requireString(name, 'helix.input.actions.bindings', 'o nome da ação')),
        names: () => input.actionNames(),
        down: (name: unknown) => input.actionDown(requireString(name, 'helix.input.actions.down', 'o nome da ação')),
        pressed: (name: unknown) => input.actionPressed(requireString(name, 'helix.input.actions.pressed', 'o nome da ação')),
        released: (name: unknown) => input.actionReleased(requireString(name, 'helix.input.actions.released', 'o nome da ação')),
    };
    return {
        isDown: (key: unknown) => input.isDown(requireString(key, 'helix.input.isDown', 'a tecla')),
        wasPressed: (key: unknown) => input.wasPressed(requireString(key, 'helix.input.wasPressed', 'a tecla')),
        wasReleased: (key: unknown) => input.wasReleased(requireString(key, 'helix.input.wasReleased', 'a tecla')),
        keysDown: () => [...input.down],
        onKeyDown: (handler: unknown) => on<KeyEventPayload>('input.keyDown', handler, 'helix.input.onKeyDown'),
        onKeyUp: (handler: unknown) => on<KeyEventPayload>('input.keyUp', handler, 'helix.input.onKeyUp'),
        onTextInput: (handler: unknown) => on<{
            text: string;
        }>('input.text', handler, 'helix.input.onTextInput'),
        get pointer() {
            return input.pointer;
        },
        get pointerLocked() {
            return input.pointerLocked;
        },
        lockPointer: () => input.lockPointer(),
        unlockPointer: () => input.unlockPointer(),
        onPointerDown: (handler: unknown) => on<PointerEventPayload>('input.pointerDown', handler, 'helix.input.onPointerDown'),
        onPointerUp: (handler: unknown) => on<PointerEventPayload>('input.pointerUp', handler, 'helix.input.onPointerUp'),
        onPointerMove: (handler: unknown) => on<PointerEventPayload>('input.pointerMove', handler, 'helix.input.onPointerMove'),
        onWheel: (handler: unknown) => on<{
            deltaX: number;
            deltaY: number;
        }>('input.wheel', handler, 'helix.input.onWheel'),
        get cursor() {
            return input.cursor;
        },
        set cursor(value: string) {
            input.cursor = requireOneOf(value, CURSORS, 'helix.input.cursor', 'o cursor');
        },
        cursors: () => CURSORS.slice(),
        get touches() {
            return input.touches;
        },
        gamepads: () => input.gamepads(),
        axis: (pad: unknown, index: unknown) => input.axis(requireNumber(pad, 'helix.input.axis', 'o gamepad'), requireNumber(index, 'helix.input.axis', 'o eixo')),
        button: (pad: unknown, index: unknown) => input.button(requireNumber(pad, 'helix.input.button', 'o gamepad'), requireNumber(index, 'helix.input.button', 'o botão')),
        rumble: (pad: unknown, strong: unknown, weak: unknown, ms: unknown) => input.rumble(requireNumber(pad, 'helix.input.rumble', 'o gamepad'), requireNumber(strong, 'helix.input.rumble', 'a intensidade forte'), requireNumber(weak, 'helix.input.rumble', 'a intensidade fraca'), requireNumber(ms, 'helix.input.rumble', 'a duração')),
        onGamepadButtonDown: (handler: unknown) => on<{
            pad: number;
            button: number;
        }>('input.gamepadButtonDown', handler, 'helix.input.onGamepadButtonDown'),
        onGamepadButtonUp: (handler: unknown) => on<{
            pad: number;
            button: number;
        }>('input.gamepadButtonUp', handler, 'helix.input.onGamepadButtonUp'),
        actions,
        action: (name: unknown) => {
            const action = requireString(name, 'helix.input.action', 'o nome da ação');
            return {
                name: action,
                get down() {
                    return input.actionDown(action);
                },
                get pressed() {
                    return input.actionPressed(action);
                },
                get released() {
                    return input.actionReleased(action);
                },
                get bindings() {
                    return input.actionBindings(action);
                },
            };
        },
        axis2d: (config: unknown) => {
            const member = 'helix.input.axis2d';
            const options = requireObject(config, member, 'a configuração');
            return input.axis2d({
                up: requireString(options.up, member, 'up'),
                down: requireString(options.down, member, 'down'),
                left: requireString(options.left, member, 'left'),
                right: requireString(options.right, member, 'right'),
                stick: typeof options.stick === 'number' || typeof options.stick === 'boolean' ? options.stick : undefined,
            });
        },
        characterFrame: () => {
            const characters = session.playtest.characters;
            return characters ? { ...characters.frame } : null;
        },
        get capture() {
            return input.capture;
        },
        set capture(value: InputCapture) {
            input.capture = requireOneOf(value, CAPTURE_MODES, 'helix.input.capture', 'o modo');
        },
        get guiHasFocus() {
            return !input.gameHasKeyboard;
        },
        shortcuts: {
            resolve: (event: unknown, scope: unknown = 'editor') => {
                const payload = requireObject(event, 'helix.input.shortcuts.resolve', 'o evento') as unknown as KeyboardEvent;
                return shortcutBindings.resolve(payload, requireOneOf(scope, ['editor', 'gui', 'code', 'animation', 'audio', 'vfx'] as const, 'helix.input.shortcuts.resolve', 'o escopo') as ShortcutScope);
            },
            chordsFor: (id: unknown) => shortcutBindings.chordsFor(requireString(id, 'helix.input.shortcuts.chordsFor', 'a ação') as ShortcutActionId),
            bind: (id: unknown, chord: unknown) => shortcutBindings.addChord(requireString(id, 'helix.input.shortcuts.bind', 'a ação') as ShortcutActionId, requireString(chord, 'helix.input.shortcuts.bind', 'o atalho')),
            unbind: (id: unknown, chord: unknown) => shortcutBindings.removeChord(requireString(id, 'helix.input.shortcuts.unbind', 'a ação') as ShortcutActionId, requireString(chord, 'helix.input.shortcuts.unbind', 'o atalho')),
            conflicts: () => shortcutBindings.conflicts(),
        },
    };
}
export type InputApi = ReturnType<typeof createInputApi>;
