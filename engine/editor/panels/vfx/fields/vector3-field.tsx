'use client';
import { GuiNumberField } from '@/engine/editor/panels/gui/inspector/fields/gui-number-field';
import { PropertyRow } from '@/engine/ui/property-row';
export type Vector3FieldProps = {
    label: string;
    value: readonly [
        number,
        number,
        number
    ];
    step?: number;
    precision?: number;
    min?: number;
    max?: number;
    onChange: (value: readonly [
        number,
        number,
        number
    ]) => void;
    onEnd: () => void;
};
const AXES = ['X', 'Y', 'Z'] as const;
export function Vector3Field({ label, value, step = 0.1, precision = 2, min, max, onChange, onEnd }: Vector3FieldProps) {
    return (<PropertyRow label={label}>
      {AXES.map((axis, index) => (<GuiNumberField key={axis} label={`${label} ${axis}`} value={value[index]} step={step} precision={precision} min={min} max={max} unit={axis} onChange={(next) => {
                const copy: [
                    number,
                    number,
                    number
                ] = [value[0], value[1], value[2]];
                copy[index] = next;
                onChange(copy);
            }} onEnd={onEnd}/>))}
    </PropertyRow>);
}
