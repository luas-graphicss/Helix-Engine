'use client';
import { useState } from 'react';
import { useMultiplayerStatus, type MultiplayerStatus } from '@/engine/editor/multiplayer/use-multiplayer-status';
import { setMultiplayerEnabled } from '@/engine/editor/operations/multiplayer/multiplayer-settings-operations';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { networkEntities } from '@/engine/net/scene/scene-network-plan';
import { SESSION_TOPOLOGY_LABEL } from '@/engine/net/settings/multiplayer-settings';
import { PanelSummaryFooter } from '@/engine/ui/panel-summary-footer';
import { PanelToolbar } from '@/engine/ui/panel-toolbar';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { ToggleSwitch } from '@/engine/ui/toggle-field';
import { ObjectsView } from './multiplayer/objects/objects-view';
import { RpcsView } from './multiplayer/rpcs/rpcs-view';
import { ServerView } from './multiplayer/server/server-view';
import { ServicesView } from './multiplayer/services/services-view';
import { SessionView } from './multiplayer/session/session-view';
import { formatMilliseconds, plural } from './multiplayer/shared/format';
import { ToolsView } from './multiplayer/tools/tools-view';
const VIEWS = [
    { value: 'session', label: 'Sessão' },
    { value: 'services', label: 'Serviços' },
    { value: 'objects', label: 'Objetos' },
    { value: 'rpcs', label: 'RPCs' },
    { value: 'server', label: 'Servidor' },
    { value: 'tools', label: 'Ferramentas' },
] as const;
type MultiplayerView = (typeof VIEWS)[number]['value'];
function MultiplayerViewBody({ view, status }: {
    view: MultiplayerView;
    status: MultiplayerStatus;
}) {
    switch (view) {
        case 'session':
            return <SessionView status={status}/>;
        case 'services':
            return <ServicesView />;
        case 'objects':
            return <ObjectsView />;
        case 'rpcs':
            return <RpcsView />;
        case 'server':
            return <ServerView status={status}/>;
        case 'tools':
            return <ToolsView status={status}/>;
    }
}
function liveSummary(status: MultiplayerStatus): string | false {
    if (!status.active)
        return false;
    if (status.phase !== 'connected')
        return status.phase === 'offline' ? 'fora de sessão' : 'conectando';
    const latency = status.stats ? ` · ${formatMilliseconds(status.stats.roundTripMs)}` : '';
    return `ao vivo: ${plural(status.players.length, 'jogador', 'jogadores')}${latency}`;
}
export function MultiplayerPanel() {
    const session = useSessionTopic('scene', 'playtest');
    const [view, setView] = useState<MultiplayerView>('session');
    const status = useMultiplayerStatus(session);
    const settings = session.scene.multiplayer;
    const queues = settings.matchmaking.enabled ? settings.matchmaking.queues.length : 0;
    return (<div className="flex h-full min-h-0 flex-col">
      <PanelToolbar>
        <span className="flex min-w-0 max-w-2xl flex-1">
          <SegmentedControl label="Seção do multiplayer" options={VIEWS} value={view} onChange={setView}/>
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-1.5 pl-2 text-2xs text-muted-foreground">
          <span aria-hidden>{settings.enabled ? 'Ligado' : 'Desligado'}</span>
          <ToggleSwitch label="Multiplayer nesta cena" on={settings.enabled} onToggle={() => setMultiplayerEnabled(session, !settings.enabled)}/>
        </span>
      </PanelToolbar>
      {!settings.enabled && (<p className="shrink-0 border-b border-border bg-surface-sunken/60 px-3 py-1.5 text-2xs leading-relaxed text-pretty text-muted-foreground">
          O multiplayer está desligado nesta cena. O que você ajustar aqui fica guardado e passa a valer quando ligar a chave no canto do painel.
        </p>)}
      <div className="min-h-0 flex-1">
        <MultiplayerViewBody view={view} status={status}/>
      </div>
      <PanelSummaryFooter parts={[
            settings.enabled ? SESSION_TOPOLOGY_LABEL[settings.topology] : 'Desligado',
            `${settings.sendRate} Hz`,
            plural(networkEntities(session.scene).length, 'objeto de rede', 'objetos de rede'),
            plural(settings.rpcs.length, 'RPC', 'RPCs'),
            plural(queues, 'fila', 'filas'),
            liveSummary(status),
        ]}/>
    </div>);
}
