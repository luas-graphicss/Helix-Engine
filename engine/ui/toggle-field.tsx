'use client';
import { cn } from '@/lib/utils';
import { PropertyRow } from './property-row';
import { FOCUS_RING_CLASS } from './surface-styles';
type ToggleSwitchProps = {
    label: string;
    on: boolean;
    onToggle?: () => void;
    className?: string;
};
type ToggleFieldProps = Omit<ToggleSwitchProps, 'className'> & {
    hint?: string;
};
export function ToggleField({ label, hint, on, onToggle }: ToggleFieldProps) {
    return (<PropertyRow label={label} hint={hint}>
      <ToggleSwitch label={label} on={on} onToggle={onToggle}/>
    </PropertyRow>);
}
export function ToggleSwitch({ label, on, onToggle, className }: ToggleSwitchProps) {
    return (<button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onToggle} disabled={!onToggle} className={cn('relative inline-flex h-3.5 w-7 shrink-0 items-center rounded-xs border transition-colors duration-150 disabled:cursor-default disabled:opacity-60', FOCUS_RING_CLASS, on ? 'border-primary/60 bg-primary' : 'border-border bg-surface-sunken shadow-well', className)}>
      <span aria-hidden className={cn('absolute top-px left-px h-2.5 w-3 rounded-xs shadow-raised transition-transform duration-150', on ? 'translate-x-3 bg-primary-foreground' : 'translate-x-0 bg-muted-foreground')}/>
    </button>);
}
