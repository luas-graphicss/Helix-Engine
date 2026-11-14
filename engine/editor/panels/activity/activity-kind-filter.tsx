'use client';
import type { ActivityEntry, ActivityKind } from '@/engine/editor/activity/activity-entry';
import { FOCUS_RING_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
import { ACTIVITY_KIND_META, ACTIVITY_KINDS } from './activity-kind-meta';
type ActivityKindFilterProps = {
    entries: readonly ActivityEntry[];
    hiddenKinds: ReadonlySet<ActivityKind>;
    onToggle: (kind: ActivityKind) => void;
};
function countByKind(entries: readonly ActivityEntry[]): Record<ActivityKind, number> {
    const counts: Record<ActivityKind, number> = { insert: 0, import: 0, remove: 0, edit: 0, undo: 0, redo: 0 };
    for (const entry of entries)
        counts[entry.kind]++;
    return counts;
}
export function ActivityKindFilter({ entries, hiddenKinds, onToggle }: ActivityKindFilterProps) {
    const counts = countByKind(entries);
    return (<div role="group" aria-label="Filtrar por tipo de atividade" className="flex min-w-0 items-center gap-px">
      {ACTIVITY_KINDS.map((kind) => {
            const meta = ACTIVITY_KIND_META[kind];
            const Icon = meta.icon;
            const shown = !hiddenKinds.has(kind);
            const name = `${meta.groupLabel}: ${counts[kind]}`;
            return (<button key={kind} type="button" aria-pressed={shown} aria-label={name} title={`${name} · clique para ${shown ? 'ocultar' : 'mostrar'}`} onClick={() => onToggle(kind)} className={cn('flex h-control shrink-0 items-center gap-1 rounded-sm px-1 font-mono text-3xs tabular-nums transition-colors duration-100 hover:bg-highlight', FOCUS_RING_CLASS, shown ? meta.className : 'text-muted-foreground/50 line-through')}>
              <Icon className="size-3" aria-hidden/>
              {counts[kind]}
            </button>);
        })}
    </div>);
}
