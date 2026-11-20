'use client';
import { Copy } from 'lucide-react';
import type { MultiplayerStatus } from '@/engine/editor/multiplayer/use-multiplayer-status';
import type { SessionPhase } from '@/engine/net/runtime/runtime-events';
import { copyTextToClipboard } from '@/engine/ui/clipboard';
import { IconButton } from '@/engine/ui/icon-button';
import { cn } from '@/lib/utils';
import { formatMilliseconds } from '../shared/format';
import { PanelSection, SectionNote } from '../shared/panel-section';
const PHASE_LABEL: Record<SessionPhase, string> = {
    offline: 'Fora de sessão',
    connecting: 'Conectando',
    connected: 'Conectado',
    reconnecting: 'Reconectando',
};
const PHASE_TONE: Record<SessionPhase, string> = {
    offline: 'bg-muted-foreground',
    connecting: 'bg-warning',
    connected: 'bg-success',
    reconnecting: 'bg-warning',
};
export function LiveSession({ status }: {
    status: MultiplayerStatus;
}) {
    if (!status.active) {
        return (<PanelSection title="Ao vivo">
        <SectionNote>{status.playing ? 'Esta cena está rodando sem multiplayer. Ligue-o no canto do painel e inicie o teste de jogo de novo.' : 'Inicie o teste de jogo para ver a sessão, os jogadores e o código de convite.'}</SectionNote>
      </PanelSection>);
    }
    const origin = status.linkKind === 'hosted' ? 'servidor hospedado' : 'servidor simulado no editor';
    return (<PanelSection title="Ao vivo" description={`Ligado ao ${origin}${status.isHost ? '; esta máquina roda a sessão' : ''}.`}>
      <p className="flex items-center gap-1.5 text-2xs text-foreground" aria-live="polite">
        <span className={cn('size-1.5 shrink-0 rounded-full', PHASE_TONE[status.phase])} aria-hidden/>
        <span>{PHASE_LABEL[status.phase]}</span>
        {status.sessionId && <span className="min-w-0 truncate font-mono text-3xs text-muted-foreground">{status.sessionId}</span>}
        {status.stats && <span className="ml-auto shrink-0 font-mono text-3xs text-muted-foreground">{formatMilliseconds(status.stats.roundTripMs)}</span>}
      </p>
      {status.joinCode && (<p className="flex items-center gap-2 text-2xs text-muted-foreground">
          Código de convite
          <span className="font-mono text-xs tracking-[0.2em] text-foreground">{status.joinCode}</span>
          <IconButton label="Copiar o código de convite" size="xs" onClick={() => void copyTextToClipboard(status.joinCode)}>
            <Copy />
          </IconButton>
        </p>)}
      <ul className="flex flex-col gap-px">
        {status.players.map((player) => (<li key={player.id} className="flex h-control items-center gap-2 rounded-sm px-1.5 text-2xs odd:bg-surface-sunken/50">
            <span className="w-5 shrink-0 font-mono text-3xs text-muted-foreground">{player.id}</span>
            <span className="min-w-0 flex-1 truncate text-foreground">{player.name}</span>
            {player.id === status.localPlayerId && <span className="shrink-0 font-mono text-3xs text-primary">você</span>}
          </li>))}
      </ul>
    </PanelSection>);
}
