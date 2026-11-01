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
}
