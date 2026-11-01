import { isTextEntry, realEventTarget } from '@/engine/character/controller/character-input';
import { HelixArgumentError } from './script-errors';
import type { EventBus } from './event-bus';
export interface PointerState {
    x: number;
    y: number;
    dx: number;
    dy: number;
    buttons: number;
    wheel: number;
    inside: boolean;
    u: number;
    v: number;
}
export interface TouchState {
    readonly id: number;
    x: number;
    y: number;
    dx: number;
    dy: number;
}
export interface KeyEventPayload {
    readonly code: string;
    readonly key: string;
    readonly repeat: boolean;
    readonly shift: boolean;
    readonly ctrl: boolean;
    readonly alt: boolean;
    readonly meta: boolean;
}
export interface PointerEventPayload {
    readonly x: number;
    readonly y: number;
    readonly button: number;
    readonly buttons: number;
    readonly pointerType: string;
}
export interface GamepadSnapshot {
    readonly index: number;
    readonly id: string;
    readonly axes: readonly number[];
    readonly buttons: readonly {
        pressed: boolean;
        value: number;
    }[];
}
interface ActionBinding {
    readonly keys: Set<string>;
    readonly gamepadButtons: Array<{
        pad: number | null;
        index: number;
    }>;
}
export type InputCapture = 'game' | 'gui' | 'both';
function normalizeKeyName(key: string): string {
    if (key.length === 1)
        return key.toLowerCase();
    return key;
}
const GAMEPAD_BUTTON_NAMES: Record<string, number> = { a: 0, b: 1, x: 2, y: 3, lb: 4, rb: 5, lt: 6, rt: 7, back: 8, select: 8, start: 9, l3: 10, r3: 11, up: 12, down: 13, left: 14, right: 15, home: 16 };
function parseGamepadBinding(text: string): {
    pad: number | null;
    index: number;
} | null {
    const match = /^gamepad(\d*):(.+)$/i.exec(text.trim());
    if (!match)
        return null;
    const pad = match[1] ? Number(match[1]) : null;
    const name = match[2].trim().toLowerCase();
    const index = /^\d+$/.test(name) ? Number(name) : GAMEPAD_BUTTON_NAMES[name];
    return index === undefined ? null : { pad, index };
}
export class InputState {
    readonly down = new Set<string>();
    readonly pressed = new Set<string>();
    readonly released = new Set<string>();
    readonly keysDownLogical = new Set<string>();
    readonly pointer: PointerState = { x: 0, y: 0, dx: 0, dy: 0, buttons: 0, wheel: 0, inside: false, u: 0, v: 0 };
    readonly touches: TouchState[] = [];
    capture: InputCapture = 'both';
    cursor = 'default';
    private readonly actions = new Map<string, ActionBinding>();
    private abort = new AbortController();
    private canvas: HTMLCanvasElement | null = null;
    private previousGamepadButtons = new Map<number, boolean[]>();
    private pressedThisFrameGamepad = new Map<number, Set<number>>();
    private textEntryFocused = false;
    constructor(private readonly bus: EventBus) { }
    attach(canvas: HTMLCanvasElement | null): void {
        this.abort.abort();
        this.abort = new AbortController();
        this.canvas = canvas;
        const { signal } = this.abort;
        window.addEventListener('keydown', this.onKeyDown, { capture: true, signal });
        window.addEventListener('keyup', this.onKeyUp, { capture: true, signal });
        window.addEventListener('blur', this.releaseAll, { signal });
        if (canvas) {
            canvas.addEventListener('pointermove', this.onPointerMove, { signal });
            canvas.addEventListener('pointerdown', this.onPointerDown, { signal });
            canvas.addEventListener('pointerup', this.onPointerUp, { signal });
            canvas.addEventListener('pointercancel', this.onPointerUp, { signal });
            canvas.addEventListener('pointerenter', this.onPointerEnter, { signal });
            canvas.addEventListener('pointerleave', this.onPointerLeave, { signal });
            canvas.addEventListener('wheel', this.onWheel, { passive: true, signal });
        }
    }
    dispose(): void {
        this.abort.abort();
        this.releaseAll();
        this.actions.clear();
    }
    get gameHasKeyboard(): boolean {
        return this.capture === 'game' || !this.textEntryFocused;
    }
    get pointerLocked(): boolean {
        return this.canvas !== null && document.pointerLockElement === this.canvas;
    }
    lockPointer(): void {
        const canvas = this.canvas;
        if (!canvas || this.pointerLocked)
            return;
        const request = canvas.requestPointerLock();
        if (request && typeof (request as Promise<void>).catch === 'function')
            (request as Promise<void>).catch(() => undefined);
    }
    unlockPointer(): void {
        if (this.pointerLocked)
            document.exitPointerLock();
    }
    endFrame(): void {
        this.pressed.clear();
        this.released.clear();
        this.pointer.dx = 0;
        this.pointer.dy = 0;
        this.pointer.wheel = 0;
        for (const touch of this.touches) {
            touch.dx = 0;
            touch.dy = 0;
        }
        this.pressedThisFrameGamepad.clear();
    }
    pollGamepads(): void {
        if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function')
            return;
        for (const pad of navigator.getGamepads()) {
            if (!pad)
                continue;
            const previous = this.previousGamepadButtons.get(pad.index) ?? [];
            const current = pad.buttons.map((button) => button.pressed);
            for (let index = 0; index < current.length; index++) {
                if (current[index] && !previous[index]) {
                    let set = this.pressedThisFrameGamepad.get(pad.index);
                    if (!set)
                        this.pressedThisFrameGamepad.set(pad.index, (set = new Set()));
                    set.add(index);
                    this.bus.emit('input.gamepadButtonDown', { pad: pad.index, button: index });
                }
                else if (!current[index] && previous[index]) {
                    this.bus.emit('input.gamepadButtonUp', { pad: pad.index, button: index });
                }
            }
            this.previousGamepadButtons.set(pad.index, current);
        }
    }
    isDown(key: string): boolean {
        return this.down.has(key) || this.keysDownLogical.has(normalizeKeyName(key));
    }
    wasPressed(key: string): boolean {
        return this.pressed.has(key) || this.pressed.has(normalizeKeyName(key));
    }
    wasReleased(key: string): boolean {
        return this.released.has(key) || this.released.has(normalizeKeyName(key));
    }
    gamepads(): GamepadSnapshot[] {
        if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function')
            return [];
        const list: GamepadSnapshot[] = [];
        for (const pad of navigator.getGamepads()) {
            if (!pad)
                continue;
            list.push({ index: pad.index, id: pad.id, axes: Array.from(pad.axes), buttons: pad.buttons.map((button) => ({ pressed: button.pressed, value: button.value })) });
        }
        return list;
    }
    axis(pad: number, index: number): number {
        const gamepad = navigator.getGamepads?.()[pad];
        return gamepad?.axes[index] ?? 0;
    }
    button(pad: number, index: number): boolean {
        const gamepad = navigator.getGamepads?.()[pad];
        return gamepad?.buttons[index]?.pressed ?? false;
    }
    rumble(pad: number, strong: number, weak: number, ms: number): void {
        const gamepad = navigator.getGamepads?.()[pad];
        const actuator = (gamepad as unknown as {
            vibrationActuator?: {
                playEffect?: (type: string, params: object) => Promise<unknown>;
            };
        } | null)?.vibrationActuator;
        void actuator?.playEffect?.('dual-rumble', { startDelay: 0, duration: Math.max(0, ms), strongMagnitude: Math.max(0, Math.min(1, strong)), weakMagnitude: Math.max(0, Math.min(1, weak)) })?.catch?.(() => undefined);
    }
    defineAction(name: string, bindings: readonly string[]): void {
        if (typeof name !== 'string' || !name)
            throw new HelixArgumentError('helix.input.actions.define', 'o nome da ação precisa ser uma string não vazia.');
        const keys = new Set<string>();
        const gamepadButtons: Array<{
            pad: number | null;
            index: number;
        }> = [];
        for (const binding of bindings) {
            const gamepad = parseGamepadBinding(binding);
            if (gamepad)
                gamepadButtons.push(gamepad);
            else
                keys.add(binding);
        }
        this.actions.set(name, { keys, gamepadButtons });
    }
    actionBindings(name: string): string[] {
        const binding = this.actions.get(name);
        if (!binding)
            return [];
        return [...binding.keys, ...binding.gamepadButtons.map((entry) => `Gamepad${entry.pad ?? ''}:${entry.index}`)];
    }
    actionNames(): string[] {
        return Array.from(this.actions.keys());
    }
    private requireAction(name: string): ActionBinding {
        const binding = this.actions.get(name);
        if (!binding)
            throw new HelixArgumentError('helix.input.action', `a ação "${name}" não foi definida; use helix.input.actions.define("${name}", [...]).`);
        return binding;
    }
    actionDown(name: string): boolean {
        const binding = this.requireAction(name);
        for (const key of binding.keys)
            if (this.isDown(key))
                return true;
        for (const entry of binding.gamepadButtons) {
            if (entry.pad !== null) {
                if (this.button(entry.pad, entry.index))
                    return true;
                continue;
            }
            for (const pad of this.gamepads())
                if (pad.buttons[entry.index]?.pressed)
                    return true;
        }
        return false;
    }
    actionPressed(name: string): boolean {
        const binding = this.requireAction(name);
        for (const key of binding.keys)
            if (this.wasPressed(key))
                return true;
        for (const entry of binding.gamepadButtons) {
            for (const [pad, set] of this.pressedThisFrameGamepad) {
                if ((entry.pad === null || entry.pad === pad) && set.has(entry.index))
                    return true;
            }
        }
        return false;
    }
    actionReleased(name: string): boolean {
        const binding = this.requireAction(name);
        for (const key of binding.keys)
            if (this.wasReleased(key))
                return true;
        return false;
    }
    axis2d(config: {
        up: string;
        down: string;
        left: string;
        right: string;
        stick?: number | boolean;
    }): {
        x: number;
        y: number;
    } {
        let x = (this.isDown(config.right) ? 1 : 0) - (this.isDown(config.left) ? 1 : 0);
        let y = (this.isDown(config.up) ? 1 : 0) - (this.isDown(config.down) ? 1 : 0);
        if (config.stick !== undefined && config.stick !== false) {
            const pad = typeof config.stick === 'number' ? config.stick : 0;
            const gx = this.axis(pad, 0);
            const gy = -this.axis(pad, 1);
            if (Math.abs(gx) > 0.15)
                x += gx;
            if (Math.abs(gy) > 0.15)
                y += gy;
        }
        const length = Math.hypot(x, y);
        if (length > 1) {
            x /= length;
            y /= length;
        }
        return { x, y };
    }
    private keyPayload(event: KeyboardEvent): KeyEventPayload {
        return { code: event.code, key: event.key, repeat: event.repeat, shift: event.shiftKey, ctrl: event.ctrlKey, alt: event.altKey, meta: event.metaKey };
    }
    private readonly onKeyDown = (event: KeyboardEvent): void => {
        this.textEntryFocused = isTextEntry(realEventTarget(event));
        if (!this.gameHasKeyboard)
            return;
        const logical = normalizeKeyName(event.key);
        if (!event.repeat) {
            this.pressed.add(event.code);
            this.pressed.add(logical);
        }
        this.down.add(event.code);
        this.keysDownLogical.add(logical);
        this.bus.emit('input.keyDown', this.keyPayload(event));
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey && !event.isComposing)
            this.bus.emit('input.text', { text: event.key });
    };
    private readonly onKeyUp = (event: KeyboardEvent): void => {
        const logical = normalizeKeyName(event.key);
        if (this.down.delete(event.code)) {
            this.released.add(event.code);
            this.released.add(logical);
        }
        this.keysDownLogical.delete(logical);
        this.textEntryFocused = isTextEntry(realEventTarget(event));
        this.bus.emit('input.keyUp', this.keyPayload(event));
    };
    private readonly releaseAll = (): void => {
        for (const code of this.down)
            this.released.add(code);
        this.down.clear();
        this.keysDownLogical.clear();
        this.pointer.buttons = 0;
        this.touches.length = 0;
    };
    private updatePointer(event: PointerEvent): void {
        const canvas = this.canvas;
        if (!canvas)
            return;
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        if (this.pointerLocked) {
            this.pointer.dx += event.movementX;
            this.pointer.dy += event.movementY;
        }
        else {
            this.pointer.dx += x - this.pointer.x;
            this.pointer.dy += y - this.pointer.y;
            this.pointer.x = x;
            this.pointer.y = y;
        }
        this.pointer.u = rect.width > 0 ? x / rect.width : 0;
        this.pointer.v = rect.height > 0 ? y / rect.height : 0;
        this.pointer.buttons = event.buttons;
    }
    private pointerPayload(event: PointerEvent): PointerEventPayload {
        return { x: this.pointer.x, y: this.pointer.y, button: event.button, buttons: event.buttons, pointerType: event.pointerType };
    }
    private touchOf(event: PointerEvent): TouchState | null {
        if (event.pointerType !== 'touch')
            return null;
        return this.touches.find((touch) => touch.id === event.pointerId) ?? null;
    }
    private readonly onPointerMove = (event: PointerEvent): void => {
        this.updatePointer(event);
        const touch = this.touchOf(event);
        if (touch) {
            touch.dx += this.pointer.x - touch.x;
            touch.dy += this.pointer.y - touch.y;
            touch.x = this.pointer.x;
            touch.y = this.pointer.y;
        }
        this.bus.emit('input.pointerMove', this.pointerPayload(event));
    };
    private readonly onPointerDown = (event: PointerEvent): void => {
        this.updatePointer(event);
        if (event.pointerType === 'touch' && !this.touchOf(event))
            this.touches.push({ id: event.pointerId, x: this.pointer.x, y: this.pointer.y, dx: 0, dy: 0 });
        this.pressed.add(`Mouse${event.button}`);
        this.down.add(`Mouse${event.button}`);
        this.bus.emit('input.pointerDown', this.pointerPayload(event));
    };
    private readonly onPointerUp = (event: PointerEvent): void => {
        this.updatePointer(event);
        const index = this.touches.findIndex((touch) => touch.id === event.pointerId);
        if (index !== -1)
            this.touches.splice(index, 1);
        if (this.down.delete(`Mouse${event.button}`))
            this.released.add(`Mouse${event.button}`);
        this.bus.emit('input.pointerUp', this.pointerPayload(event));
    };
    private readonly onPointerEnter = (): void => {
        this.pointer.inside = true;
    };
    private readonly onPointerLeave = (): void => {
        this.pointer.inside = false;
    };
    private readonly onWheel = (event: WheelEvent): void => {
        this.pointer.wheel += event.deltaY;
        this.bus.emit('input.wheel', { deltaX: event.deltaX, deltaY: event.deltaY });
    };
}
