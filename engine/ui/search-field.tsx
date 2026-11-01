import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WELL_CLASS } from './surface-styles';
type SearchFieldProps = {
    placeholder: string;
    value: string;
    onChange: (value: string) => void;
    className?: string;
};
export function SearchField({ placeholder, value, onChange, className }: SearchFieldProps) {
    return (<label className={cn('flex h-control min-w-0 flex-1 items-center gap-1.5 rounded-sm px-1.5 text-muted-foreground transition-colors duration-100', WELL_CLASS, 'hover:border-border-strong focus-within:border-primary/80 focus-within:hover:border-primary/80', className)}>
      <Search className="size-3.5 shrink-0" aria-hidden/>
      <input type="search" placeholder={placeholder} value={value} onChange={(event) => onChange(event.currentTarget.value)} className="h-full w-full min-w-0 bg-transparent text-2xs text-foreground outline-none placeholder:text-muted-foreground/60 [&::-webkit-search-cancel-button]:appearance-none"/>
    </label>);
}
