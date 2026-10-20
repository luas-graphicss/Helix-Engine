'use client';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
type CheckBoxProps = {
    checked: boolean;
    label: string;
    onChange: (checked: boolean) => void;
    className?: string;
};
export function CheckBox({ checked, label, onChange, className }: CheckBoxProps) {
    return (<button type="button" role="checkbox" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={cn('flex size-3.5 shrink-0 items-center justify-center rounded-[2px] border transition-colors focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:outline-none', checked ? 'border-primary bg-primary text-primary-foreground' : 'border-border-strong bg-input hover:border-foreground/40', className)}>
      {checked && <Check className="size-2.5" strokeWidth={3} aria-hidden/>}
    </button>);
}
