'use client';
import { Check } from 'lucide-react';
import { POST_PROCESS_PRESETS } from '@/engine/core/environment/post-process-settings';
import { cn } from '@/lib/utils';
type PresetGridProps = {
    activeId: string | null;
    onApply: (presetId: string) => void;
};
export function PresetGrid({ activeId, onApply }: PresetGridProps) {
    return (<div className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-1 px-2" role="listbox" aria-label="Presets de pós-processamento">
      {POST_PROCESS_PRESETS.map((preset) => {
            const active = preset.id === activeId;
            return (<button key={preset.id} type="button" role="option" aria-selected={active} title={preset.description} onClick={() => onApply(preset.id)} className={cn('flex min-w-0 flex-col items-start gap-0.5 rounded-sm border px-2 py-1.5 text-left transition-colors', 'focus-visible:outline-1 focus-visible:outline-offset-[-1px] focus-visible:outline-primary', active ? 'border-primary/70 bg-primary/10' : 'border-border bg-surface-raised/40 hover:border-border-strong hover:bg-highlight')}>
            <span className="flex w-full items-center gap-1">
              <span className={cn('min-w-0 flex-1 truncate text-2xs font-semibold', active ? 'text-primary' : 'text-foreground')}>{preset.name}</span>
              {active && <Check className="size-3 shrink-0 text-primary" aria-hidden/>}
            </span>
            <span className="line-clamp-2 text-3xs leading-snug text-muted-foreground">{preset.description}</span>
          </button>);
        })}
    </div>);
}
