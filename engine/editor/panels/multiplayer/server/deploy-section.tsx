'use client';
import { useState } from 'react';
import { Check, Download, Settings2 } from 'lucide-react';
import { editorDialogs } from '@/engine/editor/dialogs/editor-dialogs';
import { exportServerBundle } from '@/engine/editor/operations/server-bundle-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { GAME_SERVER_TARGET_LABEL, isAuthoritative } from '@/engine/scripting/scripting-settings';
import { ActionButton } from '@/engine/ui/action-button';
import { cn } from '@/lib/utils';
import { PanelSection, SectionNote } from '../shared/panel-section';
type DeployStep = {
    title: string;
    detail: string;
    done: boolean;
};
export function DeploySection() {
    const session = useEditorSession();
    const [exporting, setExporting] = useState(false);
    const { scripting, multiplayer } = session.scene;
    const { server } = scripting;
    const authoritative = isAuthoritative(scripting);
    const steps: DeployStep[] = [
        {
            title: 'Ligar o servidor autoritativo',
            detail: authoritative ? `Ligado: pacote ${GAME_SERVER_TARGET_LABEL[server.target]}, ${server.tickRate} Hz, até ${server.maxPlayers} jogadores por sessão.` : 'O pacote só é gerado com o servidor autoritativo ligado em Servidor do jogo.',
            done: authoritative,
        },
        {
            title: 'Exportar e hospedar o pacote',
            detail: 'O pacote leva sessões, lobby, matchmaking e relay desta cena, com o mesmo código do servidor simulado. O README dele traz os comandos para subir.',
            done: false,
        },
        {
            title: 'Colar o endereço público',
            detail: server.url || 'Depois de hospedar, cole o endereço wss:// em Servidor do jogo: o jogo exportado e o teste Hospedado conectam nele.',
            done: server.url !== '',
        },
    ];
    const runExport = async () => {
        setExporting(true);
        try {
            await exportServerBundle(session);
        }
        finally {
            setExporting(false);
        }
    };
    return (<PanelSection title="Servidor dedicado" description="Do editor ao servidor no ar em três passos. Você hospeda onde quiser; a engine gera o pacote pronto.">
      <ol className="flex flex-col gap-2">
        {steps.map(({ title, detail, done }, index) => (<li key={title} className="flex items-start gap-2">
            <span aria-hidden className={cn('mt-px flex size-4 shrink-0 items-center justify-center rounded-full border font-mono text-3xs', done ? 'border-success/50 text-success' : 'border-border text-muted-foreground')}>
              {done ? <Check className="size-2.5" strokeWidth={3}/> : index + 1}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-2xs text-foreground">
                {title}
                {done && <span className="sr-only"> (feito)</span>}
              </span>
              <span className="text-3xs leading-relaxed text-pretty break-words text-muted-foreground">{detail}</span>
            </span>
          </li>))}
      </ol>
      <div className="flex flex-wrap items-center gap-1.5">
        <ActionButton icon={Settings2} onClick={() => editorDialogs.open('gameServer')}>
          Servidor do jogo…
        </ActionButton>
        <ActionButton icon={Download} variant="primary" disabled={!authoritative || exporting} onClick={() => void runExport()}>
          {exporting ? 'Exportando…' : 'Exportar pacote do servidor…'}
        </ActionButton>
      </div>
      {!multiplayer.enabled && <SectionNote>O multiplayer está desligado nesta cena: o pacote sairia sem sessões, lobby, matchmaking e relay.</SectionNote>}
    </PanelSection>);
}
