import type { ReactNode } from 'react';
import { formatPreciseDateTime, formatRelativeTime } from '@/engine/core/format/format-time';
import { isActionEntry, type ActivityEntry } from '@/engine/editor/activity/activity-entry';
import type { SessionTopic } from '@/engine/editor/session/session-topics';
import { ACTIVITY_KIND_META } from './activity-kind-meta';
const SCOPE_LABELS: Record<SessionTopic, string> = {
    scene: 'Cena',
    selection: 'Seleção',
    tool: 'Ferramentas',
    view: 'Visualização',
    workspace: 'Área de trabalho',
    history: 'Histórico',
    project: 'Projeto',
    log: 'Console',
    resources: 'Recursos da cena',
    assets: 'Biblioteca de ativos',
    playtest: 'Simulação',
};
function Detail({ term, children }: {
    term: string;
    children: ReactNode;
}) {
    return (<div className="contents">
      <dt className="text-muted-foreground">{term}</dt>
      <dd className="min-w-0 break-words text-foreground/90">{children}</dd>
    </div>);
}
export function ActivityDetails({ entry }: {
    entry: ActivityEntry;
}) {
    return (<dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-0.5 bg-surface-sunken py-1.5 pr-2 pl-9 text-3xs leading-relaxed">
      <Detail term="Ação">{entry.label}</Detail>
      <Detail term="Tipo">{ACTIVITY_KIND_META[entry.kind].label}</Detail>
      <Detail term="Horário">
        {formatPreciseDateTime(entry.occurredAt)} · {formatRelativeTime(entry.occurredAt)}
      </Detail>
      <Detail term="Área">{SCOPE_LABELS[entry.scope]}</Detail>
      {isActionEntry(entry) && <Detail term="Estado">{entry.undone ? 'Desfeita' : 'Em vigor'}</Detail>}
    </dl>);
}
