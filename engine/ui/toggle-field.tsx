'use client';
import { cn } from '@/lib/utils';
import { PropertyRow } from './property-row';
type ToggleFieldProps = {
    label: string;
    on: boolean;
    onToggle?: () => void;
};
export function ToggleField({ label, on, onToggle }: ToggleFieldProps) {
    return (<PropertyRow label={label}>
      <ToggleSwitch label={label} on={on} onToggle={onToggle}/>
    </PropertyRow>);
}
type ToggleSwitchProps = ToggleFieldProps & {
    className?: string;
};
export function ToggleSwitch({ label, on, onToggle, className }: ToggleSwitchProps) {
    return (<button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onToggle} disabled={!onToggle} className={cn('relative inline-flex h-3.5 w-6 shrink-0 items-center overflow-hidden rounded-full transition-colors disabled:cursor-default', on ? 'bg-primary' : 'bg-surface-raised ring-1 ring-inset ring-border-strong', className)}>
      <span aria-hidden className={cn('absolute left-0.5 top-0.5 size-2.5 rounded-full transition-transform', on ? 'translate-x-2.5 bg-primary-foreground' : 'translate-x-0 bg-foreground-muted')}/>
    </button>);
}
