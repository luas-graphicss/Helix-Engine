'use client';
import type { KeyboardEvent } from 'react';
import { FieldInput } from '@/engine/ui/field-input';
import type { Vec3 } from '@/engine/core/math/vec3';
export type Axis = 0 | 1 | 2;
const AXES = ['x', 'y', 'z'] as const;
export function formatNumber(value: number, decimals = 3): string {
    return Number.isInteger(value) ? value.toFixed(1) : String(Number(value.toFixed(decimals)));
}
export function parseNumber(text: string): number {
    return Number.parseFloat(text.replace(',', '.'));
}
function blurOnEnter(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229)
        return;
    if (event.key === 'Enter') {
        event.preventDefault();
        event.currentTarget.blur();
    }
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
    values: Vec3 | readonly [number | null, number | null, number | null];
    suffix?: string;
    decimals?: number;
    onCommit: (axis: Axis, value: number) => void;
};
function finishVectorEdit(input: HTMLInputElement, suffix: string, commit: (value: number) => void): void {
    if (input.value === input.defaultValue)
        return;
    const text = input.value.trim();
    input.value = input.defaultValue;
    const unit = suffix.trim();
    const numeric = unit && text.endsWith(unit) ? text.slice(0, -unit.length).trim() : text;
    if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:e[+-]?\d+)?$/i.test(numeric))
        return;
    const value = parseNumber(numeric);
    if (Number.isFinite(Math.fround(value)))
        commit(value);
}
export function Vector3Input({ label, values, suffix = '', decimals, onCommit }: Vector3InputProps) {
    return (<>
      {AXES.map((axis, index) => {
          const value = values[index];
          const text = value === null ? '' : `${formatNumber(value, decimals)}${suffix}`;
          return <FieldInput key={`${label}-${axis}-${value}`} axis={axis} defaultValue={text} inputMode="decimal"
              placeholder={value === null ? '—' : undefined} aria-description={value === null ? 'Valores diferentes na seleção' : undefined}
              aria-label={`${label} ${axis.toUpperCase()}`} onBlur={(event) => finishVectorEdit(event.currentTarget, suffix, (next) => onCommit(index as Axis, next))}
              onKeyDown={(event) => {
                  if (event.key === 'Escape' && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) {
                      event.currentTarget.value = event.currentTarget.defaultValue;
                      event.currentTarget.blur();
                      return;
                  }
                  blurOnEnter(event);
              }}/>;
      })}
    </>);
}
