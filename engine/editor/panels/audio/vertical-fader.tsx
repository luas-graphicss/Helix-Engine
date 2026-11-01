'use client';
import { useRef, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { cn } from '@/lib/utils';
type VerticalFaderProps = {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    resetValue?: number;
    valueText: string;
    disabled?: boolean;
    onChange: (value: number) => void;
    onCommit?: () => void;
    className?: string;
};
function snap(value: number, step: number, min: number, max: number): number {
    const snapped = Math.round((value - min) / step) * step + min;
    return Math.min(max, Math.max(min, Number(snapped.toFixed(6))));
}
export function VerticalFader({ label, value, min, max, step = 0.5, resetValue, valueText, disabled, onChange, onCommit, className }: VerticalFaderProps) {
    const trackRef = useRef<HTMLDivElement>(null);
    const draggingRef = useRef<number | null>(null);
    const fraction = max > min ? (Math.min(max, Math.max(min, value)) - min) / (max - min) : 0;
    const unity = resetValue !== undefined && resetValue > min && resetValue < max ? (resetValue - min) / (max - min) : null;
    const valueFromPointer = (clientY: number): number => {
        const track = trackRef.current;
        if (!track)
            return value;
        const rect = track.getBoundingClientRect();
        const ratio = 1 - Math.min(1, Math.max(0, (clientY - rect.top) / Math.max(1, rect.height)));
        return snap(min + ratio * (max - min), step, min, max);
    };
    const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (disabled || event.button !== 0)
            return;
        draggingRef.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        event.currentTarget.focus();
        onChange(valueFromPointer(event.clientY));
    };
    const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (draggingRef.current !== event.pointerId)
            return;
        onChange(valueFromPointer(event.clientY));
    };
    const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (draggingRef.current !== event.pointerId)
            return;
        draggingRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        onCommit?.();
    };
    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (disabled)
            return;
        const big = (max - min) / 10;
        let next: number | null = null;
        switch (event.key) {
            case 'ArrowUp':
            case 'ArrowRight':
                next = value + (event.shiftKey ? step * 10 : step);
                break;
            case 'ArrowDown':
            case 'ArrowLeft':
                next = value - (event.shiftKey ? step * 10 : step);
                break;
            case 'PageUp':
                next = value + big;
                break;
            case 'PageDown':
                next = value - big;
                break;
            case 'Home':
                next = min;
                break;
            case 'End':
                next = max;
                break;
            default:
                return;
        }
        event.preventDefault();
        onChange(snap(next, step, min, max));
    };
    return (<div ref={trackRef} role="slider" tabIndex={disabled ? -1 : 0} aria-label={label} aria-orientation="vertical" aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} aria-valuetext={valueText} aria-disabled={disabled || undefined} title={`${label}: ${valueText}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onKeyDown={onKeyDown} onKeyUp={() => onCommit?.()} onDoubleClick={() => {
            if (resetValue !== undefined && !disabled) {
                onChange(resetValue);
                onCommit?.();
            }
        }} className={cn('relative h-full w-5 shrink-0 cursor-ns-resize touch-none select-none rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/60', disabled && 'cursor-default opacity-40', className)}>
      <div aria-hidden className="absolute inset-y-1 left-1/2 w-1 -translate-x-1/2 rounded-xs border border-border bg-surface-sunken shadow-well"/>
      <div aria-hidden className="absolute left-1/2 w-1 -translate-x-1/2 rounded-xs bg-primary/70" style={{ bottom: '0.25rem', height: `calc(${fraction} * (100% - 0.5rem))` }}/>
      {unity !== null && <div aria-hidden className="absolute inset-x-0.5 h-px bg-foreground/40" style={{ bottom: `calc(0.25rem + ${unity} * (100% - 0.5rem))` }}/>}
      <div aria-hidden className="absolute left-1/2 h-2.5 w-4 -translate-x-1/2 translate-y-1/2 rounded-[2px] border border-border bg-foreground shadow-[0_1px_2px_rgba(0,0,0,0.5)]" style={{ bottom: `calc(0.25rem + ${fraction} * (100% - 0.5rem))` }}/>
    </div>);
}
