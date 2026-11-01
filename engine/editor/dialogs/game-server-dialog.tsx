'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ClientIcon, LinkIcon, LockIcon, ServerIcon, SharedIcon } from '@/engine/editor/code/icons/code-icons';
import { ContextIcon } from '@/engine/editor/code/ui/context-chip';
import { setGameServerMode, updateGameServer } from '@/engine/editor/operations/game-server-operations';
import { exportServerBundle } from '@/engine/editor/operations/server-bundle-operations';
import { useNetStatus } from '@/engine/editor/playtest/use-net-status';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { roomAddress } from '@/engine/net/transport/server-address';
import { SCRIPT_CONTEXT_ORDER, SCRIPT_CONTEXT_TONE, contextLabel, contextOf } from '@/engine/scripting/script-sides';
import { GAME_SERVER_MAX_PLAYERS, GAME_SERVER_TARGETS, GAME_SERVER_TARGET_HINT, GAME_SERVER_TARGET_LABEL, GAME_SERVER_TICK_RATES, isAuthoritative, normalizeServerUrl } from '@/engine/scripting/scripting-settings';
import { engineSettings, useEngineSettingsVersion } from '@/engine/settings/engine-settings-store';
import { SettingControl } from '@/engine/settings/ui/setting-control';
import { openSettingsSection } from '@/engine/settings/ui/settings-navigation';
import { FieldInput } from '@/engine/ui/field-input';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { SelectField } from '@/engine/ui/select-field';
import { EMPTY_WELL_CLASS, FOCUS_RING_CLASS } from '@/engine/ui/surface-styles';
import { ToggleSwitch } from '@/engine/ui/toggle-field';
import { cn } from '@/lib/utils';
import { editorDialogs } from './editor-dialogs';
import { EditorDialogShell } from './editor-dialog-shell';
interface GameServerDialogProps {
    open: boolean;
    onOpenChange(open: boolean): void;
}
function Section({ title, description, children, dimmed = false }: {
    title: string;
    description?: ReactNode;
    children: ReactNode;
    dimmed?: boolean;
}) {
    return (<section className={cn('flex flex-col gap-3 border-b border-border px-5 py-4 last:border-b-0', dimmed && 'opacity-60')}>
      <header className="flex flex-col gap-0.5">
        <h3 className="text-3xs font-medium tracking-wider text-muted-foreground uppercase">{title}</h3>
        {description && <p className="text-2xs leading-relaxed text-pretty text-muted-foreground">{description}</p>}
      </header>
      {children}
    </section>);
}
function Row({ label, hint, children }: {
    label: string;
    hint?: string;
    children: ReactNode;
}) {
    return (<div className="grid grid-cols-[140px_minmax(0,1fr)] items-start gap-3">
      <div className="flex flex-col gap-0.5 pt-1">
        <span className="text-2xs text-foreground">{label}</span>
        {hint && <span className="text-3xs leading-relaxed text-muted-foreground">{hint}</span>}
      </div>
      <div className="flex min-w-0 flex-col gap-1">{children}</div>
    </div>);
}
const TICK_OPTIONS = GAME_SERVER_TICK_RATES.map((rate) => ({ value: rate, label: `${rate} Hz` }));
const TARGET_OPTIONS = GAME_SERVER_TARGETS.map((target) => ({ value: target, label: GAME_SERVER_TARGET_LABEL[target] }));
const HOW_IT_WORKS: ReadonlyArray<{
    icon: typeof ServerIcon;
    title: string;
    text: string;
}> = [
    {
        icon: LockIcon,
        title: 'Dois lados, um projeto',
        text: 'Cada script tem um lado: Servidor, Cliente ou Ambos. O projeto guarda tudo junto, mas o jogo exportado para o jogador leva só Cliente e Ambos; o pacote de servidor leva só Servidor e Ambos. O código do servidor nunca chega ao jogador, nem num .exe.',
    },
    {
        icon: ServerIcon,
        title: 'O servidor manda',
        text: 'Pontuação, inventário, vida, economia: o servidor guarda e decide. O cliente pede com helix.net.call ou helix.net.emit; um script de servidor valida (tipos, limites, perSecond) e responde. Nada que venha do cliente é verdade até o servidor dizer que é.',
    },
    {
        icon: SharedIcon,
        title: 'Estado e replicação',
        text: 'helix.net.state é o quadro publicado pelo servidor: só ele escreve, todo cliente lê a cópia e ouve onChanged. helix.net.replicate envia campos de atores (pose, vida) a cada tick; os clientes recebem em onReplicated.',
    },
    {
        icon: LinkIcon,
        title: 'Sem segredos no cliente',
        text: 'O cliente entra com um bilhete de sessão que o servidor confere em helix.net.authenticate; nenhuma chave fica no jogo distribuído. O transporte é WebSocket seguro (wss://) e o mesmo protocolo vale para o servidor simulado do editor e para o hospedado: o playtest pode conectar ao seu servidor de verdade antes de qualquer exportação.',
    },
];
const PLAYTEST_SERVER_OPTIONS = [
    { value: 'simulated', label: 'Simulado no editor' },
    { value: 'hosted', label: 'Hospedado' },
] as const;
export function GameServerDialog({ open, onOpenChange }: GameServerDialogProps) {
    const session = useSessionTopic('scene', 'assets', 'playtest');
    useEngineSettingsVersion();
    const { server } = session.scene.scripting;
    const authoritative = isAuthoritative(session.scene.scripting);
    const [urlDraft, setUrlDraft] = useState(server.url);
    const [exporting, setExporting] = useState(false);
    useEffect(() => {
        if (open)
            setUrlDraft(server.url);
    }, [open, server.url]);
    const urlValid = normalizeServerUrl(urlDraft) !== null;
    const commitUrl = () => {
        if (!urlValid || normalizeServerUrl(urlDraft) === server.url)
            return;
        updateGameServer(session, { url: urlDraft });
    };
    const scripts = session.library.byKind('script');
    const counts = SCRIPT_CONTEXT_ORDER.map((context) => ({ context, count: scripts.filter((asset) => contextOf(asset) === context).length }));
    const serverScripts = counts.find((entry) => entry.context === 'server')?.count ?? 0;
    const latency = engineSettings.get('simulation.net.latency');
    const jitter = engineSettings.get('simulation.net.jitter');
    const loss = engineSettings.get('simulation.net.loss');
    const degraded = latency > 0 || jitter > 0 || loss > 0;
    const playtestServer = engineSettings.get('simulation.net.server');
    const hosted = playtestServer === 'hosted';
    const testRoom = engineSettings.get('simulation.net.room');
    const hostedAddress = server.url ? roomAddress(server.url, testRoom) : null;
    const status = useNetStatus(session);
    const runExport = async () => {
        setExporting(true);
        try {
            await exportServerBundle(session);
        }
        finally {
            setExporting(false);
        }
    };
    return (<EditorDialogShell open={open} onOpenChange={onOpenChange} title="Servidor do jogo" description="Como o jogo se divide entre a máquina do jogador e o servidor. Com servidor autoritativo, scripts marcados como Servidor rodam num processo que o jogador nunca recebe, e é ele que valida e decide." size="lg" dismissible={!exporting} footer={<>
          <span className="font-mono text-3xs text-muted-foreground">
            {authoritative ? `Autoritativo · ${server.tickRate} Hz · até ${server.maxPlayers} ${server.maxPlayers === 1 ? 'jogador' : 'jogadores'} · ${GAME_SERVER_TARGET_LABEL[server.target]}` : 'Jogo só de cliente'}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button size="xs" variant="outline" disabled={!authoritative || exporting} title={authoritative ? 'Gera o pacote de servidor com os scripts de Servidor e Ambos, pronto para hospedar.' : 'Ligue o servidor autoritativo para exportar o pacote.'} onClick={() => void runExport()}>
              {exporting ? 'Exportando…' : 'Exportar pacote do servidor…'}
            </Button>
            <Button size="xs" onClick={() => onOpenChange(false)}>
              Concluído
            </Button>
          </div>
        </>}>
      <Section title="Modo">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <ServerIcon className={cn('size-3.5', authoritative ? 'text-warning' : 'text-muted-foreground')} aria-hidden/>
              Servidor autoritativo
            </span>
            <span className="text-2xs leading-relaxed text-pretty text-muted-foreground">
              {authoritative
            ? 'Ligado: o cliente só pede e o servidor decide. No playtest o servidor roda simulado no editor ou é o que você hospedou; o jogo exportado conecta sempre ao hospedado. Scripts de Servidor ficam fora do jogo do jogador.'
            : 'Desligado: tudo roda na máquina do jogador (single player, protótipos). helix.net funciona em modo local, para o código já nascer pronto para ganhar um servidor depois.'}
            </span>
          </div>
          <ToggleSwitch label="Servidor autoritativo" on={authoritative} onToggle={() => setGameServerMode(session, !authoritative)} className="mt-0.5"/>
        </div>
        {authoritative && serverScripts === 0 && (<p className={cn('px-3 py-2 text-2xs leading-relaxed text-pretty', EMPTY_WELL_CLASS)}>
            Nenhum script de Servidor ainda. Crie um pelo modelo <strong className="font-medium text-foreground">Regras no servidor</strong> (Novo script) ou marque um script existente como Servidor na barra do editor de código.
          </p>)}
      </Section>

      <Section title="Sala" description="Quantos jogadores uma sala aceita e com que frequência o servidor envia estado e replicação." dimmed={!authoritative}>
        <Row label="Tick do servidor" hint="Vezes por segundo que o estado e as replicações saem. 20 Hz serve à maioria; 60 Hz para ação rápida.">
          <div className="w-40">
            <SelectField label="Tick do servidor" options={TICK_OPTIONS} value={server.tickRate} disabled={!authoritative} onChange={(tickRate) => updateGameServer(session, { tickRate })}/>
          </div>
        </Row>
        <Row label="Máximo de jogadores" hint={`Por sala; o servidor recusa o excedente. Até ${GAME_SERVER_MAX_PLAYERS}.`}>
          <FieldInput type="number" min={1} max={GAME_SERVER_MAX_PLAYERS} step={1} value={server.maxPlayers} disabled={!authoritative} aria-label="Máximo de jogadores" className="w-24" onChange={(event) => updateGameServer(session, { maxPlayers: Number(event.currentTarget.value) })}/>
        </Row>
      </Section>

      <Section title="Hospedagem" description="Onde o servidor vai rodar. O código do jogo é o mesmo em todos os formatos; só o invólucro muda. Você hospeda onde quiser e cola o endereço aqui." dimmed={!authoritative}>
        <Row label="Pacote de servidor" hint={GAME_SERVER_TARGET_HINT[server.target]}>
          <SegmentedControl label="Formato do pacote de servidor" options={TARGET_OPTIONS} value={server.target} onChange={(target) => authoritative && updateGameServer(session, { target })}/>
        </Row>
        <Row label="Endereço do servidor" hint="wss://… que o jogo exportado procura e que o playtest usa no modo Hospedado. Pode ficar vazio enquanto só se testa com o servidor simulado.">
          <FieldInput type="url" inputMode="url" placeholder="wss://jogo.seu-dominio.com" value={urlDraft} disabled={!authoritative} aria-label="Endereço do servidor" aria-invalid={!urlValid} spellCheck={false} onChange={(event) => setUrlDraft(event.currentTarget.value)} onBlur={commitUrl} onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.keyCode !== 229)
                commitUrl();
        }} className={cn('w-full font-mono', !urlValid && 'text-destructive')}/>
          {!urlValid && <span className="text-3xs text-destructive">Use um endereço ws:// ou wss:// (http e https são convertidos).</span>}
        </Row>
      </Section>

      <Section title="No editor" description="Onde o servidor roda durante o playtest. Simulado: dentro do editor, com os scripts de Servidor deste projeto. Hospedado: o playtest conecta ao endereço acima e os scripts de Servidor rodam lá, não nesta máquina. É uma preferência sua, não do projeto." dimmed={!authoritative}>
        <Row label="Servidor do playtest" hint={hosted ? 'O cliente abre um WebSocket na sala de teste e apresenta o bilhete; sem servidor no ar, o playtest avisa no console.' : 'Mesma API e mesmo protocolo do servidor real, sem precisar hospedar nada.'}>
          <SegmentedControl label="Servidor do playtest" options={PLAYTEST_SERVER_OPTIONS} value={playtestServer} onChange={(value) => authoritative && engineSettings.set('simulation.net.server', value)}/>
        </Row>
        {hosted ? (<>
            <Row label="Sala de teste" hint="Duas abas na mesma sala se veem: abra o playtest em duas janelas para testar com dois jogadores.">
              <SettingControl id="simulation.net.room"/>
            </Row>
            <Row label="Bilhete de teste" hint="Vai no hello para helix.net.authenticate; fica nesta máquina e nunca no projeto.">
              <SettingControl id="simulation.net.ticket"/>
            </Row>
            <p className={cn('flex items-center gap-1.5 px-3 py-2 font-mono text-3xs', hostedAddress ? 'text-muted-foreground' : 'text-destructive', EMPTY_WELL_CLASS)}>
              <LinkIcon className="size-3.5 shrink-0" aria-hidden/>
              {hostedAddress ? <span className="truncate">{hostedAddress}</span> : 'Preencha o endereço do servidor acima; sem ele o playtest cai no servidor simulado.'}
            </p>
          </>) : (<div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-2xs text-muted-foreground">
              <LinkIcon className="size-3.5" aria-hidden/>
              {degraded ? `Ligação degradada: ${latency} ms${jitter > 0 ? ` ± ${jitter}` : ''}${loss > 0 ? ` · ${loss}% de perda` : ''}` : 'Ligação perfeita: entrega no mesmo frame'}
            </span>
            <button type="button" className={cn('shrink-0 text-2xs text-primary hover:underline', FOCUS_RING_CLASS)} onClick={() => {
                openSettingsSection('simulation');
                editorDialogs.open('settings');
            }}>
              Ajustar latência e perda…
            </button>
          </div>)}
        {status.running && status.transport !== 'none' && (<p className="flex items-center gap-1.5 text-2xs" aria-live="polite">
            <span className={cn('size-1.5 shrink-0 rounded-full', status.connected ? 'bg-success' : status.connecting ? 'bg-warning' : 'bg-destructive')} aria-hidden/>
            <span className="text-foreground">
              {status.transport === 'local'
                ? `Rodando com o servidor simulado · ${status.players} ${status.players === 1 ? 'jogador' : 'jogadores'}`
                : status.connecting
                    ? `Conectando a ${status.address}…`
                    : status.connected
                        ? `Conectado à sala "${status.room}" · ${status.players} ${status.players === 1 ? 'jogador' : 'jogadores'} · ${status.latencyMs} ms`
                        : `Sem ligação com ${status.address ?? 'o servidor hospedado'} (veja o console)`}
            </span>
          </p>)}
      </Section>

      <Section title="Scripts por lado" description="Só Servidor e Ambos entram no pacote de servidor; só Cliente e Ambos entram no jogo do jogador. Shaders são sempre do cliente.">
        <ul className="grid grid-cols-3 gap-2">
          {counts.map(({ context, count }) => (<li key={context} className={cn('flex items-center gap-2 rounded-sm border border-border bg-surface-sunken/60 px-3 py-2', SCRIPT_CONTEXT_TONE[context])}>
              <ContextIcon context={context} className="size-4"/>
              <span className="flex flex-col">
                <span className="text-2xs text-foreground">{contextLabel(context)}</span>
                <span className="font-mono text-3xs text-muted-foreground">{count === 1 ? '1 script' : `${count} scripts`}</span>
              </span>
            </li>))}
        </ul>
      </Section>

      <Section title="Como funciona">
        <ul className="grid gap-3 sm:grid-cols-2">
          {HOW_IT_WORKS.map(({ icon: Icon, title, text }) => (<li key={title} className="flex items-start gap-2.5">
              <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden/>
              <span className="flex flex-col gap-0.5">
                <span className="text-2xs font-medium text-foreground">{title}</span>
                <span className="text-3xs leading-relaxed text-pretty text-muted-foreground">{text}</span>
              </span>
            </li>))}
        </ul>
        <p className="flex items-center gap-1.5 text-3xs text-muted-foreground">
          <ClientIcon className="size-3" aria-hidden/>
          Qualquer linguagem da engine serve ao servidor, exceto as de shader. Detalhes em Ajuda ▸ API ▸ Rede (§18).
        </p>
      </Section>
    </EditorDialogShell>);
}
