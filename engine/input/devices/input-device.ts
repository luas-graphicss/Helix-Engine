import type { ControlDescriptor } from '../controls/control-descriptor';
const ACTIVITY_THRESHOLD = 0.25;
export interface InputDeviceOptions {
    readonly id: string;
    readonly layout: string;
    readonly name: string;
    readonly controls: readonly ControlDescriptor[];
    readonly usages?: readonly string[];
}
export class InputDevice {
    readonly id: string;
    readonly layout: string;
    readonly name: string;
    readonly controls: readonly ControlDescriptor[];
    readonly usages: readonly string[];
    readonly values = new Map<string, number>();
    activity = 0;
    constructor({ id, layout, name, controls, usages = [] }: InputDeviceOptions) {
        this.id = id;
        this.layout = layout;
        this.name = name;
        this.controls = controls;
        this.usages = usages;
    }
    read(control: string): number {
        return this.values.get(control) ?? 0;
    }
    write(control: string, value: number): void {
        const next = Number.isFinite(value) ? value : 0;
        if (this.read(control) === next)
            return;
        this.values.set(control, next);
        if (Math.abs(next) >= ACTIVITY_THRESHOLD)
            this.activity++;
    }
    writeVector(control: string, x: number, y: number): void {
        this.write(`${control}/x`, x);
        this.write(`${control}/y`, y);
        this.write(`${control}/up`, Math.max(0, y));
        this.write(`${control}/down`, Math.max(0, -y));
        this.write(`${control}/left`, Math.max(0, -x));
        this.write(`${control}/right`, Math.max(0, x));
    }
    release(): void {
        for (const control of this.values.keys())
            this.values.set(control, 0);
    }
}
