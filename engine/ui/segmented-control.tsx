'use client';
import { cn } from '@/lib/utils';
import { FOCUS_RING_CLASS, WELL_CLASS } from './surface-styles';
type SegmentedOption<T extends string | number> = {
    value: T;
    label: string;
};
type SegmentedControlProps<T extends string | number> = {
    label: string;
    options: readonly SegmentedOption<T>[];
    value: T | null;
    onChange: (value: T) => void;
};
export function SegmentedControl<T extends string | number>({ label, options, value, onChange }: SegmentedControlProps<T>) {
    return (<div role="radiogroup" aria-label={label} className={cn('flex h-control min-w-0 flex-1 rounded-sm p-px', WELL_CLASS)}>
      {options.map((option) => {
            const selected = option.value === value;
            return (<button key={option.value} type="button" role="radio" aria-checked={selected} onClick={() => onChange(option.value)} title={option.label} className={cn('min-w-0 flex-1 truncate rounded-xs px-1 text-2xs transition-colors duration-100', FOCUS_RING_CLASS, selected ? 'bg-surface-raised font-medium text-primary shadow-raised' : 'text-muted-foreground hover:bg-highlight hover:text-foreground')}>
            {option.label}
          </button>);
        })}
    </div>);
}
