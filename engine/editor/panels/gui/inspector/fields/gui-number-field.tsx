'use client';
import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { MoveHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
export type GuiNumberFieldProps = {
    label: string;
    value: number;
    step?: number;
    min?: number;
    max?: number;
    precision?: number;
    unit?: string;
    axis?: 'x' | 'y';
    disabled?: boolean;
    className?: string;
    onChange: (value: number) => void;
    onEnd?: () => void;
};
const AXIS_CLASS: Record<'x' | 'y', string> = { x: 'text-axis-x', y: 'text-axis-y' };
const DRAG_THRESHOLD = 2;
export function formatGuiNumber(value: number, precision = 2): string {
    if (!Number.isFinite(value))
        return '0';
    return String(Number(value.toFixed(precision)));
}
export function parseGuiNumber(text: string): number | null {
    const normalized = text.trim().replace(',', '.').replace(/[^\d.+-eE]/g, '');
    if (!normalized)
        return null;
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}
type DragState = {
    pointerId: number;
    startX: number;
    startValue: number;
    last: number;
    moved: boolean;
};
export function GuiNumberField({ label, value, step = 1, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY, precision = 2, unit, axis, disabled, className, onChange, onEnd }: GuiNumberFieldProps) {
    const [draft, setDraft] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const drag = useRef<DragState | null>(null);
    const clamp = (next: number) => Math.min(max, Math.max(min, Number(next.toFixed(precision))));
    const commitText = (text: string) => {
        const parsed = parseGuiNumber(text);
        if (parsed !== null) {
            const next = clamp(parsed);
            if (next !== value)
                onChange(next);
        }
        setDraft(null);
        onEnd?.();
    };
    const nudge = (direction: 1 | -1, event: KeyboardEvent<HTMLInputElement>) => {
        const multiplier = event.shiftKey ? 10 : event.altKey ? 0.1 : 1;
        const base = draft !== null ? (parseGuiNumber(draft) ?? value) : value;
        const next = clamp(base + direction * step * multiplier);
        setDraft(formatGuiNumber(next, precision));
        if (next !== value)
            onChange(next);
    };
    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.currentTarget.blur();
        }
        else if (event.key === 'Escape') {
            setDraft(null);
            event.currentTarget.blur();
        }
        else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault();
            nudge(event.key === 'ArrowUp' ? 1 : -1, event);
        }
    };
    const onGripPointerDown = (event: PointerEvent<HTMLSpanElement>) => {
        if (disabled || event.button !== 0)
            return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { pointerId: event.pointerId, startX: event.clientX, startValue: value, last: value, moved: false };
    };
    const onGripPointerMove = (event: PointerEvent<HTMLSpanElement>) => {
        const state = drag.current;
        if (!state || state.pointerId !== event.pointerId)
            return;
        const dx = event.clientX - state.startX;
        if (!state.moved && Math.abs(dx) < DRAG_THRESHOLD)
            return;
        state.moved = true;
        const multiplier = event.shiftKey ? 10 : event.altKey ? 0.1 : 1;
        const next = clamp(state.startValue + dx * step * multiplier);
        if (next !== state.last) {
            state.last = next;
            onChange(next);
        }
    };
    const onGripPointerUp = (event: PointerEvent<HTMLSpanElement>) => {
        const state = drag.current;
        if (!state || state.pointerId !== event.pointerId)
            return;
        drag.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        if (state.moved)
            onEnd?.();
        else
            inputRef.current?.select();
    };
    return (<div className={cn('flex h-6 min-w-0 flex-1 items-center overflow-hidden rounded-sm border border-border bg-input focus-within:border-primary/70', disabled && 'opacity-40', className)}>
      <span role="presentation" title={disabled ? undefined : 'Arraste para ajustar (Shift ×10, Alt ×0,1)'} onPointerDown={onGripPointerDown} onPointerMove={onGripPointerMove} onPointerUp={onGripPointerUp} onPointerCancel={onGripPointerUp} className={cn('flex h-full min-w-5 shrink-0 select-none items-center justify-center px-1 font-mono text-3xs text-muted-foreground touch-none', !disabled && 'cursor-ew-resize hover:bg-highlight hover:text-foreground', axis && AXIS_CLASS[axis])}>
        {unit ?? (axis ? axis.toUpperCase() : <MoveHorizontal className="size-3" aria-hidden/>)}
      </span>
      <input ref={inputRef} type="text" inputMode="decimal" value={draft ?? formatGuiNumber(value, precision)} disabled={disabled} aria-label={unit ? `${label} (${unit})` : label} onFocus={(event) => {
            setDraft(formatGuiNumber(value, precision));
            event.currentTarget.select();
        }} onChange={(event) => setDraft(event.currentTarget.value)} onBlur={(event) => commitText(event.currentTarget.value)} onKeyDown={onKeyDown} className="h-full w-full min-w-0 bg-transparent pr-1.5 font-mono text-2xs text-foreground tabular-nums outline-none disabled:cursor-default"/>
    </div>);
}
