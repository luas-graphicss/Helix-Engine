'use client';
import { ChevronDown, ChevronRight, Clock3 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import type { ActivityState, PhaseActivity, ScriptActivity } from '@/engine/scripting/debug/script-debugger';
import { cn } from '@/lib/utils';
import { PanelToolbar } from '@/engine/ui/panel-toolbar';
import { LanguageTag } from '../../ui/language-tag';
import { CountChip, DebugEmptyState, LocationLink, formatMs } from '../debug-shared';
import { useScriptDebugger } from '../use-script-debugger';
type SortKey = 'time' | 'name' | 'errors';
const STATE_LABEL: Record<ActivityState, string> = { active: 'ativo', inactive: 'inativo', faulted: 'com erro', destroyed: 'destruído' };
const STATE_TONE: Record<ActivityState, 'success' | 'neutral' | 'destructive' | 'warning'> = { active: 'success', inactive: 'neutral', faulted: 'destructive', destroyed: 'warning' };
const STATE_ORDER: Record<ActivityState, number> = { faulted: 0, active: 1, inactive: 2, destroyed: 3 };
const HEAVY_MS = 4;
function sortActivity(items: readonly ScriptActivity[], sort: SortKey): ScriptActivity[] {
    const list = items.slice();
    switch (sort) {
        case 'name':
            return list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR') || (a.actor ?? '').localeCompare(b.actor ?? '', 'pt-BR'));
        case 'errors':
            return list.sort((a, b) => b.errors - a.errors || b.smoothedMs - a.smoothedMs);
        default:
            return list.sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || b.smoothedMs - a.smoothedMs || a.name.localeCompare(b.name, 'pt-BR'));
    }
}
function timeTone(ms: number): string {
    if (ms >= HEAVY_MS)
        return 'text-destructive';
    if (ms >= HEAVY_MS / 2)
        return 'text-warning';
    return 'text-foreground';
}
function PhaseRow({ name, phase }: {
    name: string;
    phase: PhaseActivity;
}) {
    const average = phase.calls > 0 ? phase.totalMs / phase.calls : 0;
    return (<li className="grid h-row grid-cols-[minmax(0,1fr)_5rem_5rem_5rem_4rem_3rem] items-center gap-2 px-2 pl-9 text-3xs text-muted-foreground hover:bg-surface-hover">
      <span className="truncate font-mono text-foreground/80">{name}</span>
      <span className="text-right font-mono tabular-nums" title="Tempo da última chamada">
        {formatMs(phase.lastMs)}
      </span>
      <span className="text-right font-mono tabular-nums" title="Média por chamada">
        {formatMs(average)}
      </span>
      <span className={cn('text-right font-mono tabular-nums', phase.maxMs >= HEAVY_MS && 'text-warning')} title="Pior chamada">
        {formatMs(phase.maxMs)}
      </span>
      <span className="text-right font-mono tabular-nums" title="Chamadas">
        {phase.calls.toLocaleString('pt-BR')}
      </span>
      <span className={cn('text-right font-mono tabular-nums', phase.errors > 0 && 'text-destructive')} title="Erros">
        {phase.errors}
      </span>
    </li>);
}
function ActivityRow({ item, session, expanded, onToggle }: {
    item: ScriptActivity;
    session: EditorSession;
    expanded: boolean;
    onToggle: () => void;
}) {
    const Chevron = expanded ? ChevronDown : ChevronRight;
    const calls = Array.from(item.phases.values()).reduce((sum, phase) => sum + phase.calls, 0);
    const phases = Array.from(item.phases.entries()).sort((a, b) => b[1].totalMs - a[1].totalMs);
    return (<>
      <li className={cn('grid h-row grid-cols-[1rem_minmax(0,1fr)_auto_5rem_4rem_3rem] items-center gap-2 px-2 text-2xs hover:bg-surface-hover', item.state === 'destroyed' && 'opacity-60')}>
        <button type="button" onClick={onToggle} aria-expanded={expanded} aria-label={expanded ? 'Recolher fases' : 'Mostrar fases'} className="flex size-4 items-center justify-center rounded-xs text-muted-foreground hover:text-foreground" disabled={item.phases.size === 0}>
          {item.phases.size > 0 && <Chevron className="size-3" aria-hidden/>}
        </button>
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 truncate font-medium text-foreground">{item.name}</span>
          {item.role === 'entry' ? <CountChip title="Script de entrada do jogo">entrada</CountChip> : item.actor ? <span className="min-w-0 truncate text-muted-foreground">em {item.actor}</span> : null}
          <LanguageTag language={item.language}/>
          <LocationLink session={session} assetId={item.assetId} file={item.file} line={0} className="hidden md:inline"/>
        </span>
        <CountChip tone={STATE_TONE[item.state]} title={item.lastError ?? undefined}>
          {STATE_LABEL[item.state]}
        </CountChip>
        <span className={cn('text-right font-mono tabular-nums', timeTone(item.smoothedMs))} title={`Média móvel por frame · último frame: ${formatMs(item.frameMs)}`}>
          {formatMs(item.smoothedMs)}
        </span>
        <span className="text-right font-mono text-muted-foreground tabular-nums" title="Chamadas de hooks e callbacks">
          {calls.toLocaleString('pt-BR')}
        </span>
        <span className={cn('text-right font-mono tabular-nums', item.errors > 0 ? 'text-destructive' : 'text-muted-foreground')} title={item.lastError ?? 'Sem erros'}>
          {item.errors}
        </span>
      </li>
      {expanded && (<ul aria-label={`Fases de ${item.name}`} className="border-b border-border/60">
          <li className="grid h-5 grid-cols-[minmax(0,1fr)_5rem_5rem_5rem_4rem_3rem] items-center gap-2 px-2 pl-9 font-mono text-3xs tracking-wider text-muted-foreground/70 uppercase">
            <span>fase</span>
            <span className="text-right">última</span>
            <span className="text-right">média</span>
            <span className="text-right">pior</span>
            <span className="text-right">chamadas</span>
            <span className="text-right">erros</span>
          </li>
          {phases.map(([name, phase]) => (<PhaseRow key={name} name={name} phase={phase}/>))}
          {item.lastError && <li className="truncate px-2 py-1 pl-9 font-mono text-3xs text-destructive" title={item.lastError}>{item.lastError}</li>}
        </ul>)}
    </>);
}
function SortButton({ value, current, onSelect, children }: {
    value: SortKey;
    current: SortKey;
    onSelect: (value: SortKey) => void;
    children: string;
}) {
    const active = value === current;
    return (<button type="button" aria-pressed={active} onClick={() => onSelect(value)} className={cn('h-5 rounded-xs px-1.5 font-mono text-3xs transition-colors', active ? 'bg-surface-raised text-foreground ring-1 ring-border ring-inset' : 'text-muted-foreground hover:text-foreground')}>
      {children}
    </button>);
}
export function ActivityPanel() {
    const session = useSessionTopic('playtest');
    const scriptDebugger = useScriptDebugger();
    const [sort, setSort] = useState<SortKey>('time');
    const [expanded, setExpanded] = useState<ReadonlySet<number>>(() => new Set());
    const items = useMemo(() => sortActivity(scriptDebugger.activity, sort), [scriptDebugger.activity, sort]);
    const totals = useMemo(() => {
        let active = 0;
        let faulted = 0;
        let ms = 0;
        for (const item of scriptDebugger.activity) {
            if (item.state === 'active')
                active++;
            if (item.state === 'faulted')
                faulted++;
            if (item.state !== 'destroyed')
                ms += item.smoothedMs;
        }
        return { active, faulted, ms };
    }, [scriptDebugger.activity]);
    const toggle = (key: number) => setExpanded((current) => {
        const next = new Set(current);
        if (next.has(key))
            next.delete(key);
        else
            next.add(key);
        return next;
    });
    const { running } = session.scripts;
    return (<div className="flex h-full min-h-0 flex-col">
      <PanelToolbar>
        <span className="flex items-center gap-1.5 font-mono text-3xs text-muted-foreground">
          <Clock3 className="size-3" aria-hidden/>
          <span className={cn('tabular-nums', timeTone(totals.ms))} title="Tempo de script somado por frame (média móvel)">
            {formatMs(totals.ms)}/frame
          </span>
        </span>
        <CountChip tone="success" title="Instâncias ativas">
          {totals.active} ativos
        </CountChip>
        {totals.faulted > 0 && (<CountChip tone="destructive" title="Instâncias com erro">
            {totals.faulted} com erro
          </CountChip>)}
        <span className="ml-auto flex items-center gap-0.5" role="group" aria-label="Ordenar por">
          <SortButton value="time" current={sort} onSelect={setSort}>
            tempo
          </SortButton>
          <SortButton value="name" current={sort} onSelect={setSort}>
            nome
          </SortButton>
          <SortButton value="errors" current={sort} onSelect={setSort}>
            erros
          </SortButton>
        </span>
      </PanelToolbar>
      {items.length === 0 ? (<DebugEmptyState title={running ? 'Nenhum script instanciado ainda.' : 'O jogo não está rodando.'}>
          {running
                ? 'As instâncias aparecem assim que o script de entrada e os atores com script começarem.'
                : 'Dê Play para ver cada instância de script com o tempo que gasta por frame, as chamadas de cada hook e os erros. A lista fica visível depois que o jogo para, até a próxima execução.'}
        </DebugEmptyState>) : (<div className="min-h-0 flex-1 overflow-auto">
          <div className="grid h-5 grid-cols-[1rem_minmax(0,1fr)_auto_5rem_4rem_3rem] items-center gap-2 border-b border-border px-2 font-mono text-3xs tracking-wider text-muted-foreground uppercase">
            <span />
            <span>script</span>
            <span>estado</span>
            <span className="text-right">ms/frame</span>
            <span className="text-right">chamadas</span>
            <span className="text-right">erros</span>
          </div>
          <ul aria-label="Instâncias de script">
            {items.map((item) => (<ActivityRow key={item.key} item={item} session={session} expanded={expanded.has(item.key)} onToggle={() => toggle(item.key)}/>))}
          </ul>
        </div>)}
    </div>);
}
