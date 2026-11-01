import { DEFAULT_ACTIONS, type GameContext, type HelixRoot, classOfModule } from './bridge';
import { CONSTANTS, JSON_CLASS, KEY_CODES } from './globals';
import { SINGLETON_MEMBERS } from './godot-api';
import { InputEvent, InputRouter, godotButtonMask, keyEventFor } from './input-events';
import { RefCounted, Resource, ScriptResource, sceneTreeOf } from './node';
import { setGodotBase } from './object';
import { Dictionary, Rect2, Vector2, Vector2i, Vector3, fail, markScriptClass } from './values';
import { str } from './variant';
type AnyRecord = Record<string, unknown>;
type Fn = (...args: unknown[]) => unknown;
type Singleton = Record<string, unknown>;
const OK = Number(CONSTANTS.OK ?? 0);
const FAILED = Number(CONSTANTS.FAILED ?? 1);
const ERR_UNAVAILABLE = Number(CONSTANTS.ERR_UNAVAILABLE ?? 2);
const ERR_PARSE_ERROR = Number(CONSTANTS.ERR_PARSE_ERROR ?? 43);
function withConstants(name: string, members: Singleton): Singleton {
    for (const [key, member] of Object.entries(SINGLETON_MEMBERS[name] ?? {}))
        if (member.kind === 'constant')
            members[key] = member.value;
    return members;
}
function text(value: unknown, where: string): string {
    if (typeof value !== 'string')
        fail(`${where}: esperava uma String, recebeu ${typeof value}.`);
    return value;
}
function int(value: unknown, fallback = 0): number {
    const number = Number(value);
    return Number.isFinite(number) ? Math.trunc(number) : fallback;
}
function float(value: unknown, fallback = 0): number {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}
function hasWindow(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
}
function viewportSize(context: GameContext): {
    width: number;
    height: number;
    pixelRatio: number;
} {
    const camera = (context.helix.camera as AnyRecord | undefined)?.viewport as {
        width?: number;
        height?: number;
        pixelRatio?: number;
    } | undefined;
    if (camera && typeof camera.width === 'number')
        return { width: camera.width, height: camera.height ?? camera.width, pixelRatio: camera.pixelRatio ?? 1 };
    const render = context.helix.render as {
        width?: number;
        height?: number;
    } | undefined;
    return { width: render?.width ?? 1, height: render?.height ?? 1, pixelRatio: 1 };
}
function pointerOf(context: GameContext): {
    x: number;
    y: number;
    dx: number;
    dy: number;
    buttons: number;
} {
    const pointer = context.input.pointer as {
        x?: number;
        y?: number;
        dx?: number;
        dy?: number;
        buttons?: number;
    } | undefined;
    return { x: pointer?.x ?? 0, y: pointer?.y ?? 0, dx: pointer?.dx ?? 0, dy: pointer?.dy ?? 0, buttons: pointer?.buttons ?? 0 };
}
interface GamepadSnapshot {
    index: number;
    id: string;
    axes: number[];
    buttons: Array<{
        pressed: boolean;
        value: number;
    }>;
}
function gamepadsOf(context: GameContext): GamepadSnapshot[] {
    const list = context.input.gamepads as (() => GamepadSnapshot[]) | undefined;
    try {
        return typeof list === 'function' ? list() : [];
    }
    catch {
        return [];
    }
}
function actionsApi(context: GameContext): {
    define: (name: string, bindings: string[]) => void;
    bindings: (name: string) => string[];
    names: () => string[];
    down: (name: string) => boolean;
    pressed: (name: string) => boolean;
    released: (name: string) => boolean;
} | null {
    const actions = context.input.actions as AnyRecord | undefined;
    return actions && typeof actions.define === 'function' ? (actions as unknown as ReturnType<typeof actionsApi>) : null;
}
export function ensureDefaultActions(context: GameContext): void {
    const actions = actionsApi(context);
    if (!actions)
        return;
    const existing = new Set(actions.names());
    for (const [name, bindings] of Object.entries(DEFAULT_ACTIONS))
        if (!existing.has(name))
            actions.define(name, [...bindings]);
}
class VirtualActions {
    readonly justPressed = new Set<string>();
    readonly justReleased = new Set<string>();
    constructor(private readonly context: GameContext) {
        context.frameListeners.add(() => {
            this.justPressed.clear();
            this.justReleased.clear();
        });
        InputRouter.of(context).onAction.push((event) => {
            if (event.pressed)
                this.press(event.action, event.strength);
            else
                this.release(event.action);
        });
    }
    press(action: string, strength: number): void {
        if (!this.context.virtualActions.has(action))
            this.justPressed.add(action);
        this.context.virtualActions.set(action, Math.max(0, Math.min(1, strength)));
    }
    release(action: string): void {
        if (this.context.virtualActions.delete(action))
            this.justReleased.add(action);
    }
    strength(action: string): number {
        return this.context.virtualActions.get(action) ?? 0;
    }
}
const CURSOR_SHAPES: Record<number, string> = { 0: 'default', 1: 'text', 2: 'pointer', 3: 'crosshair', 4: 'wait', 5: 'wait', 6: 'grabbing', 7: 'grab', 8: 'not-allowed', 13: 'move', 16: 'help' };
function createInput(context: GameContext): Singleton {
    const virtual = new VirtualActions(context);
    const erased = new Set<string>();
    let mouseMode = 0;
    let cursorShape = 0;
    function knownAction(action: unknown, where: string): string | null {
        const name = text(action, where);
        ensureDefaultActions(context);
        const actions = actionsApi(context);
        if (!actions || erased.has(name) || !actions.names().includes(name)) {
            context.warnOnce(`action:${name}`, `${where}: a ação "${name}" não existe no InputMap. Defina-a com InputMap.add_action() ou helix.input.actions.define().`);
            return null;
        }
        return name;
    }
    function strength(action: unknown, where: string): number {
        const name = knownAction(action, where);
        if (name === null)
            return 0;
        const virtualStrength = virtual.strength(name);
        if (virtualStrength > 0)
            return virtualStrength;
        const actions = actionsApi(context);
        if (!actions)
            return 0;
        if (actions.down(name))
            return 1;
        let best = 0;
        for (const binding of actions.bindings(name)) {
            const match = /^Gamepad(\d*):(\d+)$/.exec(binding);
            if (!match)
                continue;
            for (const pad of gamepadsOf(context)) {
                if (match[1] && Number(match[1]) !== pad.index)
                    continue;
                best = Math.max(best, pad.buttons[Number(match[2])]?.value ?? 0);
            }
        }
        return best;
    }
    function axis(negative: unknown, positive: unknown, where: string): number {
        return strength(positive, where) - strength(negative, where);
    }
    function deadzoneOf(action: unknown): number {
        return typeof action === 'string' ? (context.deadzones.get(action) ?? 0.5) : 0.5;
    }
    function setMouseMode(mode: unknown): void {
        mouseMode = int(mode);
        const input = context.input;
        const lock = input.lockPointer as Fn | undefined;
        const unlock = input.unlockPointer as Fn | undefined;
        if (mouseMode === 2)
            lock?.();
        else
            unlock?.();
        try {
            input.cursor = mouseMode === 1 || mouseMode === 4 ? 'none' : CURSOR_SHAPES[cursorShape] ?? 'default';
        }
        catch {
        }
    }
    function setCursorShape(shape: unknown): void {
        cursorShape = int(shape);
        if (mouseMode === 1 || mouseMode === 4)
            return;
        try {
            context.input.cursor = CURSOR_SHAPES[cursorShape] ?? 'default';
        }
        catch {
        }
    }
    const input: Singleton = {
        is_action_pressed: (action: unknown, _exact = false) => strength(action, 'Input.is_action_pressed()') > 0,
        is_action_just_pressed: (action: unknown, _exact = false) => {
            const name = knownAction(action, 'Input.is_action_just_pressed()');
            if (name === null)
                return false;
            return virtual.justPressed.has(name) || Boolean(actionsApi(context)?.pressed(name));
        },
        is_action_just_released: (action: unknown, _exact = false) => {
            const name = knownAction(action, 'Input.is_action_just_released()');
            if (name === null)
                return false;
            return virtual.justReleased.has(name) || Boolean(actionsApi(context)?.released(name));
        },
        get_action_strength: (action: unknown, _exact = false) => strength(action, 'Input.get_action_strength()'),
        get_action_raw_strength: (action: unknown, _exact = false) => strength(action, 'Input.get_action_raw_strength()'),
        get_axis: (negative: unknown, positive: unknown) => axis(negative, positive, 'Input.get_axis()'),
        get_vector: (negativeX: unknown, positiveX: unknown, negativeY: unknown, positiveY: unknown, deadzone: unknown = -1) => {
            const where = 'Input.get_vector()';
            const vector = new Vector2(axis(negativeX, positiveX, where), axis(negativeY, positiveY, where));
            let zone = float(deadzone, -1);
            if (zone < 0)
                zone = (deadzoneOf(negativeX) + deadzoneOf(positiveX) + deadzoneOf(negativeY) + deadzoneOf(positiveY)) / 4;
            const length = vector.length();
            if (length <= zone)
                return new Vector2();
            if (length > 1)
                return new Vector2(vector.x / length, vector.y / length);
            const scale = ((length - zone) / (1 - zone)) / length;
            return new Vector2(vector.x * scale, vector.y * scale);
        },
        is_key_pressed: (keycode: unknown) => Boolean((context.input.isDown as Fn | undefined)?.(keyName(keycode))),
        is_physical_key_pressed: (keycode: unknown) => Boolean((context.input.isDown as Fn | undefined)?.(keyName(keycode))),
        is_key_label_pressed: (keycode: unknown) => Boolean((context.input.isDown as Fn | undefined)?.(keyName(keycode))),
        is_mouse_button_pressed: (button: unknown) => {
            const index = int(button);
            const bit = index === 1 ? 1 : index === 2 ? 2 : index === 3 ? 4 : 0;
            return bit !== 0 && (pointerOf(context).buttons & bit) !== 0;
        },
        get_mouse_button_mask: () => godotButtonMask(pointerOf(context).buttons),
        get_last_mouse_velocity: () => mouseVelocity(context),
        get_last_mouse_screen_velocity: () => mouseVelocity(context),
        set_mouse_mode: (mode: unknown) => setMouseMode(mode),
        get_mouse_mode: () => mouseMode,
        get mouse_mode() {
            return mouseMode;
        },
        set mouse_mode(value: unknown) {
            setMouseMode(value);
        },
        warp_mouse: (_position: unknown) => context.warnOnce('warp_mouse', 'Input.warp_mouse(): o navegador não permite mover o cursor; a chamada foi ignorada.'),
        is_joy_button_pressed: (device: unknown, button: unknown) => Boolean(gamepadsOf(context).find((pad) => pad.index === int(device))?.buttons[int(button)]?.pressed),
        get_joy_axis: (device: unknown, axisIndex: unknown) => {
            const pad = gamepadsOf(context).find((candidate) => candidate.index === int(device));
            return pad?.axes[int(axisIndex)] ?? 0;
        },
        get_connected_joypads: () => gamepadsOf(context).map((pad) => pad.index),
        is_joy_known: (device: unknown) => gamepadsOf(context).some((pad) => pad.index === int(device)),
        get_joy_name: (device: unknown) => gamepadsOf(context).find((pad) => pad.index === int(device))?.id ?? '',
        get_joy_guid: (device: unknown) => gamepadsOf(context).find((pad) => pad.index === int(device))?.id ?? '',
        action_press: (action: unknown, strengthValue: unknown = 1) => virtual.press(text(action, 'Input.action_press()'), float(strengthValue, 1)),
        action_release: (action: unknown) => virtual.release(text(action, 'Input.action_release()')),
        is_anything_pressed: () => {
            const keys = (context.input.keysDown as (() => string[]) | undefined)?.() ?? [];
            if (keys.length > 0 || pointerOf(context).buttons !== 0 || context.virtualActions.size > 0)
                return true;
            return gamepadsOf(context).some((pad) => pad.buttons.some((button) => button.pressed));
        },
        get_accelerometer: () => new Vector3(),
        get_gravity: () => new Vector3(0, -9.8, 0),
        get_gyroscope: () => new Vector3(),
        get_magnetometer: () => new Vector3(),
        parse_input_event: (event: unknown) => {
            if (!(event instanceof InputEvent))
                fail(`Input.parse_input_event(): esperava um InputEvent, recebeu ${typeof event}.`);
            InputRouter.of(context).dispatch(event);
        },
        flush_buffered_events: () => undefined,
        start_joy_vibration: (device: unknown, weak: unknown, strong: unknown, duration: unknown = 0) => {
            const seconds = float(duration);
            (context.input.rumble as Fn | undefined)?.(int(device), float(strong), float(weak), seconds > 0 ? seconds * 1000 : 1000);
        },
        stop_joy_vibration: (device: unknown) => (context.input.rumble as Fn | undefined)?.(int(device), 0, 0, 1),
        vibrate_handheld: (durationMs: unknown = 500, _amplitude: unknown = -1) => {
            if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function')
                navigator.vibrate(int(durationMs, 500));
        },
        set_custom_mouse_cursor: (_image: unknown, _shape: unknown = 0, _hotspot: unknown = null) => context.warnOnce('custom_cursor', 'Input.set_custom_mouse_cursor(): cursores personalizados não são suportados aqui; use Input.set_default_cursor_shape().'),
        set_default_cursor_shape: (shape: unknown = 0) => setCursorShape(shape),
        get_current_cursor_shape: () => cursorShape,
        use_accumulated_input: true,
    };
    Object.defineProperty(input, '$cursorShape', { get: () => cursorShape, set: (value: unknown) => setCursorShape(value), enumerable: false });
    Object.defineProperty(input, '$erasedActions', { value: erased, enumerable: false });
    return withConstants('Input', input);
}
function keyName(keycode: unknown): string {
    if (typeof keycode === 'string') {
        if (keycode.startsWith('KEY_'))
            return KEY_CODES[keycode] ?? keycode.slice(4);
        return keycode;
    }
    if (typeof keycode === 'number') {
        if (keycode >= 32 && keycode < 127)
            return String.fromCharCode(keycode).toLowerCase();
        return String(keycode);
    }
    return str(keycode);
}
function mouseVelocity(context: GameContext): Vector2 {
    const pointer = pointerOf(context);
    const delta = Number(context.time.delta ?? 0) || 1 / 60;
    return new Vector2(pointer.dx / delta, pointer.dy / delta);
}
function createInputMap(context: GameContext, input: Singleton): Singleton {
    const erased = (input as {
        $erasedActions: Set<string>;
    }).$erasedActions;
    function actions() {
        ensureDefaultActions(context);
        const api = actionsApi(context);
        if (!api)
            fail('InputMap: este host não expõe helix.input.actions.');
        return api;
    }
    function exists(name: string): boolean {
        return !erased.has(name) && actions().names().includes(name);
    }
    function requireAction(action: unknown, where: string): string {
        const name = text(action, where);
        if (!exists(name))
            fail(`${where}: a ação "${name}" não existe no InputMap.`);
        return name;
    }
    function codesOf(event: unknown, where: string): string[] {
        if (!(event instanceof InputEvent))
            fail(`${where}: esperava um InputEvent, recebeu ${typeof event}.`);
        return event.$codes();
    }
    return {
        has_action: (action: unknown) => exists(text(action, 'InputMap.has_action()')),
        add_action: (action: unknown, deadzone: unknown = 0.5) => {
            const name = text(action, 'InputMap.add_action()');
            erased.delete(name);
            if (!actions().names().includes(name))
                actions().define(name, []);
            context.deadzones.set(name, float(deadzone, 0.5));
        },
        erase_action: (action: unknown) => {
            const name = requireAction(action, 'InputMap.erase_action()');
            actions().define(name, []);
            erased.add(name);
            context.deadzones.delete(name);
        },
        get_actions: () => actions().names().filter((name) => !erased.has(name)),
        action_has_event: (action: unknown, event: unknown) => {
            const name = requireAction(action, 'InputMap.action_has_event()');
            const bindings = actions().bindings(name);
            return codesOf(event, 'InputMap.action_has_event()').some((code) => bindings.includes(code));
        },
        action_add_event: (action: unknown, event: unknown) => {
            const name = requireAction(action, 'InputMap.action_add_event()');
            const bindings = new Set(actions().bindings(name));
            for (const code of codesOf(event, 'InputMap.action_add_event()'))
                bindings.add(code);
            actions().define(name, [...bindings]);
        },
        action_erase_event: (action: unknown, event: unknown) => {
            const name = requireAction(action, 'InputMap.action_erase_event()');
            const codes = codesOf(event, 'InputMap.action_erase_event()');
            actions().define(name, actions()
                .bindings(name)
                .filter((code) => !codes.includes(code)));
        },
        action_erase_events: (action: unknown) => actions().define(requireAction(action, 'InputMap.action_erase_events()'), []),
        action_get_events: (action: unknown) => actions()
            .bindings(requireAction(action, 'InputMap.action_get_events()'))
            .map((code) => keyEventFor(context.helix, code)),
        event_is_action: (event: unknown, action: unknown, exact: unknown = false) => {
            if (!(event instanceof InputEvent))
                return false;
            return event.is_action(text(action, 'InputMap.event_is_action()'), Boolean(exact));
        },
        action_set_deadzone: (action: unknown, deadzone: unknown) => context.deadzones.set(requireAction(action, 'InputMap.action_set_deadzone()'), float(deadzone, 0.5)),
        action_get_deadzone: (action: unknown) => context.deadzones.get(requireAction(action, 'InputMap.action_get_deadzone()')) ?? 0.5,
        load_from_project_settings: () => ensureDefaultActions(context),
    };
}
const WEEKDAY = ['WEEKDAY_SUNDAY', 'WEEKDAY_MONDAY', 'WEEKDAY_TUESDAY', 'WEEKDAY_WEDNESDAY', 'WEEKDAY_THURSDAY', 'WEEKDAY_FRIDAY', 'WEEKDAY_SATURDAY'];
function pad2(value: number): string {
    return String(Math.abs(value)).padStart(2, '0');
}
function dateParts(date: Date, utc: boolean): {
    year: number;
    month: number;
    day: number;
    weekday: number;
    hour: number;
    minute: number;
    second: number;
} {
    return utc
        ? { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), weekday: date.getUTCDay(), hour: date.getUTCHours(), minute: date.getUTCMinutes(), second: date.getUTCSeconds() }
        : { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(), weekday: date.getDay(), hour: date.getHours(), minute: date.getMinutes(), second: date.getSeconds() };
}
