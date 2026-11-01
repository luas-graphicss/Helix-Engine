import type { GameContext, HelixRoot } from './bridge';
import { GodotObject, setGodotBase } from './object';
import { Dictionary, Vector2, markScriptClass } from './values';
type AnyRecord = Record<string, unknown>;
type Fn = (...args: unknown[]) => unknown;
interface KeyPayload {
    readonly code: string;
    readonly key: string;
    readonly repeat: boolean;
    readonly shift: boolean;
    readonly ctrl: boolean;
    readonly alt: boolean;
    readonly meta: boolean;
}
interface PointerPayload {
    readonly x: number;
    readonly y: number;
    readonly button: number;
    readonly buttons: number;
    readonly pointerType: string;
}
export function godotMouseButton(domButton: number): number {
    switch (domButton) {
        case 0:
            return 1;
        case 1:
            return 3;
        case 2:
            return 2;
        case 3:
            return 8;
        case 4:
            return 9;
        default:
            return 0;
    }
}
export function godotButtonMask(domButtons: number): number {
    let mask = 0;
    if (domButtons & 1)
        mask |= 1;
    if (domButtons & 2)
        mask |= 2;
    if (domButtons & 4)
        mask |= 4;
    return mask;
}
function actionBindings(helix: HelixRoot, action: string): string[] {
    const actions = (helix.input as AnyRecord | undefined)?.actions as AnyRecord | undefined;
    const bindings = actions?.bindings as ((name: string) => string[]) | undefined;
    if (typeof bindings !== 'function')
        return [];
    try {
        return bindings(action);
    }
    catch {
        return [];
    }
}
export class InputEvent extends GodotObject {
    device = 0;
    pressed = false;
    constructor(helix: HelixRoot) {
        super({ entity: null, helix, script: null });
    }
    $codes(): string[] {
        return [];
    }
    is_pressed(): boolean {
        return this.pressed;
    }
    is_released(): boolean {
        return !this.pressed;
    }
    is_echo(): boolean {
        return false;
    }
    is_action_type(): boolean {
        return true;
    }
    is_action(action: unknown, _exact = false): boolean {
        if (typeof action !== 'string')
            return false;
        const codes = this.$codes();
        if (codes.length === 0)
            return false;
        const bindings = actionBindings(this.$helix, action);
        return codes.some((code) => bindings.includes(code));
    }
    is_action_pressed(action: unknown, allowEcho = false, exact = false): boolean {
        return this.pressed && (Boolean(allowEcho) || !this.is_echo()) && this.is_action(action, exact);
    }
    is_action_released(action: unknown, exact = false): boolean {
        return !this.pressed && this.is_action(action, exact);
    }
    get_action_strength(action: unknown, exact = false): number {
        return this.is_action(action, exact) && this.pressed ? 1 : 0;
    }
    is_match(event: unknown, _exact = true): boolean {
        if (!(event instanceof InputEvent))
            return false;
        const mine = this.$codes();
        const theirs = event.$codes();
        return mine.length > 0 && mine.length === theirs.length && mine.every((code) => theirs.includes(code));
    }
    as_text(): string {
        return this.get_class();
    }
    accumulate(_event: unknown): boolean {
        return false;
    }
    xformed_by(_transform: unknown, _localOffset?: unknown): InputEvent {
        return this;
    }
    to_string(): string {
        return this.as_text();
    }
}
export class InputEventWithModifiers extends InputEvent {
    alt_pressed = false;
    shift_pressed = false;
    ctrl_pressed = false;
    meta_pressed = false;
    command_or_control_autoremap = false;
    is_command_or_control_pressed(): boolean {
        return this.ctrl_pressed || this.meta_pressed;
    }
    get_modifiers_mask(): number {
        return (this.shift_pressed ? 1 << 25 : 0) | (this.alt_pressed ? 1 << 26 : 0) | (this.meta_pressed ? 1 << 27 : 0) | (this.ctrl_pressed ? 1 << 28 : 0);
    }
    protected $modifierText(): string {
        const parts: string[] = [];
        if (this.ctrl_pressed)
            parts.push('Ctrl');
        if (this.shift_pressed)
            parts.push('Shift');
        if (this.alt_pressed)
            parts.push('Alt');
        if (this.meta_pressed)
            parts.push('Meta');
        return parts.length > 0 ? `${parts.join('+')}+` : '';
    }
}
export class InputEventKey extends InputEventWithModifiers {
    keycode = '';
    physical_keycode = '';
    key_label = '';
    unicode = 0;
    echo = false;
    location = 0;
    static fromPayload(helix: HelixRoot, payload: KeyPayload, pressed: boolean): InputEventKey {
        const event = new InputEventKey(helix);
        event.pressed = pressed;
        event.keycode = payload.code;
        event.physical_keycode = payload.code;
        event.key_label = payload.key.length === 1 ? payload.key.toUpperCase() : payload.key;
        event.unicode = payload.key.length === 1 ? payload.key.codePointAt(0) ?? 0 : 0;
        event.echo = payload.repeat;
        event.shift_pressed = payload.shift;
        event.ctrl_pressed = payload.ctrl;
        event.alt_pressed = payload.alt;
        event.meta_pressed = payload.meta;
        return event;
    }
    $codes(): string[] {
        const codes = [this.keycode];
        if (this.key_label.length === 1 && this.key_label.toLowerCase() !== this.keycode)
            codes.push(this.key_label.toLowerCase());
        return codes.filter(Boolean);
    }
    is_echo(): boolean {
        return this.echo;
    }
    get_keycode_with_modifiers(): string {
        return `${this.$modifierText()}${this.keycode}`;
    }
    get_physical_keycode_with_modifiers(): string {
        return `${this.$modifierText()}${this.physical_keycode}`;
    }
    get_key_label_with_modifiers(): string {
        return `${this.$modifierText()}${this.key_label}`;
    }
    as_text_keycode(): string {
        return this.get_keycode_with_modifiers();
    }
    as_text_physical_keycode(): string {
        return this.get_physical_keycode_with_modifiers();
    }
    as_text_key_label(): string {
        return this.get_key_label_with_modifiers();
    }
    as_text(): string {
        return `InputEventKey: keycode=${this.keycode}${this.key_label ? ` (${this.key_label})` : ''}, pressed=${this.pressed}, echo=${this.echo}`;
    }
}
export class InputEventMouse extends InputEventWithModifiers {
    position = new Vector2();
    global_position = new Vector2();
    button_mask = 0;
}
export class InputEventMouseButton extends InputEventMouse {
    button_index = 0;
    double_click = false;
    factor = 1;
    canceled = false;
    static fromPayload(helix: HelixRoot, payload: PointerPayload, pressed: boolean, doubleClick: boolean): InputEventMouseButton {
        const event = new InputEventMouseButton(helix);
        event.pressed = pressed;
        event.button_index = godotMouseButton(payload.button);
        event.button_mask = godotButtonMask(payload.buttons);
        event.position = new Vector2(payload.x, payload.y);
        event.global_position = new Vector2(payload.x, payload.y);
        event.double_click = doubleClick;
        return event;
    }
    static wheel(helix: HelixRoot, deltaY: number, deltaX: number, position: Vector2): InputEventMouseButton[] {
        const events: InputEventMouseButton[] = [];
        const make = (index: number, factor: number): void => {
            for (const pressed of [true, false]) {
                const event = new InputEventMouseButton(helix);
                event.pressed = pressed;
                event.button_index = index;
                event.factor = factor;
                event.position = position;
                event.global_position = position;
                events.push(event);
            }
        };
        if (deltaY < 0)
            make(4, Math.abs(deltaY) / 100);
        else if (deltaY > 0)
            make(5, Math.abs(deltaY) / 100);
        if (deltaX < 0)
            make(6, Math.abs(deltaX) / 100);
        else if (deltaX > 0)
            make(7, Math.abs(deltaX) / 100);
        return events;
    }
    $codes(): string[] {
        return [`Mouse:${this.button_index}`];
    }
    as_text(): string {
        return `InputEventMouseButton: button_index=${this.button_index}, pressed=${this.pressed}, position=${this.position.toString()}`;
    }
}
export class InputEventMouseMotion extends InputEventMouse {
    relative = new Vector2();
    velocity = new Vector2();
    screen_relative = new Vector2();
    screen_velocity = new Vector2();
    pressure = 0;
    tilt = new Vector2();
    pen_inverted = false;
    static fromPayload(helix: HelixRoot, payload: PointerPayload, relative: Vector2, delta: number): InputEventMouseMotion {
        const event = new InputEventMouseMotion(helix);
        event.position = new Vector2(payload.x, payload.y);
        event.global_position = new Vector2(payload.x, payload.y);
        event.button_mask = godotButtonMask(payload.buttons);
        event.pressure = payload.buttons !== 0 ? 1 : 0;
        event.relative = relative;
        event.screen_relative = relative;
        const velocity = delta > 0 ? new Vector2(relative.x / delta, relative.y / delta) : new Vector2();
        event.velocity = velocity;
        event.screen_velocity = velocity;
        return event;
    }
    is_action_type(): boolean {
        return false;
    }
    as_text(): string {
        return `InputEventMouseMotion: position=${this.position.toString()}, relative=${this.relative.toString()}`;
    }
}
export class InputEventAction extends InputEvent {
    action = '';
    strength = 1;
    event_index = -1;
    is_action(action: unknown): boolean {
        return typeof action === 'string' && this.action === action;
    }
    get_action_strength(action: unknown): number {
        return this.is_action(action) && this.pressed ? this.strength : 0;
    }
    as_text(): string {
        return `InputEventAction: action="${this.action}", pressed=${this.pressed}`;
    }
}
export class InputEventJoypadButton extends InputEvent {
    button_index = 0;
    pressure = 0;
    static fromPayload(helix: HelixRoot, payload: {
        pad: number;
        button: number;
    }, pressed: boolean): InputEventJoypadButton {
        const event = new InputEventJoypadButton(helix);
        event.device = payload.pad;
        event.button_index = payload.button;
        event.pressed = pressed;
        event.pressure = pressed ? 1 : 0;
        return event;
    }
    $codes(): string[] {
        const names = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'LS', 'RS', 'up', 'down', 'left', 'right'];
        const codes = [`Gamepad:${this.button_index}`, `Gamepad${this.device}:${this.button_index}`];
        const name = names[this.button_index];
        if (name)
            codes.push(`Gamepad:${name}`, `Gamepad${this.device}:${name}`);
        return codes;
    }
    as_text(): string {
        return `InputEventJoypadButton: button_index=${this.button_index}, pressed=${this.pressed}`;
    }
}
export class InputEventJoypadMotion extends InputEvent {
    axis = 0;
    axis_value = 0;
    is_action_type(): boolean {
        return true;
    }
    get_action_strength(): number {
        return Math.abs(this.axis_value);
    }
    as_text(): string {
        return `InputEventJoypadMotion: axis=${this.axis}, axis_value=${this.axis_value.toFixed(2)}`;
    }
}
for (const [ctor, name] of [
    [InputEvent, 'InputEvent'],
    [InputEventWithModifiers, 'InputEventWithModifiers'],
    [InputEventKey, 'InputEventKey'],
    [InputEventMouse, 'InputEventMouse'],
    [InputEventMouseButton, 'InputEventMouseButton'],
    [InputEventMouseMotion, 'InputEventMouseMotion'],
    [InputEventAction, 'InputEventAction'],
    [InputEventJoypadButton, 'InputEventJoypadButton'],
    [InputEventJoypadMotion, 'InputEventJoypadMotion'],
] as const) {
    markScriptClass(ctor, name);
    setGodotBase(ctor, name);
}
export function keyEventFor(helix: HelixRoot, code: string): InputEvent {
    if (/^Gamepad\d*:/.test(code)) {
        const event = new InputEventJoypadButton(helix);
        const [, pad, button] = /^Gamepad(\d*):(.+)$/.exec(code) ?? [];
        event.device = pad ? Number(pad) : 0;
        const names = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'LS', 'RS', 'up', 'down', 'left', 'right'];
        const index = names.indexOf(button ?? '');
        event.button_index = index >= 0 ? index : Number(button) || 0;
        return event;
    }
    if (/^Mouse:\d+$/.test(code)) {
        const event = new InputEventMouseButton(helix);
        event.button_index = Number(code.slice(6));
        return event;
    }
    const event = new InputEventKey(helix);
    event.keycode = code;
    event.physical_keycode = code;
    event.key_label = code.length === 1 ? code.toUpperCase() : code.replace(/^Key/, '');
    return event;
}
export function describeEvent(event: InputEvent): Dictionary {
    const dict = new Dictionary({ class: event.get_class(), pressed: event.pressed });
    for (const key of Object.keys(event))
        if (!key.startsWith('$'))
            dict.set(key, (event as unknown as AnyRecord)[key]);
    return dict;
}
export interface InputTarget {
    readonly $freed: boolean;
    $inputEnabled: boolean;
    $unhandledInputEnabled: boolean;
    $unhandledKeyInputEnabled: boolean;
    $shortcutInputEnabled: boolean;
    _input(event: unknown): void;
    _shortcut_input(event: unknown): void;
    _unhandled_key_input(event: unknown): void;
    _unhandled_input(event: unknown): void;
    $subscribeInput(name: string, handler: Fn): () => void;
}
const INPUT_SOURCES = ['onKeyDown', 'onKeyUp', 'onPointerDown', 'onPointerUp', 'onPointerMove', 'onWheel', 'onGamepadButtonDown', 'onGamepadButtonUp'] as const;
type InputSource = (typeof INPUT_SOURCES)[number];
export class InputRouter {
    private readonly targets = new Set<InputTarget>();
    private readonly subscriptions = new Map<InputTarget, Array<() => void>>();
    private readonly seen = new WeakSet<object>();
    private lastPointer: {
        x: number;
        y: number;
    } | null = null;
    private lastPointerTime = 0;
    private lastClick: {
        time: number;
        button: number;
    } | null = null;
    handled = false;
    readonly onAction: Array<(event: InputEventAction) => void> = [];
    constructor(private readonly context: GameContext) { }
    static of(context: GameContext): InputRouter {
        return context.service('inputRouter', () => new InputRouter(context));
    }
    get helix(): HelixRoot {
        return this.context.helix;
    }
    register(target: InputTarget): void {
        if (this.targets.has(target))
            return;
        this.targets.add(target);
        const disposers: Array<() => void> = [];
        for (const source of INPUT_SOURCES) {
            try {
                disposers.push(target.$subscribeInput(source, (payload: unknown) => this.receive(source, payload)));
            }
            catch {
            }
        }
        this.subscriptions.set(target, disposers);
    }
    unregister(target: InputTarget): void {
        if (!this.targets.delete(target))
            return;
        for (const dispose of this.subscriptions.get(target) ?? [])
            dispose();
        this.subscriptions.delete(target);
    }
    private receive(source: InputSource, payload: unknown): void {
        if (payload !== null && typeof payload === 'object') {
            if (this.seen.has(payload))
                return;
            this.seen.add(payload);
        }
        const helix = this.helix;
        const now = Number((helix.time as AnyRecord | undefined)?.now ?? 0);
        switch (source) {
            case 'onKeyDown':
                this.dispatch(InputEventKey.fromPayload(helix, payload as KeyPayload, true));
                return;
            case 'onKeyUp':
                this.dispatch(InputEventKey.fromPayload(helix, payload as KeyPayload, false));
                return;
            case 'onPointerDown': {
                const pointer = payload as PointerPayload;
                const double = this.lastClick !== null && this.lastClick.button === pointer.button && now - this.lastClick.time < 0.4;
                this.lastClick = { time: now, button: pointer.button };
                this.dispatch(InputEventMouseButton.fromPayload(helix, pointer, true, double));
                return;
            }
            case 'onPointerUp':
                this.dispatch(InputEventMouseButton.fromPayload(helix, payload as PointerPayload, false, false));
                return;
            case 'onPointerMove': {
                const pointer = payload as PointerPayload;
                const relative = this.lastPointer ? new Vector2(pointer.x - this.lastPointer.x, pointer.y - this.lastPointer.y) : new Vector2();
                const delta = this.lastPointer ? now - this.lastPointerTime : 0;
                this.lastPointer = { x: pointer.x, y: pointer.y };
                this.lastPointerTime = now;
                this.dispatch(InputEventMouseMotion.fromPayload(helix, pointer, relative, delta));
                return;
            }
            case 'onWheel': {
                const wheel = payload as {
                    deltaX: number;
                    deltaY: number;
                };
                const position = this.lastPointer ? new Vector2(this.lastPointer.x, this.lastPointer.y) : new Vector2();
                for (const event of InputEventMouseButton.wheel(helix, wheel.deltaY, wheel.deltaX, position))
                    this.dispatch(event);
                return;
            }
            case 'onGamepadButtonDown':
                this.dispatch(InputEventJoypadButton.fromPayload(helix, payload as {
                    pad: number;
                    button: number;
                }, true));
                return;
            case 'onGamepadButtonUp':
                this.dispatch(InputEventJoypadButton.fromPayload(helix, payload as {
                    pad: number;
                    button: number;
                }, false));
                return;
            default:
                return;
        }
    }
    dispatch(event: InputEvent): void {
        if (event instanceof InputEventAction)
            for (const listener of this.onAction)
                listener(event);
        this.handled = false;
        const targets = Array.from(this.targets).filter((target) => !target.$freed);
        const phases: Array<[
            keyof InputTarget & string,
            (target: InputTarget) => boolean
        ]> = [
            ['_input', (target) => target.$inputEnabled],
            ['_shortcut_input', (target) => target.$shortcutInputEnabled],
            ['_unhandled_key_input', (target) => target.$unhandledKeyInputEnabled && event instanceof InputEventKey],
            ['_unhandled_input', (target) => target.$unhandledInputEnabled],
        ];
        for (const [method, enabled] of phases) {
            for (const target of targets) {
                if (this.handled)
                    return;
                if (target.$freed || !enabled(target))
                    continue;
                (target[method] as (event: unknown) => void).call(target, event);
            }
        }
    }
}
