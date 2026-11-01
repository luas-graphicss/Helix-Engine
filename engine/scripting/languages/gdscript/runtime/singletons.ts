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
