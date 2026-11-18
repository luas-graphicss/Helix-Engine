'use client';
import { cn } from '@/lib/utils';
import { FOCUS_RING_CLASS } from '@/engine/ui/surface-styles';
import { HUD_GROUP_CLASS } from '../hud-styles';
export type HudSegmentedOption<T extends string> = {
    readonly value: T;
    readonly label: string;
    readonly hint: string;
};
type HudSegmentedProps<T extends string> = {
    label: string;
    options: readonly HudSegmentedOption<T>[];
    value: T;
    toggleShortcut: string | null;
    onChange: (value: T) => void;
};
export function HudSegmented<T extends string>({ label, options, value, toggleShortcut, onChange }: HudSegmentedProps<T>) {
    const shortcutNote = toggleShortcut ? ` (${toggleShortcut} alterna)` : '';
    return (<div role="radiogroup" aria-label={label} className={HUD_GROUP_CLASS}>
      {options.map((option) => {
            const selected = option.value === value;
            return (<button key={option.value} type="button" role="radio" aria-checked={selected} title={`${option.hint}${shortcutNote}`} onClick={() => onChange(option.value)} className={cn('h-control rounded-sm px-2 text-2xs font-medium transition-colors duration-100', FOCUS_RING_CLASS, selected ? 'bg-primary/15 text-primary ring-1 ring-primary/35 ring-inset' : 'text-muted-foreground hover:bg-highlight hover:text-foreground')}>
            {option.label}
          </button>);
        })}
    </div>);
}
