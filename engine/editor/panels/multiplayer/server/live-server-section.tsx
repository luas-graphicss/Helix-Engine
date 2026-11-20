'use client';
import type { MultiplayerStatus } from '@/engine/editor/multiplayer/use-multiplayer-status';
import { formatDuration, plural } from '../shared/format';
import { PanelSection, SectionNote } from '../shared/panel-section';
import { ReadoutList, type Readout } from '../shared/readout-list';
const TITLE = 'Servidor simulado ao vivo';
function idleNote(status: MultiplayerStatus): string {
    if (status.active && status.linkKind === 'hosted')
        return 'Este teste usa o servidor hospedado. Os números dele ficam em /health, no próprio servidor.';
    return 'Inicie o teste de jogo com o servidor simulado para ver sessões, lobbies, buscas de partida e salas de relay.';
}
export function LiveServerSection({ status }: {
    status: MultiplayerStatus;
}) {
    const { server } = status;
    if (!server) {
        return (<PanelSection title={TITLE}>
        <SectionNote>{idleNote(status)}</SectionNote>
      </PanelSection>);
    }
    const readouts: Readout[] = [
        { label: 'No ar há', value: formatDuration(server.uptimeMs) },
        { label: 'Jogadores', value: server.players },
        { label: 'Lobbies abertos', value: server.lobbies },
        { label: 'Buscando partida', value: server.searching },
        { label: 'Salas de relay', value: server.relayRooms, hint: 'Sessões hospedadas por um jogador, com os pacotes repassados pelo servidor' },
        { label: 'Ligações por relay', value: server.relayConnections },
        { label: 'Ligados aos serviços', value: server.serviceMembers, hint: 'Jogos com a ligação de lobby e matchmaking aberta' },
    ];
    return (<PanelSection title={TITLE} description="O mesmo servidor do pacote exportado, rodando dentro do editor durante este teste.">
      <ReadoutList items={readouts}/>
      {server.sessions.length === 0 ? (<SectionNote>Nenhuma sessão aberta.</SectionNote>) : (<ul className="flex flex-col gap-px" aria-label="Sessões abertas">
          {server.sessions.map((entry) => (<li key={entry.id} className="flex h-control items-center gap-2 rounded-sm px-1.5 text-2xs odd:bg-surface-sunken/50">
              <span className="min-w-0 flex-1 truncate font-mono text-foreground" title={entry.id}>
                {entry.id}
              </span>
              <span className="shrink-0 font-mono text-3xs text-muted-foreground">
                {entry.players} de {entry.maxPlayers}
              </span>
              <span className="w-20 shrink-0 text-right font-mono text-3xs text-muted-foreground">{plural(entry.objects, 'objeto', 'objetos')}</span>
              <span className="w-20 shrink-0 text-right font-mono text-3xs text-muted-foreground/70">tick {entry.tick}</span>
            </li>))}
        </ul>)}
    </PanelSection>);
}
