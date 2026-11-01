'use client';
import { CircleAlert, Layers, OctagonPause } from 'lucide-react';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import type { DebugFrame, PausedState } from '@/engine/scripting/debug/script-debugger';
import type { MappedFrame } from '@/engine/scripting/runtime/stack-mapper';
import { LanguageTag } from '../../ui/language-tag';
import { CountChip, DebugEmptyState, DebugSectionTitle, LocationLink } from '../debug-shared';
import { useScriptDebugger } from '../use-script-debugger';
function ScriptFrameRow({ frame, session, innermost }: {
    frame: MappedFrame;
    session: EditorSession;
    innermost: boolean;
}) {
    return (<li className="flex h-row items-center gap-2 px-2 text-2xs hover:bg-surface-hover">
      <span className={innermost ? 'size-1.5 shrink-0 rounded-full bg-warning' : 'size-1.5 shrink-0 rounded-full bg-border'} aria-hidden/>
      <span className="min-w-0 flex-1 truncate font-mono text-foreground">{frame.functionName ?? '(nível do módulo)'}</span>
      <LocationLink session={session} assetId={frame.assetId} file={frame.file} line={frame.line} column={frame.column}/>
    </li>);
}
function EngineFrameRow({ frame, session }: {
    frame: DebugFrame;
    session: EditorSession;
}) {
    return (<li className="flex h-row items-center gap-2 px-2 text-2xs hover:bg-surface-hover">
      <span className="shrink-0 rounded-xs bg-surface-raised px-1 font-mono text-3xs text-muted-foreground ring-1 ring-border ring-inset">{frame.kind === 'hook' ? 'hook' : 'callback'}</span>
      <span className="min-w-0 truncate font-mono text-foreground">{frame.label}</span>
      {frame.script && <span className="min-w-0 truncate text-muted-foreground">{frame.script}</span>}
      {frame.actor && <span className="min-w-0 truncate text-muted-foreground/80">em {frame.actor}</span>}
      {frame.language && <LanguageTag language={frame.language}/>}
      {frame.file && <LocationLink session={session} assetId={frame.assetId} file={frame.file} line={0} className="ml-auto"/>}
    </li>);
}
function PauseSummary({ state, session, live }: {
    state: PausedState;
    session: EditorSession;
    live: boolean;
}) {
    const Icon = state.reason === 'error' ? CircleAlert : OctagonPause;
    const title = live ? (state.reason === 'error' ? 'Pausado por um erro' : 'Pausado num ponto de interrupção') : state.reason === 'error' ? 'Último erro registrado' : 'Último acerto de ponto';
    return (<div className={live ? 'flex flex-col gap-1 border-b border-border bg-warning/10 px-2 py-1.5' : 'flex flex-col gap-1 border-b border-border px-2 py-1.5'}>
      <div className="flex items-center gap-1.5 text-2xs">
        <Icon className={state.reason === 'error' ? 'size-3.5 shrink-0 text-destructive' : 'size-3.5 shrink-0 text-warning'} aria-hidden/>
        <span className="font-medium text-foreground">{title}</span>
        <span className="text-muted-foreground">·</span>
        <span className="min-w-0 truncate text-foreground/90">{state.script}</span>
        {state.actor && <span className="min-w-0 truncate text-muted-foreground">em {state.actor}</span>}
        {state.phase && <span className="shrink-0 font-mono text-muted-foreground">{state.phase}</span>}
        <LocationLink session={session} assetId={state.assetId} file={state.file} line={state.line} column={state.column} className="ml-auto"/>
      </div>
      <div className="flex items-center gap-2 font-mono text-3xs text-muted-foreground">
        {state.language && <LanguageTag language={state.language}/>}
        <span>frame {state.gameFrame.toLocaleString('pt-BR')}</span>
        <span>t = {state.gameTime.toFixed(2)} s</span>
        {state.message && <span className="min-w-0 truncate text-destructive">{state.message}</span>}
      </div>
    </div>);
}
function FrameLists({ state, session }: {
    state: PausedState;
    session: EditorSession;
}) {
    return (<>
      <DebugSectionTitle trailing={<CountChip>{state.frames.length}</CountChip>}>Quadros do script</DebugSectionTitle>
      {state.frames.length === 0 ? (<p className="px-2 py-1.5 text-3xs text-muted-foreground">
          {state.language && state.language !== 'javascript' && state.language !== 'typescript'
                ? 'Esta linguagem não expõe os quadros internos; a posição acima é a linha em execução no momento do acerto.'
                : 'Nenhum quadro do script neste acerto.'}
        </p>) : (<ul aria-label="Quadros do script">
          {state.frames.map((frame, index) => (<ScriptFrameRow key={`${frame.file}:${frame.line}:${index}`} frame={frame} session={session} innermost={index === 0}/>))}
        </ul>)}
      <DebugSectionTitle trailing={<CountChip>{state.engineFrames.length}</CountChip>}>Engine</DebugSectionTitle>
      <ul aria-label="Quadros da engine">
        {state.engineFrames.map((frame, index) => (<EngineFrameRow key={`${frame.label}:${frame.startedAt}:${index}`} frame={frame} session={session}/>))}
      </ul>
    </>);
}
export function CallStackPanel() {
    const session = useSessionTopic('playtest');
    const scriptDebugger = useScriptDebugger();
    const { paused, lastHit, liveFrames } = scriptDebugger;
    const { running } = session.scripts;
    if (paused) {
        return (<div className="flex h-full min-h-0 flex-col overflow-auto">
        <PauseSummary state={paused} session={session} live/>
        <FrameLists state={paused} session={session}/>
      </div>);
    }
    if (running) {
        const frames = liveFrames;
        return (<div className="flex h-full min-h-0 flex-col overflow-auto">
        <DebugSectionTitle trailing={<CountChip tone="success">ao vivo</CountChip>}>Em execução agora</DebugSectionTitle>
        {frames.length === 0 ? (<p className="px-2 py-1.5 text-3xs text-muted-foreground">Nenhum hook rodando neste instante: entre frames os scripts ficam parados. Marque um ponto de interrupção para parar dentro de um hook e ver a pilha completa.</p>) : (<ul aria-label="Quadros em execução">
            {frames.map((frame, index) => (<EngineFrameRow key={`${frame.label}:${frame.startedAt}:${index}`} frame={frame} session={session}/>))}
          </ul>)}
        {lastHit && (<>
            <PauseSummary state={lastHit} session={session} live={false}/>
            <FrameLists state={lastHit} session={session}/>
          </>)}
      </div>);
    }
    if (lastHit) {
        return (<div className="flex h-full min-h-0 flex-col overflow-auto">
        <PauseSummary state={lastHit} session={session} live={false}/>
        <FrameLists state={lastHit} session={session}/>
      </div>);
    }
    return (<DebugEmptyState title="Nenhuma execução para mostrar.">
      <Layers className="mx-auto mb-1 size-4 text-muted-foreground/60" aria-hidden/>
      Dê Play no jogo ou execute o script ativo. A pilha aparece quando um ponto de interrupção acerta ou um erro pausa o jogo; durante a execução, este painel mostra o hook em andamento.
    </DebugEmptyState>);
}
