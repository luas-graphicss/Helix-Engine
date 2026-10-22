'use client';
import { ChevronDown } from 'lucide-react';
type SelectOption<T extends string | number> = {
    value: T;
    label: string;
};
type SelectFieldProps<T extends string | number> = {
    label: string;
    options: readonly SelectOption<T>[];
    value: T;
    disabled?: boolean;
    onChange: (value: T) => void;
};
export function SelectField<T extends string | number>({ label, options, value, disabled, onChange }: SelectFieldProps<T>) {
    return (<div className="relative flex h-6 min-w-0 flex-1 items-center overflow-hidden rounded-sm border border-border bg-input focus-within:border-primary/70">
      <select value={String(value)} disabled={disabled} aria-label={label} onChange={(event) => {
            const option = options.find((candidate) => String(candidate.value) === event.currentTarget.value);
            if (option)
                onChange(option.value);
        }} className="h-full w-full min-w-0 cursor-pointer appearance-none bg-transparent pr-6 pl-1.5 font-mono text-2xs text-foreground outline-none disabled:cursor-default disabled:opacity-40 [&>option]:bg-surface-raised [&>option]:text-foreground">
        {options.map((option) => (<option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1.5 size-3 text-muted-foreground" aria-hidden/>
    </div>);
}
