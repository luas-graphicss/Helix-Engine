'use client';
import { Plus } from 'lucide-react';
import { addMatchQueue, canAddMatchQueue } from '@/engine/editor/operations/multiplayer/matchmaking-queue-operations';
import { setMatchmakingEnabled, setRelayEnabled, updateLobbySettings } from '@/engine/editor/operations/multiplayer/multiplayer-settings-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { MAX_LOBBY_MEMBERS } from '@/engine/net/settings/multiplayer-settings';
import { IconButton } from '@/engine/ui/icon-button';
import { ToggleSwitch } from '@/engine/ui/toggle-field';
import { NumberField } from '../shared/fields';
import { PanelSection, SectionNote, SettingRow, ViewGrid } from '../shared/panel-section';
import { QueueRow } from './queue-row';
export function ServicesView() {
    const session = useEditorSession();
    const { lobby, matchmaking, relay, topology } = session.scene.multiplayer;
    return (<ViewGrid>
      <PanelSection title="Lobby" description="Salas de espera com código de convite, lista pública, prontidão e dados por membro. Ao iniciar, o servidor reserva a sessão e leva todos os membros a ela." dimmed={!lobby.enabled} actions={<ToggleSwitch label="Lobby" on={lobby.enabled} onToggle={() => updateLobbySettings(session, { enabled: !lobby.enabled })}/>}>
        <SettingRow label="Membros por lobby" hint="Teto que o servidor aceita; cada lobby pode pedir menos ao ser criado.">
          <NumberField label="Máximo de membros por lobby" value={lobby.maxMembers} min={1} max={MAX_LOBBY_MEMBERS} disabled={!lobby.enabled} onCommit={(maxMembers) => updateLobbySettings(session, { maxMembers })}/>
        </SettingRow>
        <p className="font-mono text-3xs leading-relaxed text-muted-foreground">{'helix.multiplayer.lobby.create({ name, maxMembers }) · joinByCode(código) · setReady(true) · start()'}</p>
      </PanelSection>
      <PanelSection title="Matchmaking" description="Filas que juntam jogadores de nível próximo. A janela de nível abre com a espera; o grupo do lobby pode entrar junto e fica no mesmo time." dimmed={!matchmaking.enabled} actions={<>
            <IconButton label="Adicionar fila de matchmaking" size="sm" disabled={!matchmaking.enabled || !canAddMatchQueue(session)} onClick={() => addMatchQueue(session)}>
              <Plus />
            </IconButton>
            <ToggleSwitch label="Matchmaking" on={matchmaking.enabled} onToggle={() => setMatchmakingEnabled(session, !matchmaking.enabled)}/>
          </>}>
        {matchmaking.queues.length === 0 ? (<SectionNote>Nenhuma fila. Adicione uma para os jogadores procurarem partida.</SectionNote>) : (<ul className="flex flex-col gap-1.5">
            {matchmaking.queues.map((queue) => (<QueueRow key={queue.name} queue={queue}/>))}
          </ul>)}
        <p className="font-mono text-3xs leading-relaxed text-muted-foreground">{"helix.multiplayer.matchmaking.find('fila', { skill, party })"}</p>
      </PanelSection>
      <PanelSection title="Relay" description="Repassa os pacotes entre o jogador anfitrião e os convidados, sem expor o endereço de ninguém e sem abrir portas no roteador. O convidado entra com um código de seis caracteres." dimmed={!relay.enabled} actions={<ToggleSwitch label="Relay" on={relay.enabled} onToggle={() => setRelayEnabled(session, !relay.enabled)}/>}>
        {topology === 'relay' && !relay.enabled && <SectionNote>A topologia desta cena é Jogador anfitrião, que depende do relay. Ligue-o ou troque a topologia na aba Sessão.</SectionNote>}
        <p className="font-mono text-3xs leading-relaxed text-muted-foreground">{'helix.multiplayer.host() devolve o código · joinByCode(código) entra'}</p>
      </PanelSection>
    </ViewGrid>);
}
