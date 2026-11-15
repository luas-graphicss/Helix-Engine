import type { ConnectionStatus } from '@/engine/editor/mcp/link/connection-status';
import { cn } from '@/lib/utils';
type Tone = 'muted' | 'success' | 'warning' | 'danger';
interface StatusMessage {
    readonly tone: Tone;
    readonly text: string;
}
const TEXT_CLASS: Record<Tone, string> = {
    muted: 'text-muted-foreground',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-destructive',
};
const DOT_CLASS: Record<Tone, string> = {
    muted: 'bg-muted-foreground/60',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-destructive',
};
type BridgeStatusLineProps = {
    status: ConnectionStatus;
    problem: string | null;
};
function describeStatus(status: ConnectionStatus, problem: string | null): StatusMessage {
    if (problem)
        return { tone: 'warning', text: problem };
    switch (status.state) {
        case 'off':
            return { tone: 'muted', text: 'Desligada. Publique o Worker do kit, cole a URL e ative a conexão.' };
        case 'connecting':
            return { tone: 'muted', text: 'Conectando ao Worker…' };
        case 'online':
            return { tone: 'success', text: `Conectada. ${status.toolCount} ferramentas disponíveis para os agentes.` };
        case 'reconnecting':
            return { tone: 'warning', text: `Reconectando. ${status.reason}` };
        case 'failed':
            return { tone: 'danger', text: status.reason };
    }
}
export function BridgeStatusLine({ status, problem }: BridgeStatusLineProps) {
    const { tone, text } = describeStatus(status, problem);
    return (<p role="status" className={cn('flex items-start gap-1.5 px-2 pt-0.5 text-3xs', TEXT_CLASS[tone])}>
      <span aria-hidden className={cn('mt-1 size-1.5 shrink-0 rounded-full', DOT_CLASS[tone])}/>
      <span className="min-w-0">{text}</span>
    </p>);
}
