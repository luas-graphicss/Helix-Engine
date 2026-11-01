'use client';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FOCUS_RING_CLASS } from './surface-styles';
type CheckBoxProps = {
    checked: boolean;
    label: string;
    onChange: (checked: boolean) => void;
    className?: string;
};
export function CheckBox({ checked, label, onChange, className }: CheckBoxProps) {
    return (<button type="button" role="checkbox" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={cn('flex size-3.5 shrink-0 items-center justify-center rounded-xs border transition-[background-color,border-color,box-shadow] duration-100', FOCUS_RING_CLASS, checked ? 'border-primary bg-primary text-primary-foreground shadow-bevel' : 'border-border-strong bg-surface-sunken shadow-well hover:border-foreground/35', className)}>
      {checked && <Check className="size-2.5" strokeWidth={3.5} aria-hidden/>}
    </button>);
}
