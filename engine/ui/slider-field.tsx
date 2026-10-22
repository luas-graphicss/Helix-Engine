'use client';
import { PropertyRow } from './property-row';
type SliderFieldProps = {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    disabled?: boolean;
    scale?: 'linear' | 'log';
    format?: (value: number) => string;
    onChange: (value: number) => void;
};
const defaultFormat = (value: number) => String(Number(value.toFixed(2)));
const LOG_STEPS = 1000;
const LOG_SIGNIFICANT_DIGITS = 3;
const TRACK_CLASS = 'h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full outline-none disabled:cursor-default disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-primary/60 [&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-foreground [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:shadow-[0_0_0_1px_var(--border)]';
export function SliderField({ label, value, min, max, step = 0.01, disabled, scale = 'linear', format = defaultFormat, onChange }: SliderFieldProps) {
    const clamped = Math.min(Math.max(value, min), max);
    const logarithmic = scale === 'log' && min > 0 && max > min;
    const ratio = Math.log(max / min);
    const position = logarithmic ? Math.log(clamped / min) / ratio : clamped;
    const percent = logarithmic ? position * 100 : max > min ? ((clamped - min) / (max - min)) * 100 : 0;
    const commit = (raw: number) => {
        if (!logarithmic)
            return onChange(raw);
        const next = min * Math.exp(raw * ratio);
        onChange(Number(next.toPrecision(LOG_SIGNIFICANT_DIGITS)));
    };
    return (<PropertyRow label={label}>
      <input type="range" min={logarithmic ? 0 : min} max={logarithmic ? 1 : max} step={logarithmic ? 1 / LOG_STEPS : step} value={position} disabled={disabled} aria-label={label} aria-valuetext={format(value)} onChange={(event) => commit(Number(event.currentTarget.value))} style={{ background: `linear-gradient(to right, var(--primary) ${percent}%, var(--surface-raised) ${percent}%)` }} className={TRACK_CLASS}/>
      <span className="w-[4.5rem] shrink-0 truncate text-right font-mono text-2xs tabular-nums text-foreground">{format(value)}</span>
    </PropertyRow>);
}
