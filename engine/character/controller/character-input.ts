export interface InputFrame {
    x: number;
    z: number;
    run: boolean;
    jump: boolean;
    crouchToggles: number;
    lookX: number;
    lookY: number;
    wheel: number;
}
const CAPTURED_CODES = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyC']);
function isTextEntry(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement))
        return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}
export class CharacterInput {
    private readonly held = new Set<string>();
    private readonly abort = new AbortController();
    private jumpQueued = false;
    private crouchToggles = 0;
    private lookX = 0;
    private lookY = 0;
    private wheel = 0;
    private dragging = false;
    constructor(private readonly canvas: HTMLCanvasElement, private readonly onPointerLockChange: (locked: boolean) => void) {
        const { signal } = this.abort;
        window.addEventListener('keydown', this.onKeyDown, { capture: true, signal });
        window.addEventListener('keyup', this.onKeyUp, { capture: true, signal });
        window.addEventListener('blur', this.release, { signal });
        document.addEventListener('pointerlockchange', this.onLockChange, { signal });
        canvas.addEventListener('pointerdown', this.onPointerDown, { signal });
        canvas.addEventListener('pointermove', this.onPointerMove, { signal });
        canvas.addEventListener('pointerup', this.onPointerUp, { signal });
        canvas.addEventListener('pointercancel', this.onPointerUp, { signal });
        canvas.addEventListener('wheel', this.onWheel, { passive: false, signal });
    }
    get pointerLocked(): boolean {
        return document.pointerLockElement === this.canvas;
    }
    dispose(): void {
        this.abort.abort();
        if (this.pointerLocked)
            document.exitPointerLock();
    }
    consume(out: InputFrame): void {
        const { held } = this;
        out.x = (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0);
        out.z = (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0) - (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0);
        out.run = held.has('ShiftLeft') || held.has('ShiftRight');
        out.jump = this.jumpQueued;
        out.crouchToggles = this.crouchToggles;
        out.lookX = this.lookX;
        out.lookY = this.lookY;
        out.wheel = this.wheel;
        this.jumpQueued = false;
        this.crouchToggles = 0;
        this.lookX = 0;
        this.lookY = 0;
        this.wheel = 0;
    }
    private readonly onKeyDown = (event: KeyboardEvent): void => {
        if (event.ctrlKey || event.metaKey || event.altKey || !CAPTURED_CODES.has(event.code) || isTextEntry(event.target))
            return;
        if (!event.repeat) {
            if (event.code === 'Space')
                this.jumpQueued = true;
            else if (event.code === 'KeyC')
                this.crouchToggles++;
        }
        this.held.add(event.code);
        event.preventDefault();
    };
    private readonly onKeyUp = (event: KeyboardEvent): void => {
        if (this.held.delete(event.code))
            event.preventDefault();
    };
    private readonly release = (): void => {
        this.held.clear();
        this.dragging = false;
    };
    private readonly onPointerDown = (event: PointerEvent): void => {
        if (event.button !== 0 && event.button !== 2)
            return;
        this.canvas.focus();
        this.dragging = true;
        this.canvas.setPointerCapture(event.pointerId);
        event.preventDefault();
        if (event.button !== 0 || this.pointerLocked)
            return;
        const request = this.canvas.requestPointerLock();
        if (request && typeof (request as Promise<void>).catch === 'function')
            (request as Promise<void>).catch(() => undefined);
    };
    private readonly onPointerMove = (event: PointerEvent): void => {
        if (!this.pointerLocked && !this.dragging)
            return;
        this.lookX += event.movementX;
        this.lookY += event.movementY;
    };
    private readonly onPointerUp = (event: PointerEvent): void => {
        if (!this.dragging)
            return;
        this.dragging = false;
        if (this.canvas.hasPointerCapture(event.pointerId))
            this.canvas.releasePointerCapture(event.pointerId);
    };
    private readonly onWheel = (event: WheelEvent): void => {
        event.preventDefault();
        this.wheel += event.deltaY;
    };
    private readonly onLockChange = (): void => {
        this.onPointerLockChange(this.pointerLocked);
    };
}
