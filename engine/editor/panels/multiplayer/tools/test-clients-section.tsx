'use client';
import { UserMinus, UserPlus } from 'lucide-react';
import type { MultiplayerStatus } from '@/engine/editor/multiplayer/use-multiplayer-status';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { MAX_TEST_CLIENTS } from '@/engine/net/tools/test-clients';
import { ActionButton } from '@/engine/ui/action-button';
import { PanelSection, SectionNote } from '../shared/panel-section';
export function TestClientsSection({ status }: {
    status: MultiplayerStatus;
}) {
    const session = useEditorSession();
    const runtime = session.scripts.multiplayer;
    const connected = status.phase === 'connected';
    return (<PanelSection title="Clientes de teste" description="Jogadores simulados que entram na sessão deste teste por uma ligação de verdade. Cada um recebe os objetos por jogador e os move em círculo, para ver cópias remotas, interpolação e lotação sem abrir outra janela.">
      <div className="flex items-center gap-1.5">
        <ActionButton icon={UserPlus} disabled={!connected || status.testClients >= MAX_TEST_CLIENTS} onClick={() => {
            runtime.addTestClient();
        }}>
          Adicionar
        </ActionButton>
        <ActionButton icon={UserMinus} disabled={status.testClients === 0} onClick={() => {
            runtime.removeTestClient();
        }}>
          Remover
        </ActionButton>
        <span className="ml-auto font-mono text-2xs text-foreground tabular-nums" aria-live="polite">
          {status.testClients} de {MAX_TEST_CLIENTS}
        </span>
      </div>
      {!connected && <SectionNote>Os clientes de teste entram quando o jogo está conectado a uma sessão. Inicie o teste de jogo com o multiplayer ligado.</SectionNote>}
    </PanelSection>);
}
