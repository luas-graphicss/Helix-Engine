'use client';
import { cn } from '@/lib/utils';
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
    return (<div role="radiogroup" aria-label={label} className="flex h-6 min-w-0 flex-1 rounded-sm border border-border bg-input p-px">
      {options.map((option) => {
            const selected = option.value === value;
            return (<button key={option.value} type="button" role="radio" aria-checked={selected} onClick={() => onChange(option.value)} className={cn('min-w-0 flex-1 rounded-[1px] text-2xs transition-colors', selected ? 'bg-primary/20 font-medium text-primary' : 'text-muted-foreground hover:bg-highlight hover:text-foreground')}>
            {option.label}
          </button>);
        })}
    </div>);
}
