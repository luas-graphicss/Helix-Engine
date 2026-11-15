import { Check, CircleAlert, LoaderCircle, type LucideIcon } from 'lucide-react';
import type { CallRecord, CallState } from '@/engine/editor/mcp/execution/call-activity';
import { cn } from '@/lib/utils';
interface StateMeta {
    readonly label: string;
    readonly icon: LucideIcon;
    readonly className: string;
}
const STATE_META: Record<CallState, StateMeta> = {
    running: { label: 'Executando', icon: LoaderCircle, className: 'text-primary motion-safe:animate-spin' },
    done: { label: 'Concluída', icon: Check, className: 'text-success' },
    failed: { label: 'Falhou', icon: CircleAlert, className: 'text-destructive' },
};
const SECOND_MS = 1000;
type AgentCallListProps = {
    calls: readonly CallRecord[];
};
function formatDuration(durationMs: number | null): string {
    if (durationMs === null)
        return '';
    return durationMs < SECOND_MS ? `${Math.round(durationMs)} ms` : `${(durationMs / SECOND_MS).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`;
}
export function AgentCallList({ calls }: AgentCallListProps) {
    if (calls.length === 0)
        return null;
    return (<ul aria-label="Chamadas recentes dos agentes" className="mx-2 mt-1 flex max-h-32 shrink-0 flex-col overflow-y-auto rounded-sm border border-border bg-surface-sunken/60 py-0.5">
      {calls.map((call) => {
            const meta = STATE_META[call.state];
            const Icon = meta.icon;
            return (<li key={call.callId} className="flex min-w-0 items-center gap-1.5 px-1.5 py-0.5">
            <Icon aria-hidden className={cn('size-3 shrink-0', meta.className)}/>
            <span className="shrink-0 text-2xs text-foreground">{call.title}</span>
            <span className="min-w-0 flex-1 truncate font-mono text-3xs text-muted-foreground">{call.agent}</span>
            <span className="shrink-0 font-mono text-3xs text-muted-foreground">{formatDuration(call.durationMs)}</span>
            <span className="sr-only">{meta.label}</span>
          </li>);
        })}
    </ul>);
}
