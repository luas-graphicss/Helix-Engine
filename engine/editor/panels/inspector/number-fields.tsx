'use client';
import type { KeyboardEvent } from 'react';
import { FieldInput } from '@/engine/ui/field-input';
import type { Vec3 } from '@/engine/core/math/vec3';
export type Axis = 0 | 1 | 2;
const AXES = ['x', 'y', 'z'] as const;
export function formatNumber(value: number): string {
    return Number.isInteger(value) ? value.toFixed(1) : String(Number(value.toFixed(3)));
}
export function parseNumber(text: string): number {
    return Number.parseFloat(text.replace(',', '.'));
}
function blurOnEnter(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter')
        event.currentTarget.blur();
}
type ScalarFieldProps = {
    label: string;
    value: number;
    suffix?: string;
    onCommit: (value: number) => void;
};
export function ScalarField({ label, value, suffix = '', onCommit }: ScalarFieldProps) {
    return (<FieldInput key={`${label}-${value}`} defaultValue={`${formatNumber(value)}${suffix}`} aria-label={label} onBlur={(event) => onCommit(parseNumber(event.currentTarget.value))} onKeyDown={blurOnEnter}/>);
}
type Vector3InputProps = {
    label: string;
    values: Vec3;
    suffix?: string;
    onCommit: (axis: Axis, value: number) => void;
};
export function Vector3Input({ label, values, suffix = '', onCommit }: Vector3InputProps) {
    return (<>
      {AXES.map((axis, index) => (<FieldInput key={`${label}-${axis}-${values[index]}`} axis={axis} defaultValue={`${formatNumber(values[index])}${suffix}`} aria-label={`${label} ${axis.toUpperCase()}`} onBlur={(event) => onCommit(index as Axis, parseNumber(event.currentTarget.value))} onKeyDown={blurOnEnter}/>))}
    </>);
}
