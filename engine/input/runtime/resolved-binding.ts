import { COMPOSITE_PARTS, type InputBinding } from '../actions/input-asset';
import type { InputDevice } from '../devices/input-device';
import type { BindingOverrides } from '../rebinding/binding-overrides';
import { resolveReaders, type ControlReader } from './control-reader';
import type { InputVector } from './input-vector';
export interface ResolvedBinding {
    readonly binding: InputBinding;
    readonly readers: readonly ControlReader[];
    readonly parts: readonly (readonly ControlReader[])[];
}
export interface BindingSample extends InputVector {
    device: InputDevice | null;
}
const NEGATIVE_PART = COMPOSITE_PARTS.axis1d.indexOf('negative');
const POSITIVE_PART = COMPOSITE_PARTS.axis1d.indexOf('positive');
const UP_PART = COMPOSITE_PARTS.vector2.indexOf('up');
const DOWN_PART = COMPOSITE_PARTS.vector2.indexOf('down');
const LEFT_PART = COMPOSITE_PARTS.vector2.indexOf('left');
const RIGHT_PART = COMPOSITE_PARTS.vector2.indexOf('right');
export function resolveBinding(binding: InputBinding, devices: readonly InputDevice[], overrides: BindingOverrides): ResolvedBinding {
    const { composite } = binding;
    if (composite === null)
        return { binding, readers: resolveReaders(overrides.pathOf(binding.id, null) ?? binding.path, devices), parts: [] };
    const parts = COMPOSITE_PARTS[composite].map((name) => {
        const stored = binding.parts.find((part) => part.name === name)?.path ?? '';
        return resolveReaders(overrides.pathOf(binding.id, name) ?? stored, devices);
    });
    return { binding, readers: [], parts };
}
function readStrongest(readers: readonly ControlReader[], sample: BindingSample): void {
    let strongest = 0;
    for (const reader of readers) {
        const x = reader.device.read(reader.x);
        const y = reader.y === null ? 0 : reader.device.read(reader.y);
        const strength = Math.hypot(x, y);
        if (strength <= strongest)
            continue;
        strongest = strength;
        sample.x = x;
        sample.y = y;
        sample.device = reader.device;
    }
}
function readPart(readers: readonly ControlReader[]): number {
    let strongest = 0;
    for (const reader of readers)
        strongest = Math.max(strongest, reader.device.read(reader.x));
    return strongest;
}
function strongestPartDevice(parts: readonly (readonly ControlReader[])[]): InputDevice | null {
    let strongest = 0;
    let device: InputDevice | null = null;
    for (const readers of parts)
        for (const reader of readers) {
            const value = reader.device.read(reader.x);
            if (value <= strongest)
                continue;
            strongest = value;
            device = reader.device;
        }
    return device;
}
export function readBinding({ binding, readers, parts }: ResolvedBinding, sample: BindingSample): void {
    sample.x = 0;
    sample.y = 0;
    sample.device = null;
    if (binding.composite === null) {
        readStrongest(readers, sample);
        return;
    }
    if (binding.composite === 'axis1d') {
        sample.x = readPart(parts[POSITIVE_PART]) - readPart(parts[NEGATIVE_PART]);
    }
    else {
        sample.x = readPart(parts[RIGHT_PART]) - readPart(parts[LEFT_PART]);
        sample.y = readPart(parts[UP_PART]) - readPart(parts[DOWN_PART]);
        const length = Math.hypot(sample.x, sample.y);
        if (length > 1) {
            sample.x /= length;
            sample.y /= length;
        }
    }
    if (sample.x !== 0 || sample.y !== 0)
        sample.device = strongestPartDevice(parts);
}
