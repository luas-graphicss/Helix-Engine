'use client';
import { formatNumber, parseNumber } from '@/engine/editor/panels/inspector/number-fields';
import { FieldInput } from '@/engine/ui/field-input';
type ClampedNumberFieldProps = {
    label: string;
    value: number;
    min?: number;
    max?: number;
    suffix?: string;
    onCommit: (value: number) => void;
};
export function ClampedNumberField({ label, value, min = -Infinity, max = Infinity, suffix = '', onCommit }: ClampedNumberFieldProps) {
    return (<FieldInput key={value} defaultValue={`${formatNumber(value)}${suffix}`} aria-label={label} onBlur={(event) => {
            const input = event.currentTarget;
            if (input.value === input.defaultValue)
                return;
            const typed = parseNumber(input.value);
            const next = Number.isFinite(typed) ? Math.min(max, Math.max(min, typed)) : value;
            input.value = `${formatNumber(next)}${suffix}`;
            if (next !== value)
                onCommit(next);
        }} onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229)
                event.currentTarget.blur();
        }}/>);
}
