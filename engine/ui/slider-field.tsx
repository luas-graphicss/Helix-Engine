'use client';
import { PropertyRow } from './property-row';
import { FieldInput } from './field-input';
import { RangeInput } from './range-input';
import { useLiveValue } from './use-live-value';
type SliderFieldProps = {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    disabled?: boolean;
    scale?: 'linear' | 'log';
    format?: (value: number) => string;
    editable?: boolean;
    suffix?: string;
    onChange: (value: number) => void;
};
const defaultFormat = (value: number) => String(Number(value.toFixed(2)));
export function SliderField({ label, value, min, max, step, disabled, scale, format = defaultFormat, editable = false, suffix = '', onChange }: SliderFieldProps) {
    const { shown, handleChange, dragHandlers } = useLiveValue(value, onChange);
    const commitText = (text: string) => {
        const parsed = Number.parseFloat(text.replace(',', '.'));
        if (Number.isFinite(parsed) && parsed !== value)
            onChange(parsed);
    };
    return (<PropertyRow label={label}>
      <span className="contents" {...dragHandlers}>
        <RangeInput label={label} value={shown} min={min} max={max} step={step} disabled={disabled} scale={scale} valueText={format(shown)} onChange={handleChange}/>
      </span>
      {editable ? (<FieldInput key={`${label}-${value}`} defaultValue={`${format(value)}${suffix}`} disabled={disabled} aria-label={`${label} (valor)`} className="w-[4.5rem] flex-none" onBlur={(event) => commitText(event.currentTarget.value)} onKeyDown={(event) => {
                if (event.key === 'Enter')
                    event.currentTarget.blur();
            }}/>) : (<span className="w-[4.5rem] shrink-0 truncate text-right font-mono text-2xs tabular-nums text-foreground">{format(shown)}</span>)}
    </PropertyRow>);
}
