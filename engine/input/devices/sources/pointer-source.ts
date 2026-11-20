import { MOUSE_CONTROLS, PRIMARY_TOUCH, TOUCH_SLOT_COUNT, TOUCHSCREEN_CONTROLS, touchSlotId } from '../../controls/device-layouts';
import type { DeviceRegistry } from '../device-registry';
import { InputDevice } from '../input-device';
import type { DeviceSource, SourceContext } from './device-source';
const MOUSE_BUTTONS = ['leftButton', 'middleButton', 'rightButton', 'backButton', 'forwardButton'] as const;
const WHEEL_NOTCH = 100;
const TOUCH_POINTER = 'touch';
interface ActiveTouch {
    readonly pointerId: number;
    x: number;
    y: number;
    dx: number;
    dy: number;
}
function listen<TEvent extends Event>(target: EventTarget, type: string, listener: (event: TEvent) => void, options: AddEventListenerOptions): void {
    target.addEventListener(type, listener as EventListener, options);
}
export class PointerSource implements DeviceSource {
    private readonly mouse = new InputDevice({ id: 'mouse', layout: 'Mouse', name: 'Mouse', controls: MOUSE_CONTROLS });
    private readonly touchscreen = new InputDevice({ id: 'touchscreen', layout: 'Touchscreen', name: 'Tela de toque', controls: TOUCHSCREEN_CONTROLS });
    private readonly touches = new Array<ActiveTouch | null>(TOUCH_SLOT_COUNT).fill(null);
    private registry: DeviceRegistry | null = null;
    private surface: HTMLElement | null = null;
    private motionX = 0;
    private motionY = 0;
    private scrollX = 0;
    private scrollY = 0;
    attach({ registry, signal, surface }: SourceContext): void {
        this.registry = registry;
        this.surface = surface;
        registry.add(this.mouse);
        if (navigator.maxTouchPoints > 0)
            registry.add(this.touchscreen);
        const target: EventTarget = surface ?? window;
        listen(target, 'pointerdown', this.onPointerDown, { signal });
        listen(target, 'pointermove', this.onPointerMove, { signal });
        listen(target, 'wheel', this.onWheel, { passive: true, signal });
        listen(window, 'pointerup', this.onPointerUp, { signal });
        listen(window, 'pointercancel', this.onPointerUp, { signal });
        listen(window, 'blur', this.onBlur, { signal });
    }
    endFrame(): void {
        if (this.motionX !== 0 || this.motionY !== 0) {
            this.motionX = 0;
            this.motionY = 0;
            this.mouse.writeVector('delta', 0, 0);
        }
        if (this.scrollX !== 0 || this.scrollY !== 0) {
            this.scrollX = 0;
            this.scrollY = 0;
            this.mouse.writeVector('scroll', 0, 0);
        }
        for (let slot = 0; slot < this.touches.length; slot++) {
            const touch = this.touches[slot];
            if (!touch || (touch.dx === 0 && touch.dy === 0))
                continue;
            touch.dx = 0;
            touch.dy = 0;
            this.writeTouch(slot);
        }
    }
    private readonly onPointerDown = (event: PointerEvent): void => {
        if (event.pointerType === TOUCH_POINTER) {
            this.beginTouch(event);
            return;
        }
        this.moveMouse(event);
        const button = MOUSE_BUTTONS[event.button];
        if (button)
            this.mouse.write(button, 1);
    };
    private readonly onPointerMove = (event: PointerEvent): void => {
        if (event.pointerType === TOUCH_POINTER)
            this.moveTouch(event);
        else
            this.moveMouse(event);
    };
    private readonly onPointerUp = (event: PointerEvent): void => {
        if (event.pointerType === TOUCH_POINTER) {
            this.endTouch(event);
            return;
        }
        const button = MOUSE_BUTTONS[event.button];
        if (button)
            this.mouse.write(button, 0);
    };
    private readonly onWheel = (event: WheelEvent): void => {
        this.scrollX += event.deltaX / WHEEL_NOTCH;
        this.scrollY -= event.deltaY / WHEEL_NOTCH;
        this.mouse.writeVector('scroll', this.scrollX, this.scrollY);
    };
    private readonly onBlur = (): void => {
        this.touches.fill(null);
        this.mouse.release();
        this.touchscreen.release();
    };
    private localPoint(event: PointerEvent): {
        x: number;
        y: number;
    } {
        const rect = this.surface?.getBoundingClientRect();
        return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) };
    }
    private moveMouse(event: PointerEvent): void {
        const { x, y } = this.localPoint(event);
        this.motionX += event.movementX;
        this.motionY -= event.movementY;
        this.mouse.writeVector('position', x, y);
        this.mouse.writeVector('delta', this.motionX, this.motionY);
    }
    private slotOf(pointerId: number): number {
        return this.touches.findIndex((touch) => touch?.pointerId === pointerId);
    }
    private beginTouch(event: PointerEvent): void {
        const slot = this.touches.indexOf(null);
        if (slot < 0)
            return;
        this.registry?.add(this.touchscreen);
        const { x, y } = this.localPoint(event);
        this.touches[slot] = { pointerId: event.pointerId, x, y, dx: 0, dy: 0 };
        this.writeTouch(slot);
    }
    private moveTouch(event: PointerEvent): void {
        const slot = this.slotOf(event.pointerId);
        const touch = this.touches[slot];
        if (!touch)
            return;
        const { x, y } = this.localPoint(event);
        touch.dx += x - touch.x;
        touch.dy -= y - touch.y;
        touch.x = x;
        touch.y = y;
        this.writeTouch(slot);
    }
    private endTouch(event: PointerEvent): void {
        const slot = this.slotOf(event.pointerId);
        if (slot < 0)
            return;
        this.touches[slot] = null;
        this.writeTouch(slot);
    }
    private writeTouch(slot: number): void {
        this.writeTouchControls(touchSlotId(slot), this.touches[slot]);
        this.writeTouchControls(PRIMARY_TOUCH, this.touches.find((touch) => touch !== null) ?? null);
    }
    private writeTouchControls(id: string, touch: ActiveTouch | null): void {
        this.touchscreen.write(`${id}/press`, touch ? 1 : 0);
        this.touchscreen.writeVector(`${id}/delta`, touch?.dx ?? 0, touch?.dy ?? 0);
        if (touch)
            this.touchscreen.writeVector(`${id}/position`, touch.x, touch.y);
    }
}
