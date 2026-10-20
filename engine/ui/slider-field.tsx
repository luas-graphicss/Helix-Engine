'use client';
import { PropertyRow } from './property-row';
type SliderFieldProps = {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    disabled?: boolean;
    format?: (value: number) => string;
    onChange: (value: number) => void;
};
const defaultFormat = (value: number) => String(Number(value.toFixed(2)));
export function SliderField({ label, value, min, max, step = 0.01, disabled, format = defaultFormat, onChange }: SliderFieldProps) {
    const percent = max > min ? ((Math.min(Math.max(value, min), max) - min) / (max - min)) * 100 : 0;
    return (<PropertyRow label={label}>
      <input type="range" min={min} max={max} step={step} value={value} disabled={disabled} aria-label={label} aria-valuetext={format(value)} onChange={(event) => onChange(Number(event.currentTarget.value))} style={{ background: `linear-gradient(to right, var(--primary) ${percent}%, var(--surface-raised) ${percent}%)` }} className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full outline-none disabled:cursor-default disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-primary/60 [&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-foreground [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:shadow-[0_0_0_1px_var(--border)]"/>
      <span className="w-[4.5rem] shrink-0 truncate text-right font-mono text-2xs tabular-nums text-foreground">{format(value)}</span>
    </PropertyRow>);
}
