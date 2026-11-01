'use client';
import { useEffect, useRef, useState, type UIEvent } from 'react';
import { ArrowDownToLine, Bug, Check, CircleAlert, ClipboardCopy, Info, Trash2, TriangleAlert, type LucideIcon } from 'lucide-react';
import { LogRow } from '@/engine/editor/panels/console-panel';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import type { LogEntry, LogLevel } from '@/engine/editor/session/editor-log';
import { formatLogEntries } from '@/engine/editor/session/log-text';
import { copyTextToClipboard } from '@/engine/ui/clipboard';
import { IconButton } from '@/engine/ui/icon-button';
import { PanelToolbar } from '@/engine/ui/panel-toolbar';
import { FOCUS_RING_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
import { DebugEmptyState, SCRIPT_LOG_SOURCES } from '../debug-shared';
const LEVELS: readonly LogLevel[] = ['debug', 'info', 'warn', 'error'];
const LEVEL_META: Record<LogLevel, {
    icon: LucideIcon;
    tone: string;
    label: string;
}> = {
    debug: { icon: Bug, tone: 'text-muted-foreground/70', label: 'Depuração' },
    info: { icon: Info, tone: 'text-muted-foreground', label: 'Mensagens' },
    warn: { icon: TriangleAlert, tone: 'text-warning', label: 'Avisos' },
    error: { icon: CircleAlert, tone: 'text-destructive', label: 'Erros' },
};
const COPIED_FEEDBACK_MS = 1500;
const FOLLOW_THRESHOLD_PX = 12;
function LevelToggle({ level, count, active, onToggle }: {
    level: LogLevel;
    count: number;
    active: boolean;
    onToggle: () => void;
}) {
    const meta = LEVEL_META[level];
    const Icon = meta.icon;
    return (<button type="button" aria-pressed={active} title={`${meta.label}: ${active ? 'clique para esconder' : 'clique para mostrar'}`} onClick={onToggle} className={cn('flex h-5 items-center gap-1 rounded-xs px-1 font-mono text-3xs tabular-nums transition-colors hover:bg-highlight', FOCUS_RING_CLASS, active ? meta.tone : 'text-muted-foreground/40 line-through')}>
      <Icon className="size-3" aria-hidden/>
      {count}
    </button>);
}
export function OutputPanel() {
    const session = useSessionTopic('log', 'assets');
    const { log } = session;
    const listRef = useRef<HTMLDivElement>(null);
    const [hidden, setHidden] = useState<ReadonlySet<LogLevel>>(() => new Set());
    const [onlyScripts, setOnlyScripts] = useState(true);
    const [clearedBefore, setClearedBefore] = useState(0);
    const [follow, setFollow] = useState(true);
    const [copied, setCopied] = useState(false);
    const scriptNames = new Set<string>();
    for (const asset of session.library.all)
        if (asset.kind === 'script')
            scriptNames.add(asset.name);
    const fromScripts = (entry: LogEntry): boolean => SCRIPT_LOG_SOURCES.has(entry.source) || scriptNames.has(entry.source);
    const visible = log.entries.filter((entry) => entry.id > clearedBefore && (!onlyScripts || fromScripts(entry)));
    const counts: Record<LogLevel, number> = { debug: 0, info: 0, warn: 0, error: 0 };
    for (const entry of visible)
        counts[entry.level] += entry.repeat;
    const entries = visible.filter((entry) => !hidden.has(entry.level));
    const last = entries.at(-1);
    const tailKey = last ? `${last.id}:${last.repeat}` : '';
    useEffect(() => {
        const list = listRef.current;
        if (list && follow)
            list.scrollTop = list.scrollHeight;
    }, [tailKey, follow]);
    useEffect(() => {
        if (!copied)
            return;
        const timer = window.setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
        return () => window.clearTimeout(timer);
    }, [copied]);
    const onScroll = (event: UIEvent<HTMLDivElement>) => {
        const list = event.currentTarget;
        setFollow(list.scrollTop + list.clientHeight >= list.scrollHeight - FOLLOW_THRESHOLD_PX);
    };
    const toggleLevel = (level: LogLevel) => {
        setHidden((current) => {
            const next = new Set(current);
            if (next.has(level))
                next.delete(level);
            else
                next.add(level);
            return next;
        });
    };
    const copy = async () => {
        const ok = await copyTextToClipboard(formatLogEntries(entries));
        if (ok)
            setCopied(true);
        else
            log.warn('Saída', 'O navegador não permitiu copiar; selecione o texto e use Ctrl+C.');
    };
    return (<div className="flex h-full flex-col">
      <PanelToolbar className="gap-1.5 px-2">
        {LEVELS.map((level) => (<LevelToggle key={level} level={level} count={counts[level]} active={!hidden.has(level)} onToggle={() => toggleLevel(level)}/>))}
        <span aria-hidden className="mx-0.5 h-3.5 w-px bg-border-strong"/>
        <button type="button" aria-pressed={onlyScripts} title={onlyScripts ? 'Mostrando só o que veio dos scripts; clique para ver o console inteiro' : 'Mostrando o console inteiro; clique para ver só os scripts'} onClick={() => setOnlyScripts((value) => !value)} className={cn('h-5 rounded-xs px-1.5 font-mono text-3xs transition-colors hover:bg-highlight', FOCUS_RING_CLASS, onlyScripts ? 'text-primary' : 'text-muted-foreground')}>
          {onlyScripts ? 'só scripts' : 'tudo'}
        </button>
        {copied && (<span role="status" className="ml-auto flex items-center gap-1 font-mono text-3xs text-axis-y">
            <Check className="size-3" aria-hidden/>
            copiado
          </span>)}
        <IconButton label={follow ? 'Acompanhando as mensagens novas' : 'Voltar a acompanhar as mensagens novas'} size="sm" active={follow} className={cn(!copied && 'ml-auto')} onClick={() => {
            setFollow(true);
            const list = listRef.current;
            if (list)
                list.scrollTop = list.scrollHeight;
        }}>
          <ArrowDownToLine />
        </IconButton>
        <IconButton label="Copiar a saída visível" size="sm" disabled={entries.length === 0} onClick={() => void copy()}>
          <ClipboardCopy />
        </IconButton>
        <IconButton label="Limpar a saída (o console geral continua inteiro)" size="sm" disabled={visible.length === 0} onClick={() => setClearedBefore(log.entries.at(-1)?.id ?? 0)}>
          <Trash2 />
        </IconButton>
      </PanelToolbar>
      <div ref={listRef} onScroll={onScroll} aria-label="Saída dos scripts" className="min-h-0 flex-1 overflow-auto py-1 select-text">
        {entries.length === 0 ? (<DebugEmptyState title={visible.length === 0 ? 'Nenhuma saída ainda.' : 'Tudo escondido pelos filtros.'}>
            {visible.length === 0 ? 'Execute um script (Ctrl+Enter) ou dê Play no jogo: print, console.log, erros e avisos do runtime aparecem aqui com a linha de origem.' : 'Clique nos contadores acima para voltar a mostrar os níveis escondidos.'}
          </DebugEmptyState>) : (entries.map((entry) => <LogRow key={entry.id} entry={entry} session={session}/>))}
      </div>
    </div>);
}
