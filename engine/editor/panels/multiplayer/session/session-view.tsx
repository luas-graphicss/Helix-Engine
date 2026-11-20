'use client';
import type { MultiplayerStatus } from '@/engine/editor/multiplayer/use-multiplayer-status';
import { editorDialogs } from '@/engine/editor/dialogs/editor-dialogs';
import { updateMultiplayerSession, updateSessionServer } from '@/engine/editor/operations/multiplayer/multiplayer-settings-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { MAX_SERVER_SESSIONS, SEND_RATES, SESSION_TOPOLOGIES, SESSION_TOPOLOGY_HINT, SESSION_TOPOLOGY_LABEL } from '@/engine/net/settings/multiplayer-settings';
import { ActionButton } from '@/engine/ui/action-button';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { SelectField } from '@/engine/ui/select-field';
import { ToggleSwitch } from '@/engine/ui/toggle-field';
import { CommitField, NumberField } from '../shared/fields';
import { PanelSection, SettingRow, ViewGrid } from '../shared/panel-section';
import { LiveSession } from './live-session';
const TOPOLOGY_OPTIONS = SESSION_TOPOLOGIES.map((topology) => ({ value: topology, label: SESSION_TOPOLOGY_LABEL[topology] }));
const SEND_RATE_OPTIONS = SEND_RATES.map((rate) => ({ value: rate, label: `${rate} Hz` }));
const MAX_GRACE_SECONDS = 120;
const MAX_EMPTY_SECONDS = 3600;
export function SessionView({ status }: {
    status: MultiplayerStatus;
}) {
    const session = useEditorSession();
    const settings = session.scene.multiplayer;
    const { server } = session.scene.scripting;
    const dedicated = settings.topology === 'dedicated';
    return (<ViewGrid>
      <PanelSection title="Topologia" description={SESSION_TOPOLOGY_HINT[settings.topology]}>
        <div className="flex">
          <SegmentedControl label="Quem roda a sessão" options={TOPOLOGY_OPTIONS} value={settings.topology} onChange={(topology) => updateMultiplayerSession(session, { topology })}/>
        </div>
        <SettingRow label={dedicated ? 'Entrar ao iniciar' : 'Abrir sessão ao iniciar'} hint={dedicated ? 'O jogo entra sozinho na sessão padrão. Desligue quando a entrada vier do lobby, do matchmaking ou de um script.' : 'O jogo abre uma sessão e mostra o código de convite. Desligue quando o jogador escolhe entre hospedar e entrar por código.'}>
          <ToggleSwitch label="Entrar na sessão ao iniciar o jogo" on={settings.autoJoin} onToggle={() => updateMultiplayerSession(session, { autoJoin: !settings.autoJoin })}/>
        </SettingRow>
        {dedicated && (<SettingRow label="Sessão padrão" hint="Nome da sessão em que o jogo entra sozinho. Jogos na mesma sessão se veem.">
            <CommitField label="Nome da sessão padrão" value={settings.defaultSession} className="w-36 flex-none" onCommit={(defaultSession) => updateMultiplayerSession(session, { defaultSession })}/>
          </SettingRow>)}
      </PanelSection>
      <PanelSection title="Sincronização" description="Com que frequência a pose dos objetos viaja e por quanto tempo o servidor guarda a vaga de quem caiu.">
        <SettingRow label="Envios por segundo" hint="Nunca passa do tick do servidor. 20 Hz serve à maioria; 30 ou 60 Hz para ação rápida.">
          <span className="flex w-24">
            <SelectField label="Envios de estado por segundo" options={SEND_RATE_OPTIONS} value={settings.sendRate} onChange={(sendRate) => updateMultiplayerSession(session, { sendRate })}/>
          </span>
        </SettingRow>
        <SettingRow label="Tempo para reconectar" hint="Segundos em que o jogador que caiu volta ao mesmo lugar, com os mesmos objetos. 0 remove na hora.">
          <NumberField label="Segundos para reconectar" value={settings.reconnectGraceSeconds} min={0} max={MAX_GRACE_SECONDS} onCommit={(reconnectGraceSeconds) => updateMultiplayerSession(session, { reconnectGraceSeconds })}/>
        </SettingRow>
        <SettingRow label="Tick e jogadores" hint={`${server.tickRate} Hz e até ${server.maxPlayers} jogadores por sessão, definidos junto do servidor do jogo.`}>
          <ActionButton onClick={() => editorDialogs.open('gameServer')}>Servidor do jogo…</ActionButton>
        </SettingRow>
      </PanelSection>
      <PanelSection title="Sessões no servidor" description="Limites do servidor dedicado, que também valem no servidor simulado do editor.">
        <SettingRow label="Sessões ao mesmo tempo" hint="Acima disso o servidor recusa abrir outra.">
          <NumberField label="Máximo de sessões" value={settings.server.maxSessions} min={1} max={MAX_SERVER_SESSIONS} onCommit={(maxSessions) => updateSessionServer(session, { maxSessions })}/>
        </SettingRow>
        <SettingRow label="Fechar sessão vazia" hint="Segundos sem jogadores até a sessão ser encerrada.">
          <NumberField label="Segundos até fechar a sessão vazia" value={settings.server.emptySessionSeconds} min={5} max={MAX_EMPTY_SECONDS} onCommit={(emptySessionSeconds) => updateSessionServer(session, { emptySessionSeconds })}/>
        </SettingRow>
        <SettingRow label="Sessões abertas pelo nome" hint="Ligado: entrar numa sessão que não existe cria a sessão. Desligado: só o lobby e o matchmaking criam sessões.">
          <ToggleSwitch label="Criar a sessão no primeiro acesso" on={settings.server.openSessions} onToggle={() => updateSessionServer(session, { openSessions: !settings.server.openSessions })}/>
        </SettingRow>
      </PanelSection>
      <LiveSession status={status}/>
    </ViewGrid>);
}
