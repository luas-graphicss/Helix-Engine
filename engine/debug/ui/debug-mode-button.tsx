'use client';
import { useEffect, useState } from 'react';
import { Bug, Check, CircleCheck, CircleX, Eraser, LoaderCircle, Play } from 'lucide-react';
import { LanguageTag } from '@/engine/editor/code/ui/language-tag';
import { EditorDialogShell } from '@/engine/editor/dialogs/editor-dialog-shell';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { SCRIPT_COMPILER_STATUS_LABEL, SCRIPT_LANGUAGES, scriptLanguage, type ScriptLanguage, type ScriptLanguageId } from '@/engine/scripting/script-languages';
import { IconButton } from '@/engine/ui/icon-button';
import { FOCUS_RING_CLASS, GHOST_ACTION_CLASS } from '@/engine/ui/surface-styles';
import { ToggleSwitch } from '@/engine/ui/toggle-field';
import { cn } from '@/lib/utils';
import { hasGame, isShaderLanguage, SHADER_LANGUAGES } from '../api-test-game/targets';
import { DEBUG_NAMES } from '../api-test-game/types';
import { debugModeOf, type DebugPhase } from '../debug-mode';
import { BatchSection } from './batch-section';
import { BenchmarkSection } from './benchmark-section';
import { DebugSection } from './debug-section';
const EXCLUDED: ReadonlySet<ScriptLanguageId> = new Set<ScriptLanguageId>(['json', 'yaml', 'xml', 'markdown', 'shell']);
const SHARED_ASSETS: ReadonlyArray<{
    language: ScriptLanguageId;
    file: string;
    role: string;
}> = [
    { language: 'html', file: DEBUG_NAMES.hud, role: 'HUD' },
    { language: 'css', file: DEBUG_NAMES.style, role: 'estilo da HUD' },
    { language: 'svg', file: DEBUG_NAMES.icon, role: 'ícone da HUD' },
    { language: 'toml', file: DEBUG_NAMES.config, role: 'configuração' },
];
const SHARED_IDS: ReadonlySet<ScriptLanguageId> = new Set(SHARED_ASSETS.map((asset) => asset.language));
type Availability = 'ready' | 'no-game' | 'no-compiler';
function availabilityOf(language: ScriptLanguage): Availability {
    if (language.compiler === 'pending')
        return 'no-compiler';
    return hasGame(language.id) ? 'ready' : 'no-game';
}
const AVAILABILITY_NOTE: Record<Availability, string | null> = {
    ready: null,
    'no-game': 'jogo de teste ainda não escrito',
    'no-compiler': SCRIPT_COMPILER_STATUS_LABEL.pending.toLowerCase(),
};
const BUSY_PHASES: ReadonlySet<DebugPhase> = new Set<DebugPhase>(['clearing', 'writing', 'compiling']);
function PhaseIcon({ phase }: {
    phase: DebugPhase;
}) {
    if (BUSY_PHASES.has(phase))
        return <LoaderCircle className="size-3.5 shrink-0 animate-spin text-primary" aria-hidden/>;
    if (phase === 'ready')
        return <CircleCheck className="size-3.5 shrink-0 text-primary" aria-hidden/>;
    if (phase === 'failed')
        return <CircleX className="size-3.5 shrink-0 text-destructive" aria-hidden/>;
    return <Bug className="size-3.5 shrink-0 text-muted-foreground" aria-hidden/>;
}
interface LanguageButtonProps {
    language: ScriptLanguage;
    availability: Availability;
    current: boolean;
    disabled: boolean;
    onPick(): void;
}
function LanguageButton({ language, availability, current, disabled, onPick }: LanguageButtonProps) {
    const note = AVAILABILITY_NOTE[availability];
    return (<button type="button" onClick={onPick} disabled={disabled || availability !== 'ready'} aria-pressed={current} title={note ? `${language.label}: ${note}` : `Instalar o jogo de teste em ${language.label}`} className={cn('flex h-9 items-center gap-2 px-2.5 text-left', GHOST_ACTION_CLASS, FOCUS_RING_CLASS, 'disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-border', current && 'border-primary/70 bg-primary/10')}>
      <LanguageTag language={language.id} size="sm" silent className="w-12 justify-center"/>
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate text-2xs font-medium text-foreground">{language.label}</span>
        {note && <span className="truncate font-mono text-[9px] text-muted-foreground">{note}</span>}
      </span>
      <Check className={cn('size-3.5 shrink-0 text-primary', !current && 'invisible')} aria-hidden/>
    </button>);
}
function DebugModeDialog({ open, onOpenChange }: {
    open: boolean;
    onOpenChange(open: boolean): void;
}) {
    const session = useSessionTopic('scene', 'assets', 'playtest');
    const debug = debugModeOf(session);
    const busy = debug.isBusy;
    const games = SCRIPT_LANGUAGES.filter((language) => !EXCLUDED.has(language.id) && !isShaderLanguage(language.id) && !SHARED_IDS.has(language.id));
    const scripts = session.library.byKind('script').length;
    const canPlay = debug.phase === 'ready' && !session.playtest.isRunning && debug.language !== null;
    const play = () => {
        void debug.playInstalled();
        onOpenChange(false);
    };
    return (<EditorDialogShell open={open} onOpenChange={onOpenChange} title="Modo debug · jogo de teste da API" description="Temporário. Cada linguagem apaga todos os scripts do projeto e instala um jogo que percorre a API inteira, registrando FALHOU e ERRO no console. Testar todas percorre as linguagens em sequência e entrega os avisos e erros prontos para copiar." size="lg" dismissible={!busy} toolbar={<div role="status" aria-live="polite" className="flex min-w-0 flex-1 items-center gap-2 rounded-sm border border-border bg-surface-sunken/60 px-2.5 py-1.5 shadow-well">
          <PhaseIcon phase={debug.phase}/>
          <span className="min-w-0 flex-1 text-2xs leading-snug text-pretty text-foreground">{debug.message}</span>
          {canPlay && (<button type="button" onClick={play} className={cn('flex h-6 shrink-0 items-center gap-1 rounded-sm px-2 text-2xs font-medium text-primary', GHOST_ACTION_CLASS)}>
              <Play className="size-3" aria-hidden/>
              Iniciar playtest
            </button>)}
        </div>} footer={<>
          <label className="flex cursor-pointer items-center gap-2 text-2xs text-foreground" title="Ao terminar de compilar sem erros, o playtest começa sozinho.">
            Iniciar o playtest ao compilar
            <ToggleSwitch label="Iniciar o playtest ao compilar" on={debug.autoPlay} onToggle={() => debug.setAutoPlay(!debug.autoPlay)}/>
          </label>
          <button type="button" onClick={() => debug.clear()} disabled={busy} className={cn('flex h-6 items-center gap-1.5 px-2 text-2xs text-foreground disabled:opacity-45', GHOST_ACTION_CLASS)} title="Remove os ativos com prefixo Debug e o grupo Debug da hierarquia.">
            <Eraser className="size-3" aria-hidden/>
            Limpar o debug
          </button>
          <span className="ml-auto font-mono text-3xs text-muted-foreground">
            {debug.language ? `Jogo em ${scriptLanguage(debug.language).label}` : 'Nenhum jogo instalado'} · shaders em {scriptLanguage(debug.shaderLanguage).label} · {scripts} {scripts === 1 ? 'script' : 'scripts'} no projeto
          </span>
        </>}>
      <BatchSection debug={debug}/>
      <BenchmarkSection debug={debug}/>
      <DebugSection title="Jogos de teste" description="Um clique: limpa os scripts, escreve o jogo na linguagem, marca o script de entrada, pendura o script de ator na Caixa giratória e compila.">
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {games.map((language) => (<LanguageButton key={language.id} language={language} availability={availabilityOf(language)} current={debug.language === language.id} disabled={busy} onPick={() => void debug.installGame(language.id)}/>))}
        </div>
      </DebugSection>
      <DebugSection title="Shaders" description={`Trocam só ${DEBUG_NAMES.post} (pós-processamento) e ${DEBUG_NAMES.surface} (superfície) pela versão na linguagem; o jogo de teste os liga pelo nome.`}>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {SHADER_LANGUAGES.map((id) => {
            const language = scriptLanguage(id);
            return <LanguageButton key={id} language={language} availability="ready" current={debug.shaderLanguage === id} disabled={busy} onPick={() => void debug.installShaders(id)}/>;
        })}
        </div>
      </DebugSection>
      <DebugSection title="Em todo jogo de teste" description="Recursos que a HUD e a configuração usam em qualquer linguagem; entram junto com o jogo e são lidos pela API (gui.html, gui.css, gui.svg, assets.data).">
        <ul className="flex flex-wrap gap-1.5">
          {SHARED_ASSETS.map((asset) => (<li key={asset.language} className="flex h-7 items-center gap-1.5 rounded-sm border border-border bg-surface-sunken/40 px-2">
              <LanguageTag language={asset.language} size="xs" silent/>
              <span className="font-mono text-3xs text-foreground">{asset.file}</span>
              <span className="text-3xs text-muted-foreground">· {asset.role}</span>
            </li>))}
        </ul>
      </DebugSection>
    </EditorDialogShell>);
}
export function DebugModeButton() {
    const session = useSessionTopic('scene', 'assets', 'playtest');
    const debug = debugModeOf(session);
    const [open, setOpen] = useState(false);
    useEffect(() => {
        void debug.batch.resumePending();
    }, [debug]);
    return (<>
      <IconButton label="Modo debug: jogo de teste da API em cada linguagem" active={open || debug.language !== null} onClick={() => setOpen(true)}>
        <Bug />
      </IconButton>
      <DebugModeDialog open={open} onOpenChange={setOpen}/>
    </>);
}
