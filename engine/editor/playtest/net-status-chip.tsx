'use client';
import { editorDialogs } from '@/engine/editor/dialogs/editor-dialogs';
import { LinkIcon, ServerIcon } from '@/engine/editor/code/icons/code-icons';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { TOOLBAR_CHIP_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
import { useNetStatus, type NetStatus } from './use-net-status';
function describe(status: NetStatus): {
    text: string;
    tone: string;
    title: string;
} {
    if (status.transport === 'local') {
        return {
            text: `Servidor simulado · ${status.players} ${status.players === 1 ? 'jogador' : 'jogadores'}`,
            tone: 'text-warning',
            title: 'O servidor autoritativo roda simulado dentro deste playtest. Clique para abrir Servidor do jogo.',
        };
    }
    if (status.connecting)
        return { text: `Conectando a ${status.room}…`, tone: 'text-muted-foreground', title: `Abrindo ${status.address ?? 'o servidor hospedado'}` };
    if (status.connected) {
        return {
            text: `Hospedado · ${status.room} · ${status.latencyMs} ms`,
            tone: 'text-success',
            title: `Conectado a ${status.address ?? 'servidor hospedado'} com ${status.players} ${status.players === 1 ? 'jogador' : 'jogadores'} na sala. Os scripts de Servidor rodam lá.`,
        };
    }
    return { text: 'Servidor hospedado · desconectado', tone: 'text-destructive', title: `Sem ligação com ${status.address ?? 'o servidor hospedado'}; veja o console. Clique para abrir Servidor do jogo.` };
}
export function NetStatusChip() {
    const session = useSessionTopic('playtest');
    const status = useNetStatus(session);
    if (!status.running || status.transport === 'none')
        return null;
    const { text, tone, title } = describe(status);
    const Icon = status.transport === 'local' ? ServerIcon : LinkIcon;
    return (<button type="button" title={title} aria-label={`Rede do playtest: ${text}`} className={cn(TOOLBAR_CHIP_CLASS, tone, 'hover:brightness-110')} onClick={() => editorDialogs.open('gameServer')}>
      <Icon className="size-3" aria-hidden/>
      <span className="truncate">{text}</span>
    </button>);
}
