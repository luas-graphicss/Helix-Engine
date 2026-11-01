'use client';
import { useEffect, useRef, useState } from 'react';
import { PropertyRow } from '@/engine/ui/property-row';
import { cn } from '@/lib/utils';
import { GuiNumberField } from './gui-number-field';
export type GuiColorPatch = {
    color?: string;
    alpha?: number;
};
type GuiColorFieldProps = {
    label: string;
    color: string;
    alpha?: number;
    disabled?: boolean;
    inline?: boolean;
    onChange: (patch: GuiColorPatch) => void;
    onEnd?: () => void;
};
const HEX_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
export function normalizeHexColor(text: string): string | null {
    const match = HEX_PATTERN.exec(text.trim());
    if (!match)
        return null;
    const digits = match[1].toLowerCase();
    const full = digits.length === 3 ? digits.split('').map((digit) => digit + digit).join('') : digits;
    return `#${full}`;
}
const CHECKER_STYLE = {
    backgroundImage: 'conic-gradient(var(--color-border-strong) 25%, transparent 0 50%, var(--color-border-strong) 0 75%, transparent 0)',
    backgroundSize: '8px 8px',
};
export function GuiColorField({ label, color, alpha, disabled, inline, onChange, onEnd }: GuiColorFieldProps) {
    const [draft, setDraft] = useState<string | null>(null);
    const pickerRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        const picker = pickerRef.current;
        if (!picker || !onEnd)
            return;
        const finish = () => onEnd();
        picker.addEventListener('change', finish);
        return () => picker.removeEventListener('change', finish);
    }, [onEnd]);
    const commitHex = (text: string) => {
        const next = normalizeHexColor(text);
        if (next && next !== color)
            onChange({ color: next });
        setDraft(null);
        onEnd?.();
    };
    const controls = (<>
      <span className={cn('relative size-6 shrink-0 overflow-hidden rounded-sm border border-border shadow-well', disabled && 'opacity-40')} style={CHECKER_STYLE}>
        <span aria-hidden className="absolute inset-0" style={{ backgroundColor: color, opacity: alpha ?? 1 }}/>
        <input ref={pickerRef} type="color" value={color} disabled={disabled} aria-label={`${label} (seletor)`} onChange={(event) => onChange({ color: event.currentTarget.value })} className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-default"/>
      </span>
      <div className={cn('flex h-6 min-w-0 flex-1 items-center overflow-hidden rounded-sm border border-border bg-input shadow-well transition-colors duration-100 hover:border-border-strong focus-within:border-primary/80 focus-within:hover:border-primary/80', disabled && 'opacity-40')}>
        <input type="text" spellCheck={false} value={draft ?? color.toUpperCase()} disabled={disabled} aria-label={`${label} (hexadecimal)`} onFocus={(event) => {
            setDraft(color.toUpperCase());
            event.currentTarget.select();
        }} onChange={(event) => setDraft(event.currentTarget.value)} onBlur={(event) => commitHex(event.currentTarget.value)} onKeyDown={(event) => {
            if (event.key === 'Enter')
                event.currentTarget.blur();
            if (event.key === 'Escape') {
                setDraft(null);
                event.currentTarget.blur();
            }
        }} className="h-full w-full min-w-0 bg-transparent px-1.5 font-mono text-2xs text-foreground uppercase outline-none disabled:cursor-default"/>
      </div>
      {alpha !== undefined && (<GuiNumberField label={`${label} (opacidade)`} value={alpha * 100} min={0} max={100} step={1} precision={0} unit="%" disabled={disabled} className="max-w-[4.25rem] flex-none" onChange={(percent) => onChange({ alpha: percent / 100 })} onEnd={onEnd}/>)}
    </>);
    if (inline)
        return <div className="flex min-w-0 flex-1 items-center gap-1">{controls}</div>;
    return <PropertyRow label={label}>{controls}</PropertyRow>;
}
