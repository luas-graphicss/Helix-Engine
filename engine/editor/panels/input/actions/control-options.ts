import type { InputActionType } from '@/engine/input/actions/input-asset';
import { resolvedControlLabel, VECTOR_AXES, VECTOR_DIRECTIONS, type ControlDescriptor } from '@/engine/input/controls/control-descriptor';
export interface ControlOption {
    readonly value: string;
    readonly label: string;
}
export function controlOptions(controls: readonly ControlDescriptor[], expected: InputActionType): ControlOption[] {
    const options: ControlOption[] = [];
    for (const descriptor of controls) {
        const isVector = descriptor.kind === 'vector2';
        if (isVector !== (expected === 'vector2')) {
            if (isVector && descriptor.motion !== 'absolute')
                for (const member of expected === 'axis' ? VECTOR_AXES : VECTOR_DIRECTIONS)
                    options.push({ value: `${descriptor.id}/${member}`, label: resolvedControlLabel({ descriptor, member }) });
            continue;
        }
        options.push({ value: descriptor.id, label: descriptor.label });
    }
    return options;
}
