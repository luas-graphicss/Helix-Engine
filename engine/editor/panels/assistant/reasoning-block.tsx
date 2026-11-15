'use client';
import { useState } from 'react';
import { Brain, ChevronRight, LoaderCircle } from 'lucide-react';
import type { ReasoningEntry } from '@/engine/editor/assistant/conversation/conversation-entry';
import { FOCUS_RING_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
import { AssistantMarkdown } from './assistant-markdown';
const SECOND_MS = 1000;
const MINUTE_SECONDS = 60;
type ReasoningBlockProps = {
    entry: ReasoningEntry;
};
function describeDuration(durationMs: number): string {
    const seconds = Math.max(1, Math.round(durationMs / SECOND_MS));
    if (seconds < MINUTE_SECONDS)
        return `${seconds} s`;
    const minutes = Math.floor(seconds / MINUTE_SECONDS);
    const rest = seconds % MINUTE_SECONDS;
    return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} s`;
}
export function ReasoningBlock({ entry }: ReasoningBlockProps) {
    const [toggled, setToggled] = useState<boolean | null>(null);
    const { durationMs } = entry;
    const open = toggled ?? durationMs === null;
    return (<div className="flex flex-col gap-1">
      <button type="button" aria-expanded={open} onClick={() => setToggled(!open)} className={cn('flex w-fit max-w-full items-center gap-1.5 rounded-sm py-0.5 pr-1 text-2xs text-muted-foreground transition-colors duration-100 hover:text-foreground', FOCUS_RING_CLASS)}>
        {durationMs === null ? <LoaderCircle aria-hidden className="size-3.5 shrink-0 text-primary motion-safe:animate-spin"/> : <Brain aria-hidden className="size-3.5 shrink-0"/>}
        <span>{durationMs === null ? 'Pensando…' : `Pensou por ${describeDuration(durationMs)}`}</span>
        <ChevronRight aria-hidden className={cn('size-3 shrink-0 transition-transform duration-150', open && 'rotate-90')}/>
      </button>
      {open && (<div className="border-l border-border-strong pl-2">
          <AssistantMarkdown text={entry.text} className="text-2xs text-muted-foreground"/>
        </div>)}
    </div>);
}
