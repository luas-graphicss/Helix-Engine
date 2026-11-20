import { PRESS_POINT, RELEASE_POINT_RATIO } from '../actions/binding-limits';
import type { InputActionType } from '../actions/input-asset';
import { resolveControl, type ResolvedControl } from '../controls/control-descriptor';
import { formatControlPath, parseControlPath } from '../controls/control-path';
import { ANY_KEY } from '../controls/device-layouts';
import type { InputDevice } from '../devices/input-device';
export interface RebindRequest {
    readonly expected: InputActionType;
    readonly devices: () => readonly InputDevice[];
    readonly excludedLayouts?: readonly string[];
    readonly cancelPath?: string | null;
    readonly timeout?: number;
}
export type RebindOutcome = {
    readonly status: 'completed';
    readonly path: string;
    readonly device: InputDevice;
} | {
    readonly status: 'canceled';
} | {
    readonly status: 'timedOut';
};
export const DEFAULT_CANCEL_PATH = '<Keyboard>/Escape';
const RELATIVE_TRAVEL = 120;
interface WatchedControl {
    readonly device: InputDevice;
    readonly control: string;
}
interface Candidate extends WatchedControl {
    readonly path: string;
    readonly strength: number;
    readonly immediate: boolean;
}
function controlKey(device: InputDevice, control: string): string {
    return `${device.id}|${control}`;
}
function targetControl({ descriptor, member }: ResolvedControl, control: string, expected: InputActionType): string | null {
    if (descriptor.motion === 'absolute')
        return null;
    const isAxisMember = member === 'x' || member === 'y';
    if (expected === 'vector2')
        return isAxisMember ? descriptor.id : null;
    if (descriptor.motion === 'relative')
        return null;
    if (member === null)
        return control;
    return (expected === 'axis') === isAxisMember ? control : null;
}
export class RebindListener {
    private readonly held = new Set<string>();
    private readonly travel = new Map<string, number>();
    private pending: Candidate | null = null;
    private canceling: WatchedControl | null = null;
    private elapsed = 0;
    constructor(private readonly request: RebindRequest) {
        for (const device of request.devices())
            for (const [control, value] of device.values)
                if (Math.abs(value) >= PRESS_POINT)
                    this.held.add(controlKey(device, control));
    }
    update(delta: number): RebindOutcome | null {
        if (this.pending)
            return this.isReleased(this.pending) ? { status: 'completed', path: this.pending.path, device: this.pending.device } : null;
        if (this.canceling)
            return this.isReleased(this.canceling) ? { status: 'canceled' } : null;
        this.elapsed += delta;
        const { timeout = 0 } = this.request;
        if (timeout > 0 && this.elapsed >= timeout)
            return { status: 'timedOut' };
        const candidate = this.scan();
        if (candidate?.immediate)
            return { status: 'completed', path: candidate.path, device: candidate.device };
        this.pending = candidate;
        return null;
    }
    private isReleased({ device, control }: WatchedControl): boolean {
        return !this.request.devices().includes(device) || Math.abs(device.read(control)) < PRESS_POINT * RELEASE_POINT_RATIO;
    }
    private scan(): Candidate | null {
        const { excludedLayouts = [], cancelPath = DEFAULT_CANCEL_PATH } = this.request;
        const cancel = cancelPath === null ? null : parseControlPath(cancelPath);
        let strongest: Candidate | null = null;
        for (const device of this.request.devices())
            for (const [control, value] of device.values) {
                const strength = Math.abs(value);
                const key = controlKey(device, control);
                if (strength < PRESS_POINT) {
                    this.held.delete(key);
                    continue;
                }
                if (this.held.has(key))
                    continue;
                if (cancel && device.layout === cancel.layout && control === cancel.control) {
                    this.canceling = { device, control };
                    return null;
                }
                if (excludedLayouts.includes(device.layout) || control === ANY_KEY)
                    continue;
                const candidate = this.candidateFor(device, control, strength);
                if (candidate && (!strongest || candidate.strength > strongest.strength))
                    strongest = candidate;
            }
        return strongest;
    }
    private candidateFor(device: InputDevice, control: string, strength: number): Candidate | null {
        const { expected } = this.request;
        const resolved = resolveControl(device.controls, control);
        const unknownTarget = expected === 'vector2' ? null : control;
        const target = resolved ? targetControl(resolved, control, expected) : unknownTarget;
        if (target === null)
            return null;
        const relative = resolved?.descriptor.motion === 'relative';
        if (relative && !this.hasTraveled(device, target, strength))
            return null;
        return { device, control, path: formatControlPath(device.layout, target, device.usages[0] ?? null), strength, immediate: relative };
    }
    private hasTraveled(device: InputDevice, target: string, distance: number): boolean {
        const key = controlKey(device, target);
        const total = (this.travel.get(key) ?? 0) + distance;
        this.travel.set(key, total);
        return total >= RELATIVE_TRAVEL;
    }
}
