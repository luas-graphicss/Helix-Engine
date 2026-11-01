'use client';
import { useState, type KeyboardEvent } from 'react';
import { CircleDot, CircleOff, Diamond, Pencil, Trash2 } from 'lucide-react';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import type { Breakpoint, BreakpointStatus, ScriptDebugger } from '@/engine/scripting/debug/script-debugger';
import { debugFileName } from '@/engine/scripting/debug/script-debugger';
import { CheckBox } from '@/engine/ui/check-box';
import { FieldInput } from '@/engine/ui/field-input';
import { IconButton } from '@/engine/ui/icon-button';
import { PanelToolbar } from '@/engine/ui/panel-toolbar';
import { cn } from '@/lib/utils';
import { CountChip, DebugEmptyState, LocationLink } from '../debug-shared';
import { useScriptDebugger } from '../use-script-debugger';
function fileOf(session: EditorSession, breakpoint: Breakpoint): string {
    const asset = session.library.get(breakpoint.assetId);
    if (asset?.kind === 'script' && asset.details.kind === 'script')
        return debugFileName(asset.name, asset.details.language);
    return asset?.name ?? 'script removido';
}
function bindingLabel(status: BreakpointStatus): {
    text: string;
    tone: 'neutral' | 'warning' | 'success';
    title: string;
} {
    switch (status.binding) {
        case 'line':
            return status.verified ? { text: 'linha', tone: 'success', title: 'Acerta ao executar esta linha (sonda por linha do código compilado).' } : { text: 'linha sem instrução', tone: 'warning', title: 'Esta linha não gera instrução: mova o ponto para uma linha com código.' };
        case 'hook':
            return status.hook ? { text: status.hook, tone: 'success', title: `Acerta quando o hook ${status.hook} começa a rodar (linguagens sem sonda por linha ligam o ponto ao hook que contém a linha).` } : { text: 'fora de um hook', tone: 'warning', title: 'A linha não está dentro de um hook reconhecido (onStart, onUpdate…); o ponto não tem como acertar.' };
        default:
            return { text: 'aguardando compilação', tone: 'neutral', title: 'O script ainda não compilou nesta sessão: execute-o ou dê Play para o depurador saber como ligar o ponto.' };
    }
}
function BreakpointEditor({ breakpoint, scriptDebugger, onDone }: {
    breakpoint: Breakpoint;
    scriptDebugger: ScriptDebugger;
    onDone: () => void;
}) {
    const [condition, setCondition] = useState(breakpoint.condition ?? '');
    const [logMessage, setLogMessage] = useState(breakpoint.logMessage ?? '');
    const commit = () => {
        scriptDebugger.update(breakpoint.id, { condition, logMessage });
        onDone();
    };
    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.nativeEvent.isComposing || event.keyCode === 229)
            return;
        if (event.key === 'Enter')
            commit();
        else if (event.key === 'Escape')
            onDone();
    };
    return (<div className="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1 border-t border-border/60 bg-surface-sunken/40 px-2 py-1.5 pl-9">
      <label htmlFor={`bp-condition-${breakpoint.id}`} className="font-mono text-3xs text-muted-foreground">
        condição
      </label>
      <FieldInput id={`bp-condition-${breakpoint.id}`} value={condition} placeholder="expressão JavaScript, ex.: hp < 10 (vazio = sempre)" autoFocus spellCheck={false} onChange={(event) => setCondition(event.target.value)} onKeyDown={onKeyDown} onBlur={commit}/>
      <label htmlFor={`bp-log-${breakpoint.id}`} className="font-mono text-3xs text-muted-foreground">
        registrar
      </label>
      <FieldInput id={`bp-log-${breakpoint.id}`} value={logMessage} placeholder="mensagem para a Saída em vez de pausar, ex.: vida = {hp}" spellCheck={false} onChange={(event) => setLogMessage(event.target.value)} onKeyDown={onKeyDown} onBlur={commit}/>
    </div>);
}
function BreakpointRow({ status, session, scriptDebugger }: {
    status: BreakpointStatus;
    session: EditorSession;
    scriptDebugger: ScriptDebugger;
}) {
    const [editing, setEditing] = useState(false);
    const { breakpoint } = status;
    const file = fileOf(session, breakpoint);
    const binding = bindingLabel(status);
    const logpoint = breakpoint.logMessage !== null;
    const Glyph = !breakpoint.enabled ? CircleOff : logpoint ? Diamond : CircleDot;
    const glyphTone = !breakpoint.enabled ? 'text-muted-foreground/60' : logpoint ? 'text-primary' : status.verified ? 'text-destructive' : 'text-warning';
    return (<li className="border-b border-border/60 last:border-b-0">
      <div className={cn('flex min-h-row items-center gap-2 px-2 text-2xs hover:bg-highlight', !breakpoint.enabled && 'opacity-70')}>
        <CheckBox checked={breakpoint.enabled} label={breakpoint.enabled ? 'Desligar este ponto' : 'Ligar este ponto'} onChange={(enabled) => scriptDebugger.update(breakpoint.id, { enabled })}/>
        <Glyph className={cn('size-3.5 shrink-0', glyphTone)} aria-hidden/>
        <LocationLink session={session} assetId={breakpoint.assetId} file={file} line={breakpoint.line} className="text-foreground"/>
        <CountChip tone={binding.tone} title={binding.title}>
          {binding.text}
        </CountChip>
        {breakpoint.condition && (<span className="min-w-0 truncate font-mono text-3xs text-muted-foreground" title={`Só pausa quando: ${breakpoint.condition}`}>
            se {breakpoint.condition}
          </span>)}
        {breakpoint.logMessage && (<span className="min-w-0 truncate font-mono text-3xs text-muted-foreground" title={`Escreve na Saída em vez de pausar: ${breakpoint.logMessage}`}>
            registra “{breakpoint.logMessage}”
          </span>)}
        <span className="ml-auto flex shrink-0 items-center gap-1">
          {status.hits > 0 && <CountChip title={`${status.hits} ${status.hits === 1 ? 'acerto' : 'acertos'} nesta execução`}>×{status.hits}</CountChip>}
          <IconButton label={editing ? 'Fechar a edição' : 'Condição e mensagem de registro…'} size="xs" active={editing} onClick={() => setEditing((value) => !value)}>
            <Pencil />
          </IconButton>
          <IconButton label="Remover este ponto" size="xs" className="hover:text-destructive" onClick={() => scriptDebugger.remove(breakpoint.id)}>
            <Trash2 />
          </IconButton>
        </span>
      </div>
      {editing && <BreakpointEditor breakpoint={breakpoint} scriptDebugger={scriptDebugger} onDone={() => setEditing(false)}/>}
    </li>);
}
export function BreakpointsPanel() {
    const session = useEditorSession();
    const scriptDebugger = useScriptDebugger();
    const statuses = scriptDebugger.statuses();
    const total = statuses.length;
    const enabled = statuses.filter((status) => status.breakpoint.enabled).length;
    const allEnabled = total > 0 && enabled === total;
    return (<div className="flex h-full flex-col">
      <PanelToolbar className="gap-3 px-2">
        <label className="flex items-center gap-1.5 text-2xs text-muted-foreground" title="Interruptor geral: desligado, nenhum ponto acerta (eles ficam na lista, apagados).">
          <CheckBox checked={scriptDebugger.breakpointsEnabled} label="Ativar pontos de interrupção" onChange={(value) => scriptDebugger.setBreakpointsEnabled(value)}/>
          pontos ativos
        </label>
        <label className="flex items-center gap-1.5 text-2xs text-muted-foreground" title="Com o jogo rodando, um erro não tratado num script pausa o playtest na linha dele.">
          <CheckBox checked={scriptDebugger.pauseOnError} label="Pausar em erros" onChange={(value) => scriptDebugger.setPauseOnError(value)}/>
          pausar em erros
        </label>
        <span className="ml-auto flex items-center gap-1">
          <span className="font-mono text-3xs text-muted-foreground tabular-nums">
            {total === 0 ? 'nenhum ponto' : `${enabled}/${total} ${total === 1 ? 'ligado' : 'ligados'}`}
          </span>
          <IconButton label={allEnabled ? 'Desligar todos os pontos' : 'Ligar todos os pontos'} size="sm" disabled={total === 0} onClick={() => scriptDebugger.setAllEnabled(!allEnabled)}>
            {allEnabled ? <CircleOff /> : <CircleDot />}
          </IconButton>
          <IconButton label="Remover todos os pontos" size="sm" disabled={total === 0} className="hover:text-destructive" onClick={() => scriptDebugger.removeAll()}>
            <Trash2 />
          </IconButton>
        </span>
      </PanelToolbar>
      {total === 0 ? (<DebugEmptyState title="Nenhum ponto de interrupção.">
          Clique na calha à esquerda dos números de linha para marcar uma linha. Em JS, TS, C#, GDScript, Java, Kotlin, Dart e Haxe o jogo pausa ao chegar à linha; em Luau, Lua, Python, Ruby, PHP e nas linguagens compiladas para WebAssembly o ponto pausa quando o hook que contém a linha (onStart, onUpdate…) começa a rodar.
        </DebugEmptyState>) : (<ul className="min-h-0 flex-1 overflow-auto" aria-label="Pontos de interrupção">
          {statuses.map((status) => (<BreakpointRow key={status.breakpoint.id} status={status} session={session} scriptDebugger={scriptDebugger}/>))}
        </ul>)}
    </div>);
}
