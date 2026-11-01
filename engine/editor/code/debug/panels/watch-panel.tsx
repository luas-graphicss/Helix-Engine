'use client';
import { Eye, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { type KeyboardEvent, useState } from 'react';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import type { ScriptDebugger, Variable, WatchValue } from '@/engine/scripting/debug/script-debugger';
import { IconButton } from '@/engine/ui/icon-button';
import { PanelToolbar } from '@/engine/ui/panel-toolbar';
import { CountChip, DebugEmptyState, DebugSectionTitle, ValueText } from '../debug-shared';
import { useScriptDebugger } from '../use-script-debugger';
function isComposing(event: KeyboardEvent<HTMLInputElement>): boolean {
    return event.nativeEvent.isComposing || event.keyCode === 229;
}
const INPUT_CLASS = 'h-5 min-w-0 flex-1 rounded-xs border border-border bg-surface-sunken px-1.5 font-mono text-2xs text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary';
function WatchRow({ result, scriptDebugger }: {
    result: WatchValue;
    scriptDebugger: ScriptDebugger;
}) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(result.expression);
    const commit = () => {
        setEditing(false);
        const expression = draft.trim();
        if (!expression)
            scriptDebugger.removeWatch(result.id);
        else if (expression !== result.expression)
            scriptDebugger.updateWatch(result.id, expression);
    };
    return (<li className="group flex h-row items-center gap-2 px-2 text-2xs hover:bg-surface-hover">
      {editing ? (<input autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => {
                if (isComposing(event))
                    return;
                if (event.key === 'Enter')
                    commit();
                if (event.key === 'Escape') {
                    setDraft(result.expression);
                    setEditing(false);
                }
            }} aria-label="Editar expressão" className={INPUT_CLASS}/>) : (<button type="button" onDoubleClick={() => {
                setDraft(result.expression);
                setEditing(true);
            }} title="Clique duas vezes para editar a expressão" className="min-w-0 flex-1 truncate text-left font-mono text-code-variable">
          {result.expression}
        </button>)}
      <span className="shrink-0 text-muted-foreground">=</span>
      {result.error ? (<span className="min-w-0 flex-1 truncate font-mono text-destructive" title={result.error}>
          {result.error}
        </span>) : result.value ? (<ValueText value={result.value} className="flex-1"/>) : (<span className="min-w-0 flex-1 truncate font-mono text-muted-foreground/70 italic">sem contexto</span>)}
      <IconButton label="Remover expressão" size="sm" className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100" onClick={() => scriptDebugger.removeWatch(result.id)}>
        <X />
      </IconButton>
    </li>);
}
function VariableRow({ variable }: {
    variable: Variable;
}) {
    return (<li className="flex h-row items-center gap-2 px-2 text-2xs hover:bg-surface-hover">
      <span className="min-w-0 max-w-[40%] truncate font-mono text-code-variable">{variable.name}</span>
      <span className="shrink-0 text-muted-foreground">:</span>
      <ValueText value={variable.value} className="flex-1"/>
    </li>);
}
export function WatchPanel() {
    const session = useSessionTopic('playtest');
    const scriptDebugger = useScriptDebugger();
    const [draft, setDraft] = useState('');
    const results = scriptDebugger.watchResults;
    const variables = scriptDebugger.variables;
    const context = scriptDebugger.watchContext;
    const { paused } = scriptDebugger;
    const { running } = session.scripts;
    const submit = () => {
        const expression = draft.trim();
        if (!expression)
            return;
        if (scriptDebugger.addWatch(expression))
            setDraft('');
    };
    return (<div className="flex h-full min-h-0 flex-col">
      <PanelToolbar>
        <input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => {
            if (isComposing(event))
                return;
            if (event.key === 'Enter')
                submit();
        }} placeholder="Expressão a observar: helix.time.now, self.speed, entity.position…" aria-label="Nova expressão a observar" spellCheck={false} className={INPUT_CLASS}/>
        <IconButton label="Adicionar expressão" size="sm" disabled={!draft.trim()} onClick={submit}>
          <Plus />
        </IconButton>
        <span className="ml-1 flex shrink-0 items-center gap-1 font-mono text-3xs text-muted-foreground" title="Escopo em que as expressões são avaliadas">
          <Eye className="size-3" aria-hidden/>
          <span className="max-w-56 truncate">{context.label}</span>
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-0.5">
          <IconButton label="Reavaliar agora" size="sm" disabled={results.length === 0} onClick={() => scriptDebugger.refreshWatches()}>
            <RefreshCw />
          </IconButton>
          <IconButton label="Remover todas as expressões" size="sm" disabled={results.length === 0} className="hover:text-destructive" onClick={() => scriptDebugger.clearWatches()}>
            <Trash2 />
          </IconButton>
        </span>
      </PanelToolbar>
      <div className="min-h-0 flex-1 overflow-auto">
        {results.length === 0 ? (<DebugEmptyState title="Nenhuma expressão observada.">
            Digite uma expressão JavaScript e pressione Enter. Pausado num ponto, ela vê as variáveis locais do acerto; com o jogo rodando, vê o escopo do script ativo e é reavaliada a cada frame.
          </DebugEmptyState>) : (<ul aria-label="Expressões observadas">
            {results.map((result) => (<WatchRow key={result.id} result={result} scriptDebugger={scriptDebugger}/>))}
          </ul>)}
        <DebugSectionTitle trailing={<CountChip>{variables.length}</CountChip>}>{paused ? 'Variáveis locais no acerto' : running ? 'Escopo do script ativo' : 'Variáveis'}</DebugSectionTitle>
        {variables.length === 0 ? (<p className="px-2 py-1.5 text-3xs text-muted-foreground">
            {paused
                ? 'O acerto não capturou variáveis locais nesta linguagem.'
                : running
                    ? 'Nenhum script ativo com escopo exposto neste instante.'
                    : 'As variáveis aparecem quando um ponto de interrupção pausa o jogo.'}
          </p>) : (<ul aria-label="Variáveis">
            {variables.map((variable) => (<VariableRow key={variable.name} variable={variable}/>))}
          </ul>)}
      </div>
    </div>);
}
