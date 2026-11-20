'use client';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { planSceneNetwork } from '@/engine/net/scene/scene-network-plan';
import { PanelSection, SectionNote } from '../shared/panel-section';
import { ReadoutList, type Readout } from '../shared/readout-list';
export function BundleSection() {
    const session = useEditorSession();
    const { multiplayer } = session.scene;
    const plan = planSceneNetwork(session.scene);
    const readouts: Readout[] = [
        { label: 'Objetos da cena', value: plan.sceneObjects.length, hint: 'Criados pelo servidor quando a sessão abre' },
        { label: 'Criados por jogador', value: plan.playerTemplates.length, hint: 'O servidor cria uma cópia para cada jogador que entra' },
        { label: 'Modelos sob demanda', value: plan.spawnTemplates.length, hint: 'O anfitrião cria cópias com helix.multiplayer.spawn' },
        { label: 'RPCs declarados', value: multiplayer.rpcs.length },
        { label: 'Lobby', value: multiplayer.lobby.enabled ? `até ${multiplayer.lobby.maxMembers} membros` : 'desligado' },
        { label: 'Filas de matchmaking', value: multiplayer.matchmaking.enabled ? multiplayer.matchmaking.queues.length : 'desligado' },
        { label: 'Relay', value: multiplayer.relay.enabled ? 'ligado' : 'desligado' },
        { label: 'Sessões ao mesmo tempo', value: multiplayer.server.maxSessions },
        { label: 'Esquema', value: plan.schema, hint: 'Assinatura dos objetos de rede e das variáveis; jogo e servidor precisam da mesma' },
    ];
    return (<PanelSection title="O que vai no pacote" description="O servidor recebe a descrição dos objetos de rede e as regras da sessão; malhas, texturas e scripts de cliente ficam de fora. Depois de mudar objetos de rede, variáveis ou RPCs, exporte o jogo e o pacote de novo: um jogo de outro esquema é recusado ao entrar.">
      <ReadoutList items={readouts}/>
      {plan.outOfRange.length > 0 && <SectionNote>{`Fora da rede por falta de id de objeto: ${plan.outOfRange.join(', ')}. A cena tem atores demais antes deles; recrie esses atores ou reduza a cena.`}</SectionNote>}
    </PanelSection>);
}
