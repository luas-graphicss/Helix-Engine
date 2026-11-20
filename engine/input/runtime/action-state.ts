import { PRESS_POINT, RELEASE_POINT_RATIO } from '../actions/binding-limits';
import { DEFAULT_INTERACTION, type InputAction, type InputActionMap } from '../actions/input-asset';
import type { InputDevice } from '../devices/input-device';
import type { InputVector } from './input-vector';
import { InteractionTracker, type InteractionSignal, type InteractionStep } from './interactions';
import { applyProcessors } from './processors';
import { readBinding, type BindingSample, type ResolvedBinding } from './resolved-binding';
export type ActionPhase = 'waiting' | InteractionSignal;
export type ActionListener = (state: ActionState, signal: InteractionSignal) => void;
const NEVER = -1;
export class ActionState {
    readonly value: InputVector = { x: 0, y: 0 };
    phase: ActionPhase = 'waiting';
    device: InputDevice | null = null;
    isPressed = false;
    pressedFrame = NEVER;
    releasedFrame = NEVER;
    performedFrame = NEVER;
    private bindings: readonly ResolvedBinding[] = [];
    private frame = 0;
    private readonly tracker = new InteractionTracker();
    private readonly sample: BindingSample = { x: 0, y: 0, device: null };
    private readonly step: InteractionStep = { interaction: DEFAULT_INTERACTION, continuous: false, actuated: false, changed: false, delta: 0 };
    private readonly listeners: Record<InteractionSignal, Set<ActionListener>> = { started: new Set(), performed: new Set(), canceled: new Set() };
    constructor(public map: InputActionMap, public action: InputAction, readonly player: number | null, private readonly announce: ActionListener) { }
    get path(): string {
        return `${this.map.name}/${this.action.name}`;
    }
    get resolved(): readonly ResolvedBinding[] {
        return this.bindings;
    }
    redefine(map: InputActionMap, action: InputAction): void {
        this.map = map;
        this.action = action;
    }
    bind(bindings: readonly ResolvedBinding[]): void {
        this.bindings = bindings;
    }
    on(signal: InteractionSignal, listener: ActionListener): () => void {
        this.listeners[signal].add(listener);
        return () => this.listeners[signal].delete(listener);
    }
    update(delta: number, frame: number): void {
        const { sample, step } = this;
        let strongest = 0;
        let x = 0;
        let y = 0;
        for (const resolved of this.bindings) {
            readBinding(resolved, sample);
            applyProcessors(sample, resolved.binding.processors);
            const strength = Math.hypot(sample.x, sample.y);
            if (strength <= strongest)
                continue;
            strongest = strength;
            x = sample.x;
            y = sample.y;
            step.interaction = resolved.binding.interaction;
            this.device = sample.device;
        }
        this.settle(x, y, delta, frame);
    }
    release(frame: number): void {
        this.settle(0, 0, 0, frame);
    }
    private settle(rawX: number, rawY: number, delta: number, frame: number): void {
        const { step, value } = this;
        const { type } = this.action;
        const x = type === 'button' ? Math.min(1, Math.hypot(rawX, rawY)) : rawX;
        const y = type === 'vector2' ? rawY : 0;
        const strength = Math.hypot(x, y);
        const pressPoint = type === 'button' || step.interaction.kind !== 'press' ? PRESS_POINT : 0;
        const actuated = this.isPressed ? strength > pressPoint * RELEASE_POINT_RATIO : strength > 0 && strength >= pressPoint;
        if (!this.isPressed && this.phase !== 'waiting')
            this.phase = 'waiting';
        step.changed = x !== value.x || y !== value.y;
        step.continuous = type !== 'button';
        step.actuated = actuated;
        step.delta = delta;
        value.x = x;
        value.y = y;
        this.frame = frame;
        if (actuated && !this.isPressed)
            this.pressedFrame = frame;
        if (!actuated && this.isPressed)
            this.releasedFrame = frame;
        this.isPressed = actuated;
        this.tracker.step(step, this.emit);
    }
    private readonly emit = (signal: InteractionSignal): void => {
        this.phase = signal;
        if (signal === 'performed')
            this.performedFrame = this.frame;
        const listeners = this.listeners[signal];
        if (listeners.size > 0)
            for (const listener of Array.from(listeners))
                listener(this, signal);
        this.announce(this, signal);
    };
}
