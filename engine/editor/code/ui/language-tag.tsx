import { scriptLanguage, type ScriptLanguageFamily, type ScriptLanguageId } from '@/engine/scripting/script-languages';
import { cn } from '@/lib/utils';
export const SCRIPT_FAMILY_TINT: Record<ScriptLanguageFamily, string> = {
    scripting: 'border-primary/50 text-primary',
    web: 'border-axis-z/50 text-axis-z',
    shader: 'border-csg-intersect/50 text-csg-intersect',
    systems: 'border-axis-y/50 text-axis-y',
    data: 'border-border-strong text-muted-foreground',
};
export const SCRIPT_FAMILY_DOT: Record<ScriptLanguageFamily, string> = {
    scripting: 'bg-primary',
    web: 'bg-axis-z',
    shader: 'bg-csg-intersect',
    systems: 'bg-axis-y',
    data: 'bg-muted-foreground',
};
type LanguageTagProps = {
    language: ScriptLanguageId;
    size?: 'xs' | 'sm';
    className?: string;
    silent?: boolean;
};
export function LanguageTag({ language, size = 'xs', className, silent }: LanguageTagProps) {
    const entry = scriptLanguage(language);
    return (<span className={cn('inline-flex shrink-0 items-center rounded-xs border font-mono font-semibold tracking-wider whitespace-nowrap', size === 'xs' ? 'h-3.5 px-1 text-[9px] leading-none' : 'h-4.5 px-1.5 text-3xs leading-none', SCRIPT_FAMILY_TINT[entry.family], className)} title={silent ? undefined : entry.label} aria-label={silent ? undefined : entry.label}>
      {entry.tag}
    </span>);
}
