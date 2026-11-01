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
function datetimeDict(date: Date, utc: boolean, options: {
    date: boolean;
    time: boolean;
    weekday?: boolean;
    dst?: boolean;
}): Dictionary {
    const parts = dateParts(date, utc);
    const dict = new Dictionary();
    if (options.date) {
        dict.set('year', parts.year);
        dict.set('month', parts.month);
        dict.set('day', parts.day);
        if (options.weekday !== false)
            dict.set('weekday', parts.weekday);
    }
    if (options.time) {
        dict.set('hour', parts.hour);
        dict.set('minute', parts.minute);
        dict.set('second', parts.second);
    }
    if (options.dst)
        dict.set('dst', !utc && isDst(date));
    return dict;
}
function isDst(date: Date): boolean {
    const january = new Date(date.getFullYear(), 0, 1).getTimezoneOffset();
    const july = new Date(date.getFullYear(), 6, 1).getTimezoneOffset();
    return Math.max(january, july) !== date.getTimezoneOffset();
}
function dateString(date: Date, utc: boolean): string {
    const parts = dateParts(date, utc);
    return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}
function timeString(date: Date, utc: boolean): string {
    const parts = dateParts(date, utc);
    return `${pad2(parts.hour)}:${pad2(parts.minute)}:${pad2(parts.second)}`;
}
function datetimeString(date: Date, utc: boolean, useSpace: unknown): string {
    return `${dateString(date, utc)}${useSpace ? ' ' : 'T'}${timeString(date, utc)}`;
}
function dictField(dict: unknown, key: string, fallback: number): number {
    if (dict instanceof Dictionary)
        return int(dict.get(key), fallback);
    if (dict !== null && typeof dict === 'object')
        return int((dict as AnyRecord)[key], fallback);
    return fallback;
}
function dateFromDict(dict: unknown): Date {
    return new Date(Date.UTC(dictField(dict, 'year', 1970), dictField(dict, 'month', 1) - 1, dictField(dict, 'day', 1), dictField(dict, 'hour', 0), dictField(dict, 'minute', 0), dictField(dict, 'second', 0)));
}
function dateFromString(value: unknown, where: string): Date {
    const source = text(value, where).trim();
    const match = /^(?:(\d{4})-(\d{2})-(\d{2}))?[T ]?(?:(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(source);
    if (!match || source === '')
        fail(`${where}: "${source}" não é uma data/hora no formato ISO 8601 (YYYY-MM-DDTHH:MM:SS).`);
    const [, year, month, day, hour, minute, second] = match;
    return new Date(Date.UTC(year ? Number(year) : 1970, month ? Number(month) - 1 : 0, day ? Number(day) : 1, hour ? Number(hour) : 0, minute ? Number(minute) : 0, second ? Number(second) : 0));
}
function fromUnix(value: unknown): Date {
    return new Date(float(value) * 1000);
}
function createTime(context: GameContext): Singleton {
    const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
    function ticksMsec(): number {
        const realtime = context.time.realtime;
        if (typeof realtime === 'number' && Number.isFinite(realtime))
            return Math.floor(realtime * 1000);
        return Math.floor((typeof performance !== 'undefined' ? performance.now() : Date.now()) - started);
    }
    const time: Singleton = {
        get_ticks_msec: () => ticksMsec(),
        get_ticks_usec: () => ticksMsec() * 1000,
        get_unix_time_from_system: () => Date.now() / 1000,
        get_unix_time_from_datetime_dict: (dict: unknown) => Math.floor(dateFromDict(dict).getTime() / 1000),
        get_unix_time_from_datetime_string: (value: unknown) => Math.floor(dateFromString(value, 'Time.get_unix_time_from_datetime_string()').getTime() / 1000),
        get_datetime_dict_from_system: (utc: unknown = false) => datetimeDict(new Date(), Boolean(utc), { date: true, time: true, dst: true }),
        get_datetime_dict_from_unix_time: (unix: unknown) => datetimeDict(fromUnix(unix), true, { date: true, time: true }),
        get_datetime_string_from_system: (utc: unknown = false, useSpace: unknown = false) => datetimeString(new Date(), Boolean(utc), useSpace),
        get_datetime_string_from_unix_time: (unix: unknown, useSpace: unknown = false) => datetimeString(fromUnix(unix), true, useSpace),
        get_datetime_string_from_datetime_dict: (dict: unknown, useSpace: unknown = false) => datetimeString(dateFromDict(dict), true, useSpace),
        get_datetime_dict_from_datetime_string: (value: unknown, weekday: unknown = true) => datetimeDict(dateFromString(value, 'Time.get_datetime_dict_from_datetime_string()'), true, { date: true, time: true, weekday: Boolean(weekday) }),
        get_date_dict_from_system: (utc: unknown = false) => datetimeDict(new Date(), Boolean(utc), { date: true, time: false, dst: true }),
        get_date_dict_from_unix_time: (unix: unknown) => datetimeDict(fromUnix(unix), true, { date: true, time: false }),
        get_date_string_from_system: (utc: unknown = false) => dateString(new Date(), Boolean(utc)),
        get_date_string_from_unix_time: (unix: unknown) => dateString(fromUnix(unix), true),
        get_time_dict_from_system: (utc: unknown = false) => datetimeDict(new Date(), Boolean(utc), { date: false, time: true }),
        get_time_dict_from_unix_time: (unix: unknown) => datetimeDict(fromUnix(unix), true, { date: false, time: true }),
        get_time_string_from_system: (utc: unknown = false) => timeString(new Date(), Boolean(utc)),
        get_time_string_from_unix_time: (unix: unknown) => timeString(fromUnix(unix), true),
        get_time_zone_from_system: () => {
            const now = new Date();
            let name = 'UTC';
            try {
                name = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
            }
            catch {
            }
            return new Dictionary({ bias: -now.getTimezoneOffset(), name });
        },
        get_offset_string_from_offset_minutes: (minutes: unknown) => {
            const total = int(minutes);
            const sign = total < 0 ? '-' : '+';
            return `${sign}${pad2(Math.floor(Math.abs(total) / 60))}:${pad2(Math.abs(total) % 60)}`;
        },
    };
    for (const [index, key] of WEEKDAY.entries())
        time[key] = index;
    const months = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
    for (const [index, month] of months.entries())
        time[`MONTH_${month}`] = index + 1;
    return withConstants('Time', time);
}
function createEngine(context: GameContext, singletons: () => Record<string, Singleton>): Singleton {
    context.ensurePhysicsClock();
    let lastPhysicsAt = 0;
    context.physicsListeners.add(() => {
        lastPhysicsAt = Number(context.time.now ?? 0);
    });
    const stored = { max_physics_steps_per_frame: 8, physics_jitter_fix: 0.5, print_error_messages: true, print_to_stdout: true };
    function ticksPerSecond(): number {
        const fixed = Number(context.time.fixedDelta ?? 0);
        return fixed > 0 ? Math.round(1 / fixed) : 60;
    }
    function setTicksPerSecond(value: unknown): void {
        const ticks = Math.max(1, int(value, 60));
        const set = context.physics.set as ((patch: AnyRecord) => void) | undefined;
        if (typeof set === 'function') {
            try {
                set({ fixedTimestep: 1 / ticks });
                return;
            }
            catch {
            }
        }
        context.warnOnce('ticks', `Engine.physics_ticks_per_second: esta engine mantém o passo de física em ${ticksPerSecond()} Hz; ajuste-o nas configurações de física do projeto.`);
    }
    function timeScale(): number {
        const scale = context.time.scale;
        return typeof scale === 'number' ? scale : 1;
    }
    function setTimeScale(value: unknown): void {
        const scale = Math.max(0, float(value, 1));
        try {
            context.time.scale = scale;
        }
        catch {
            context.warnOnce('time_scale', 'Engine.time_scale: este host não permite alterar a escala de tempo.');
        }
    }
    const engine: Singleton = {
        get_frames_per_second: () => context.fps,
        get_process_frames: () => int(context.time.frame),
        get_physics_frames: () => context.physicsFrames,
        get_frames_drawn: () => int(context.time.frame),
        get_physics_interpolation_fraction: () => {
            const fixed = Number(context.time.fixedDelta ?? 0);
            if (fixed <= 0)
                return 0;
            return Math.max(0, Math.min(1, (Number(context.time.now ?? 0) - lastPhysicsAt) / fixed));
        },
        is_in_physics_frame: () => context.inPhysicsFrame,
        is_editor_hint: () => Boolean(context.helix.isEditor),
        is_embedded_in_editor: () => Boolean(context.helix.isEditor),
        get_version_info: () => new Dictionary({ major: 4, minor: 3, patch: 0, hex: 0x040300, status: 'stable', build: 'helix', hash: '', timestamp: 0, string: '4.3.0.stable.helix' }),
        get_main_loop: () => sceneTreeOf(context),
        has_singleton: (name: unknown) => typeof name === 'string' && Object.prototype.hasOwnProperty.call(singletons(), name),
        get_singleton: (name: unknown) => {
            const all = singletons();
            if (typeof name !== 'string' || !Object.prototype.hasOwnProperty.call(all, name))
                fail(`Engine.get_singleton(): não existe o singleton "${str(name)}".`);
            return all[name];
        },
        get_singleton_list: () => Object.keys(singletons()),
        get_architecture_name: () => 'wasm32',
        get_author_info: () => new Dictionary({ lead_developers: [], founders: [], project_managers: [], developers: [] }),
        get_license_text: () => 'Godot Engine API compatibility layer for helix. MIT License.',
        get_write_movie_path: () => '',
        get_time_scale: () => timeScale(),
        set_time_scale: (value: unknown) => setTimeScale(value),
        get_max_fps: () => context.maxFps,
        set_max_fps: (value: unknown) => {
            context.maxFps = Math.max(0, int(value));
        },
        get_physics_ticks_per_second: () => ticksPerSecond(),
        set_physics_ticks_per_second: (value: unknown) => setTicksPerSecond(value),
        get time_scale() {
            return timeScale();
        },
        set time_scale(value: unknown) {
            setTimeScale(value);
        },
        get max_fps() {
            return context.maxFps;
        },
        set max_fps(value: unknown) {
            context.maxFps = Math.max(0, int(value));
        },
        get physics_ticks_per_second() {
            return ticksPerSecond();
        },
        set physics_ticks_per_second(value: unknown) {
            setTicksPerSecond(value);
        },
        get max_physics_steps_per_frame() {
            return stored.max_physics_steps_per_frame;
        },
        set max_physics_steps_per_frame(value: unknown) {
            stored.max_physics_steps_per_frame = Math.max(1, int(value, 8));
        },
        get physics_jitter_fix() {
            return stored.physics_jitter_fix;
        },
        set physics_jitter_fix(value: unknown) {
            stored.physics_jitter_fix = float(value, 0.5);
        },
        get print_error_messages() {
            return stored.print_error_messages;
        },
        set print_error_messages(value: unknown) {
            stored.print_error_messages = Boolean(value);
        },
        get print_to_stdout() {
            return stored.print_to_stdout;
        },
        set print_to_stdout(value: unknown) {
            stored.print_to_stdout = Boolean(value);
        },
    };
    return withConstants('Engine', engine);
}
const WEB_FEATURES = new Set(['web', 'html5', 'javascript', 'wasm32', '32', 'debug', 'template', 'pc', 'helix']);
function heapUsed(): number {
    const memory = (typeof performance !== 'undefined' ? (performance as unknown as {
        memory?: {
            usedJSHeapSize?: number;
            totalJSHeapSize?: number;
            jsHeapSizeLimit?: number;
        };
    }).memory : undefined) ?? undefined;
    return memory?.usedJSHeapSize ?? 0;
}
function createOS(context: GameContext): Singleton {
    let peak = 0;
    const stored = { low_processor_usage_mode: false, low_processor_usage_mode_sleep_usec: 6900, delta_smoothing: true };
    const locale = () => (typeof navigator !== 'undefined' && navigator.language ? navigator.language.replace('-', '_') : 'en_US');
    function keycodeString(keycode: unknown): string {
        const name = keyName(keycode);
        const constant = Object.entries(KEY_CODES).find(([, code]) => code === name)?.[0];
        if (constant)
            return constant.slice(4).charAt(0) + constant.slice(5).toLowerCase();
        return name.replace(/^Key/, '');
    }
    const os: Singleton = {
        get_name: () => 'Web',
        get_distribution_name: () => 'Web',
        get_version: () => (typeof navigator !== 'undefined' ? navigator.userAgent : ''),
        get_model_name: () => 'GenericDevice',
        get_locale: () => locale(),
        get_locale_language: () => locale().split('_')[0],
        get_processor_count: () => (typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 1 : 1),
        get_processor_name: () => '',
        get_unique_id: () => '',
        get_environment: (_name: unknown) => '',
        has_environment: (_name: unknown) => false,
        set_environment: (_name: unknown, _value: unknown) => undefined,
        get_cmdline_args: () => [],
        get_cmdline_user_args: () => [],
        get_executable_path: () => (hasWindow() ? window.location.href : ''),
        get_user_data_dir: () => 'user://',
        get_data_dir: () => 'user://',
        get_config_dir: () => 'user://',
        get_cache_dir: () => 'user://',
        get_temp_dir: () => 'user://',
        get_system_dir: (_dir: unknown, _shared: unknown = true) => '',
        is_debug_build: () => true,
        has_feature: (tag: unknown) => typeof tag === 'string' && WEB_FEATURES.has(tag),
        is_sandboxed: () => true,
        is_userfs_persistent: () => true,
        get_static_memory_usage: () => {
            const used = heapUsed();
            peak = Math.max(peak, used);
            return used;
        },
        get_static_memory_peak_usage: () => {
            peak = Math.max(peak, heapUsed());
            return peak;
        },
        get_memory_info: () => {
            const memory = (typeof performance !== 'undefined' ? (performance as unknown as {
                memory?: {
                    totalJSHeapSize?: number;
                    jsHeapSizeLimit?: number;
                    usedJSHeapSize?: number;
                };
            }).memory : undefined) ?? {};
            const limit = memory.jsHeapSizeLimit ?? 0;
            const used = memory.usedJSHeapSize ?? 0;
            return new Dictionary({ physical: limit, free: Math.max(0, limit - used), available: Math.max(0, limit - used), stack: 0 });
        },
        delay_msec: (_msec: unknown) => context.warnOnce('delay', 'OS.delay_msec(): travar a thread congelaria a página; use await get_tree().create_timer(segundos).timeout.'),
        delay_usec: (_usec: unknown) => context.warnOnce('delay', 'OS.delay_usec(): travar a thread congelaria a página; use await get_tree().create_timer(segundos).timeout.'),
        shell_open: (uri: unknown) => {
            const target = text(uri, 'OS.shell_open()');
            if (!hasWindow() || !/^(https?:|mailto:)/i.test(target))
                return ERR_UNAVAILABLE;
            const opened = window.open(target, '_blank', 'noopener,noreferrer');
            return opened ? OK : FAILED;
        },
        shell_show_in_file_manager: (_path: unknown, _open: unknown = true) => ERR_UNAVAILABLE,
        alert: (message: unknown, title: unknown = 'Alert!') => context.log('warn', `${str(title)}: ${str(message)}`),
        crash: (message: unknown) => fail(`OS.crash(): ${str(message)}`),
        request_permission: (_name: unknown) => false,
        request_permissions: () => false,
        get_granted_permissions: () => [],
        get_main_thread_id: () => 1,
        get_thread_caller_id: () => 1,
        get_process_id: () => 1,
        get_keycode_string: (keycode: unknown) => keycodeString(keycode),
        find_keycode_from_string: (value: unknown) => {
            const name = text(value, 'OS.find_keycode_from_string()');
            const constant = `KEY_${name.toUpperCase().replace(/\s+/g, '_')}`;
            return KEY_CODES[constant] ?? (name.length === 1 ? `Key${name.toUpperCase()}` : name);
        },
        is_keycode_unicode: (keycode: unknown) => {
            const name = keyName(keycode);
            return name.length === 1 || /^(Key[A-Z]|Digit\d|Space)$/.test(name);
        },
        get_video_adapter_driver_info: () => [],
        get low_processor_usage_mode() {
            return stored.low_processor_usage_mode;
        },
        set low_processor_usage_mode(value: unknown) {
            stored.low_processor_usage_mode = Boolean(value);
        },
        get low_processor_usage_mode_sleep_usec() {
            return stored.low_processor_usage_mode_sleep_usec;
        },
        set low_processor_usage_mode_sleep_usec(value: unknown) {
            stored.low_processor_usage_mode_sleep_usec = Math.max(0, int(value, 6900));
        },
        get delta_smoothing() {
            return stored.delta_smoothing;
        },
        set delta_smoothing(value: unknown) {
            stored.delta_smoothing = Boolean(value);
        },
    };
    return withConstants('OS', os);
}
function createPerformance(context: GameContext): Singleton {
    let modifiedAt = 0;
    function renderStat(key: string): number {
        const stats = (context.helix.render as AnyRecord | undefined)?.stats as AnyRecord | undefined;
        const value = stats?.[key];
        return typeof value === 'number' ? value : 0;
    }
    function physicsStat(key: string): number {
        const stats = context.physics.stats as AnyRecord | undefined;
        const value = stats?.[key];
        return typeof value === 'number' ? value : 0;
    }
    function sceneCount(): number {
        const all = context.scene.all;
        if (Array.isArray(all))
            return all.length;
        if (typeof all === 'function') {
            try {
                const list = (all as Fn)();
                return Array.isArray(list) ? list.length : 0;
            }
            catch {
                return 0;
            }
        }
        return 0;
    }
    const monitors: Record<number, () => number> = {
        0: () => context.fps,
        1: () => Number(context.time.delta ?? 0),
        2: () => Number(context.time.fixedDelta ?? 0),
        3: () => 0,
        4: () => heapUsed(),
        5: () => heapUsed(),
        6: () => 0,
        7: () => context.nodesByEntity.size + context.manualNodes.size,
        8: () => 0,
        9: () => sceneCount(),
        10: () => context.manualNodes.size,
        11: () => renderStat('objects') || renderStat('visibleObjects') || renderStat('drawn'),
        12: () => renderStat('triangles') || renderStat('primitives'),
        13: () => renderStat('drawCalls') || renderStat('calls'),
        21: () => physicsStat('awake') || physicsStat('bodies'),
        22: () => physicsStat('manifolds') || physicsStat('contactPoints'),
        23: () => physicsStat('islands'),
    };
    function monitorName(id: unknown): string {
        return text(id, 'Performance: o nome do monitor personalizado precisa ser uma String.');
    }
    const perf: Singleton = {
        get_monitor: (monitor: unknown) => {
            const id = int(monitor, -1);
            const read = monitors[id];
            if (!read)
                fail(`Performance.get_monitor(): ${str(monitor)} não é um monitor conhecido.`);
            return read();
        },
        add_custom_monitor: (id: unknown, callable: unknown, args: unknown = []) => {
            const name = monitorName(id);
            if (typeof callable !== 'function')
                fail(`Performance.add_custom_monitor(): "${name}" precisa de um Callable.`);
            const bound = Array.isArray(args) ? args : [];
            if (context.customMonitors.has(name))
                fail(`Performance.add_custom_monitor(): já existe um monitor chamado "${name}".`);
            context.customMonitors.set(name, () => (callable as Fn)(...bound));
            modifiedAt = int(context.time.frame);
        },
        remove_custom_monitor: (id: unknown) => {
            const name = monitorName(id);
            if (!context.customMonitors.delete(name))
                fail(`Performance.remove_custom_monitor(): não existe um monitor chamado "${name}".`);
            modifiedAt = int(context.time.frame);
        },
        has_custom_monitor: (id: unknown) => typeof id === 'string' && context.customMonitors.has(id),
        get_custom_monitor: (id: unknown) => {
            const name = monitorName(id);
            const monitor = context.customMonitors.get(name);
            if (!monitor)
                fail(`Performance.get_custom_monitor(): não existe um monitor chamado "${name}".`);
            return monitor();
        },
        get_custom_monitor_names: () => Array.from(context.customMonitors.keys()),
        get_monitor_modification_time: () => modifiedAt,
    };
    return withConstants('Performance', perf);
}
export class JSONParser extends RefCounted {
    data: unknown = null;
    private errorMessage = '';
    private errorLine = -1;
    private parsedText = '';
    constructor(helix: HelixRoot) {
        super({ entity: null, helix, script: null });
    }
    parse(source: unknown, keepText: unknown = false): number {
        const input = text(source, 'JSON.parse()');
        this.parsedText = keepText ? input : '';
        try {
            this.data = JSON_CLASS.to_native(JSON.parse(input));
            this.errorMessage = '';
            this.errorLine = -1;
            return OK;
        }
        catch (cause) {
            this.data = null;
            this.errorMessage = cause instanceof Error ? cause.message : String(cause);
            const position = /position (\d+)/.exec(this.errorMessage);
            this.errorLine = position ? input.slice(0, Number(position[1])).split('\n').length - 1 : 0;
            return ERR_PARSE_ERROR;
        }
    }
    get_data(): unknown {
        return this.data;
    }
    set_data(value: unknown): void {
        this.data = value;
    }
    get_error_message(): string {
        return this.errorMessage;
    }
    get_error_line(): number {
        return this.errorLine;
    }
    get_parsed_text(): string {
        return this.parsedText;
    }
}
markScriptClass(JSONParser, 'JSON');
setGodotBase(JSONParser, 'JSON');
function createJSON(context: GameContext): Singleton {
    return {
        stringify: JSON_CLASS.stringify,
        parse_string: JSON_CLASS.parse_string,
        from_native: (value: unknown, _fullObjects: unknown = false) => JSON_CLASS.from_native(value),
        to_native: (value: unknown, _allowObjects: unknown = false) => JSON_CLASS.to_native(value),
        new: () => new JSONParser(context.helix),
    };
}
