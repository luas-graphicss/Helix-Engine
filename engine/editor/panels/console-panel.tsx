'use client';
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { Info, TriangleAlert, CircleAlert, Trash2, Bug, Check, ChevronRight, ClipboardCopy } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu';
import { cn } from '@/lib/utils';
import { IconButton } from '@/engine/ui/icon-button';
import { PanelToolbar } from '@/engine/ui/panel-toolbar';
import { copyTextToClipboard, selectElementContents } from '@/engine/ui/clipboard';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { formatElapsed, type LogEntry, type LogLevel, type LogLocation } from '@/engine/editor/session/editor-log';
import { formatLogEntries } from '@/engine/editor/session/log-text';
import { useEngineSetting } from '@/engine/settings/engine-settings-store';
import { openScriptAssetInEditor } from '@/engine/editor/operations/script-operations';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { ConsoleContextMenuContent } from './console/console-context-menu';
const LEVEL_META: Record<LogLevel, {
    icon: LucideIcon;
    className: string;
    label: string;
}> = {
    debug: { icon: Bug, className: 'text-muted-foreground/70', label: 'Depuração' },
    info: { icon: Info, className: 'text-muted-foreground', label: 'Mensagens' },
    warn: { icon: TriangleAlert, className: 'text-warning', label: 'Avisos' },
    error: { icon: CircleAlert, className: 'text-destructive', label: 'Erros' },
};
const LEVELS: readonly LogLevel[] = ['debug', 'info', 'warn', 'error'];
const COPIED_FEEDBACK_MS = 1500;
export function openLogLocation(session: EditorSession, location: LogLocation): void {
    const asset = session.library.get(location.assetId);
    if (!asset) {
        session.log.warn('Console', `${location.file} não está mais na biblioteca.`);
        return;
    }
    void openScriptAssetInEditor(session, asset, { pin: true, line: location.line });
}
export function LogRow({ entry, session }: {
    entry: LogEntry;
    session: EditorSession;
}) {
    const meta = LEVEL_META[entry.level];
    const Icon = meta.icon;
    const [expanded, setExpanded] = useState(false);
    const hasDetails = Boolean(entry.details);
    const tone = entry.level === 'error' ? 'text-destructive' : entry.level === 'warn' ? 'text-warning' : entry.level === 'debug' ? 'text-muted-foreground' : 'text-foreground/90';
    return (<div data-log-id={entry.id} className="font-mono text-2xs [contain-intrinsic-block-size:auto_1.5rem] [content-visibility:auto] hover:bg-highlight">
      <div className="flex min-h-row items-center gap-2 px-2">
        {hasDetails ? (<button type="button" className="flex size-3.5 shrink-0 items-center justify-center text-muted-foreground" aria-expanded={expanded} aria-label={expanded ? 'Esconder detalhes' : 'Mostrar detalhes'} onClick={() => setExpanded((value) => !value)}>
            <ChevronRight className={cn('size-3 transition-transform', expanded && 'rotate-90')} aria-hidden/>
          </button>) : (<span className="size-3.5 shrink-0" aria-hidden/>)}
        <Icon className={cn('size-3.5 shrink-0', meta.className)} aria-hidden/>
        <span className="shrink-0 text-muted-foreground/70">{formatElapsed(entry.elapsedMs)}</span>
        <span className="shrink-0 text-primary/80">[{entry.source}]</span>
        <span className={cn('min-w-0 flex-1 truncate', tone)} title={entry.message}>
          {entry.message}
        </span>
        {entry.location && (<button type="button" className="shrink-0 rounded-xs px-1 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" title="Abrir o script nesta linha" onClick={() => openLogLocation(session, entry.location!)}>
            {entry.location.file}:{entry.location.line}
            {entry.location.column !== undefined ? `:${entry.location.column}` : ''}
          </button>)}
        {entry.repeat > 1 && (<span className="shrink-0 rounded-full bg-surface-overlay px-1.5 text-3xs text-muted-foreground" title={`${entry.repeat} vezes`}>
            ×{entry.repeat}
          </span>)}
      </div>
      {expanded && hasDetails && (<pre className="mx-2 mb-1 ml-9 max-h-48 overflow-auto whitespace-pre-wrap rounded-xs bg-surface-sunken px-2 py-1 text-3xs leading-relaxed text-muted-foreground">
          {entry.details}
        </pre>)}
    </div>);
}
export function ConsolePanel() {
    const session = useSessionTopic('log', 'assets', 'playtest');
    const { log } = session;
    const order = useEngineSetting('editor.console.order');
    const listRef = useRef<HTMLDivElement>(null);
    const [contextEntryId, setContextEntryId] = useState<number | null>(null);
    const [copied, setCopied] = useState<string | null>(null);
    const entryCount = log.entries.length;
    const lastRepeat = log.entries[log.entries.length - 1]?.repeat ?? 0;
    const newestFirst = order === 'newest-first';
    const entries = newestFirst ? log.entries.slice().reverse() : log.entries;
    const contextEntry = contextEntryId === null ? null : (log.entries.find((entry) => entry.id === contextEntryId) ?? null);
    useEffect(() => {
        const list = listRef.current;
        if (list)
            list.scrollTop = newestFirst ? 0 : list.scrollHeight;
    }, [entryCount, lastRepeat, newestFirst]);
    useEffect(() => {
        if (copied === null)
            return;
        const timer = window.setTimeout(() => setCopied(null), COPIED_FEEDBACK_MS);
        return () => window.clearTimeout(timer);
    }, [copied]);
    const copy = async (text: string, what: string) => {
        const ok = await copyTextToClipboard(text);
        if (ok)
            setCopied(what);
        else
            log.warn('Console', 'O navegador não permitiu copiar; selecione o texto e use Ctrl+C.');
    };
    const selectAll = () => {
        const list = listRef.current;
        if (!list)
            return;
        list.focus();
        selectElementContents(list);
    };
    const onContextMenu = (event: MouseEvent<HTMLDivElement>) => {
        const row = (event.target as HTMLElement).closest<HTMLElement>('[data-log-id]');
        setContextEntryId(row ? Number(row.dataset.logId) : null);
    };
    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
            event.preventDefault();
            selectAll();
        }
    };
    return (<div className="flex h-full flex-col">
      <PanelToolbar className="gap-3 px-2 font-mono text-3xs text-muted-foreground">
        {LEVELS.map((level) => {
            const meta = LEVEL_META[level];
            const Icon = meta.icon;
            return (<span key={level} className={cn('flex items-center gap-1', meta.className)} title={meta.label}>
              <Icon className="size-3" aria-hidden/>
              {log.count(level)}
            </span>);
        })}
        {copied && (<span role="status" className="ml-auto flex items-center gap-1 text-axis-y">
            <Check className="size-3" aria-hidden/>
            {copied} copiado
          </span>)}
        <IconButton label="Copiar todo o console" size="sm" className={cn(!copied && 'ml-auto')} disabled={entryCount === 0} onClick={() => void copy(formatLogEntries(log.entries), 'Console')}>
          <ClipboardCopy />
        </IconButton>
        <IconButton label="Limpar console" size="sm" disabled={entryCount === 0} onClick={() => log.clear()}>
          <Trash2 />
        </IconButton>
      </PanelToolbar>
      <ContextMenu>
        
        <ContextMenuTrigger className="select-text" render={<div ref={listRef} tabIndex={0} aria-label="Mensagens do console" onContextMenu={onContextMenu} onKeyDown={onKeyDown} className="flex-1 overflow-auto py-1 outline-none focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:ring-inset"/>}>
          {entries.length === 0 ? (<p className="px-3 py-2 text-2xs text-muted-foreground">Nenhuma mensagem nesta sessão.</p>) : (entries.map((entry) => <LogRow key={entry.id} entry={entry} session={session}/>))}
        </ContextMenuTrigger>
        <ConsoleContextMenuContent entry={contextEntry} entries={entries} onCopy={(text, what) => void copy(text, what)} onSelectAll={selectAll} onOpenLocation={(entry) => entry.location && openLogLocation(session, entry.location)} onClear={() => log.clear()}/>
      </ContextMenu>
    </div>);
}
