import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
type SearchFieldProps = {
    placeholder: string;
    value: string;
    onChange: (value: string) => void;
    className?: string;
};
export function SearchField({ placeholder, value, onChange, className }: SearchFieldProps) {
    return (<label className={cn('flex h-6 min-w-0 flex-1 items-center gap-1.5 rounded-sm border border-border bg-input px-1.5 text-muted-foreground', 'focus-within:border-primary/70', className)}>
      <Search className="size-3.5 shrink-0" aria-hidden/>
      <input type="search" placeholder={placeholder} value={value} onChange={(event) => onChange(event.currentTarget.value)} className="h-full w-full min-w-0 bg-transparent text-2xs text-foreground outline-none placeholder:text-muted-foreground/60"/>
    </label>);
}
