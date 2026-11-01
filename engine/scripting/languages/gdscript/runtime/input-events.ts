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
