'use client';
import { ChevronRight } from 'lucide-react';
import { formatClockTime } from '@/engine/core/format/format-time';
import { isActionEntry, type ActivityEntry } from '@/engine/editor/activity/activity-entry';
import { FOCUS_RING_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
import { ActivityDetails } from './activity-details';
import { ACTIVITY_KIND_META } from './activity-kind-meta';
type ActivityRowProps = {
    entry: ActivityEntry;
    expanded: boolean;
    onToggle: () => void;
};
export function ActivityRow({ entry, expanded, onToggle }: ActivityRowProps) {
    const meta = ACTIVITY_KIND_META[entry.kind];
    const Icon = meta.icon;
    const undone = isActionEntry(entry) && entry.undone;
    return (<li className="font-mono text-2xs [contain-intrinsic-block-size:auto_1.5rem] [content-visibility:auto]">
      <button type="button" aria-expanded={expanded} onClick={onToggle} className={cn('flex min-h-row w-full items-center gap-2 px-2 text-left transition-colors duration-100 hover:bg-highlight', FOCUS_RING_CLASS, expanded && 'bg-surface-raised')}>
        <ChevronRight className={cn('size-3 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-90')} aria-hidden/>
        <Icon className={cn('size-3.5 shrink-0', meta.className)} aria-hidden/>
        <time dateTime={new Date(entry.occurredAt).toISOString()} className="shrink-0 text-muted-foreground/70 tabular-nums">
          {formatClockTime(entry.occurredAt)}
        </time>
        <span className={cn('min-w-0 flex-1 truncate', undone ? 'text-muted-foreground line-through' : 'text-foreground/90')} title={entry.label}>
          {entry.label}
        </span>
        {undone && <span className="sr-only">(desfeita)</span>}
        <span className="shrink-0 text-3xs tracking-wider text-muted-foreground uppercase">{meta.label}</span>
      </button>
      {expanded && <ActivityDetails entry={entry}/>}
    </li>);
}
