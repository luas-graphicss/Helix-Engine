'use client';
import { cn } from '@/lib/utils';
import { useLiveValue } from './use-live-value';
type RangeInputProps = {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    disabled?: boolean;
    scale?: 'linear' | 'log';
    valueText?: string;
    className?: string;
    onChange: (value: number) => void;
};
const LOG_STEPS = 1000;
const LOG_SIGNIFICANT_DIGITS = 3;
const THUMB_CLASS = '[&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-1.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-xs [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:shadow-[inset_0_1px_0_0_oklch(1_0_0/45%),0_0_0_1px_var(--border)] ' +
    '[&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-1.5 [&::-moz-range-thumb]:rounded-xs [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-foreground [&::-moz-range-thumb]:shadow-[inset_0_1px_0_0_oklch(1_0_0/45%),0_0_0_1px_var(--border)]';
const TRACK_CLASS = cn('h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-xs shadow-well outline-none disabled:cursor-default disabled:opacity-40', 'focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-primary', THUMB_CLASS);
export function RangeInput({ label, value, min, max, step = 0.01, disabled, scale = 'linear', valueText, className, onChange }: RangeInputProps) {
    const { shown, handleChange, dragHandlers } = useLiveValue(value, onChange);
    const clamped = Math.min(Math.max(shown, min), max);
    const logarithmic = scale === 'log' && min > 0 && max > min;
    const ratio = Math.log(max / min);
    const position = logarithmic ? Math.log(clamped / min) / ratio : clamped;
    const percent = logarithmic ? position * 100 : max > min ? ((clamped - min) / (max - min)) * 100 : 0;
    const commit = (raw: number) => {
        if (!logarithmic)
            return handleChange(raw);
        const next = min * Math.exp(raw * ratio);
        handleChange(Number(next.toPrecision(LOG_SIGNIFICANT_DIGITS)));
    };
    return (<input type="range" min={logarithmic ? 0 : min} max={logarithmic ? 1 : max} step={logarithmic ? 1 / LOG_STEPS : step} value={position} disabled={disabled} aria-label={label} aria-valuetext={valueText} title={valueText} {...dragHandlers} onChange={(event) => commit(Number(event.currentTarget.value))} style={{ background: `linear-gradient(to right, var(--primary) ${percent}%, var(--surface-sunken) ${percent}%)` }} className={cn(TRACK_CLASS, className)}/>);
}
