'use client';
import { useState, useSyncExternalStore } from 'react';
import { Trash2 } from 'lucide-react';
import type { ActivityKind } from '@/engine/editor/activity/activity-entry';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { IconButton } from '@/engine/ui/icon-button';
import { PanelToolbar } from '@/engine/ui/panel-toolbar';
import { ActivityKindFilter } from './activity/activity-kind-filter';
import { ActivityRow } from './activity/activity-row';
function toggleKind(kinds: ReadonlySet<ActivityKind>, kind: ActivityKind): ReadonlySet<ActivityKind> {
    const next = new Set(kinds);
    if (!next.delete(kind))
        next.add(kind);
    return next;
}
export function ActivityPanel() {
    const { activity } = useEditorSession();
    const entries = useSyncExternalStore(activity.subscribe, activity.getSnapshot, activity.getSnapshot);
    const [hiddenKinds, setHiddenKinds] = useState<ReadonlySet<ActivityKind>>(() => new Set());
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const newestFirst = entries.filter((entry) => !hiddenKinds.has(entry.kind)).reverse();
    return (<div className="flex h-full flex-col">
      <PanelToolbar className="px-2">
        <ActivityKindFilter entries={entries} hiddenKinds={hiddenKinds} onToggle={(kind) => setHiddenKinds((kinds) => toggleKind(kinds, kind))}/>
        <IconButton label="Limpar histórico de atividade" size="sm" className="ml-auto" disabled={entries.length === 0} onClick={() => activity.clear()}>
          <Trash2 />
        </IconButton>
      </PanelToolbar>
      {newestFirst.length === 0 ? (<p className="px-3 py-2 text-2xs text-muted-foreground">{entries.length === 0 ? 'Nenhuma atividade nesta sessão.' : 'Nenhuma atividade dos tipos visíveis.'}</p>) : (<ol aria-label="Atividades, da mais recente para a mais antiga" className="min-h-0 flex-1 overflow-auto py-1">
          {newestFirst.map((entry) => (<ActivityRow key={entry.id} entry={entry} expanded={entry.id === expandedId} onToggle={() => setExpandedId(entry.id === expandedId ? null : entry.id)}/>))}
        </ol>)}
    </div>);
}
