import { isTextEntry, realEventTarget } from '@/engine/character/controller/character-input';
import type { VehicleInput } from './vehicle-input';
const FORWARD_CODES = ['KeyW', 'ArrowUp'];
const BACKWARD_CODES = ['KeyS', 'ArrowDown'];
const LEFT_CODES = ['KeyA', 'ArrowLeft'];
const RIGHT_CODES = ['KeyD', 'ArrowRight'];
const HANDBRAKE_CODES = ['Space'];
const CAPTURED_CODES = new Set([...FORWARD_CODES, ...BACKWARD_CODES, ...LEFT_CODES, ...RIGHT_CODES, ...HANDBRAKE_CODES]);
export class KeyboardDriver {
    private readonly held = new Set<string>();
    private readonly abort = new AbortController();
    constructor() {
        const { signal } = this.abort;
        window.addEventListener('keydown', this.onKeyDown, { capture: true, signal });
        window.addEventListener('keyup', this.onKeyUp, { capture: true, signal });
        window.addEventListener('blur', this.release, { signal });
    }
    dispose(): void {
        this.abort.abort();
    }
    read(out: VehicleInput): void {
        out.throttle = this.axis(FORWARD_CODES, BACKWARD_CODES);
        out.steer = this.axis(RIGHT_CODES, LEFT_CODES);
        out.handbrake = this.isHeld(HANDBRAKE_CODES) ? 1 : 0;
        out.brake = 0;
    }
    private axis(positive: readonly string[], negative: readonly string[]): number {
        return (this.isHeld(positive) ? 1 : 0) - (this.isHeld(negative) ? 1 : 0);
    }
    private isHeld(codes: readonly string[]): boolean {
        return codes.some((code) => this.held.has(code));
    }
    private readonly onKeyDown = (event: KeyboardEvent): void => {
        if (event.ctrlKey || event.metaKey || event.altKey || !CAPTURED_CODES.has(event.code) || isTextEntry(realEventTarget(event)))
            return;
        this.held.add(event.code);
        event.preventDefault();
    };
    private readonly onKeyUp = (event: KeyboardEvent): void => {
        if (this.held.delete(event.code))
            event.preventDefault();
    };
    private readonly release = (): void => {
        this.held.clear();
    };
}
