'use client';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { SESSION_ROUTE } from '@/engine/net/server/multiplayer-server';
import { SERVICES_ROUTE, multiplayerUrl } from '@/engine/net/transport/multiplayer-address';
import { engineSettings, useEngineSetting } from '@/engine/settings/engine-settings-store';
import { SettingControl } from '@/engine/settings/ui/setting-control';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { PanelSection, SectionNote, SettingRow } from '../shared/panel-section';
const TARGET_OPTIONS = [
    { value: 'simulated', label: 'Simulado no editor' },
    { value: 'hosted', label: 'Hospedado' },
] as const;
function hostedAddress(serverUrl: string, path: string): string | null {
    return serverUrl !== '' && URL.canParse(serverUrl) ? multiplayerUrl(serverUrl, path) : null;
}
export function PlaytestTargetSection() {
    const session = useEditorSession();
    const target = useEngineSetting('simulation.net.server');
    const { multiplayer, scripting } = session.scene;
    const path = multiplayer.topology === 'dedicated' ? `${SESSION_ROUTE}/${multiplayer.defaultSession}` : SERVICES_ROUTE;
    const address = hostedAddress(scripting.server.url, path);
    return (<PanelSection title="Teste de jogo" description="Onde a sessão roda enquanto você testa. É uma preferência desta máquina, não do projeto.">
      <div className="flex">
        <SegmentedControl label="Servidor do teste de jogo" options={TARGET_OPTIONS} value={target} onChange={(value) => engineSettings.set('simulation.net.server', value)}/>
      </div>
      {target === 'simulated' && <SectionNote>Sessões, lobby, matchmaking e relay rodam dentro do editor, com o mesmo código do pacote exportado e a rede simulada da aba Ferramentas.</SectionNote>}
      {target === 'hosted' && address === null && <SectionNote>Sem endereço do servidor, o teste cai no servidor simulado. Cole o endereço em Servidor do jogo.</SectionNote>}
      {target === 'hosted' && address !== null && (<>
          <p className="truncate font-mono text-3xs text-muted-foreground" title={address}>
            {address}
          </p>
          <SettingRow label="Bilhete de teste" hint="Vai junto do pedido de entrada, para o servidor conferir quem é. Fica só nesta máquina.">
            <span className="flex w-40">
              <SettingControl id="simulation.net.ticket"/>
            </span>
          </SettingRow>
          <SectionNote>Abra o teste em duas janelas para ver dois jogadores de verdade na mesma sessão.</SectionNote>
        </>)}
    </PanelSection>);
}
