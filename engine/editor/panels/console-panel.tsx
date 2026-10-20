'use client';
import { useEffect, useRef } from 'react';
import { Info, TriangleAlert, CircleAlert, Trash2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IconButton } from '@/engine/ui/icon-button';
import { useEditorState } from '@/engine/editor/session/editor-session-context';
import { formatElapsed, type LogEntry, type LogLevel } from '@/engine/editor/session/editor-log';
const LEVEL_META: Record<LogLevel, {
    icon: LucideIcon;
    className: string;
}> = {
    info: { icon: Info, className: 'text-muted-foreground' },
    warn: { icon: TriangleAlert, className: 'text-warning' },
    error: { icon: CircleAlert, className: 'text-destructive' },
};
function LogRow({ entry }: {
    entry: LogEntry;
}) {
    const meta = LEVEL_META[entry.level];
    const Icon = meta.icon;
    return (<div className="flex min-h-6 items-center gap-2 px-2 font-mono text-2xs hover:bg-highlight">
      <Icon className={cn('size-3.5 shrink-0', meta.className)} aria-hidden/>
      <span className="shrink-0 text-muted-foreground/70">{formatElapsed(entry.elapsedMs)}</span>
      <span className="shrink-0 text-primary/80">[{entry.source}]</span>
      <span className={cn('truncate text-foreground/90', entry.level === 'error' && 'text-destructive', entry.level === 'warn' && 'text-warning')}>
        {entry.message}
      </span>
    </div>);
}
export function ConsolePanel() {
    const session = useEditorState();
    const { log } = session;
    const listRef = useRef<HTMLDivElement>(null);
    const entryCount = log.entries.length;
    useEffect(() => {
        const list = listRef.current;
        if (list)
            list.scrollTop = list.scrollHeight;
    }, [entryCount]);
    return (<div className="flex h-full flex-col">
      <div className="flex h-8 shrink-0 items-center gap-3 border-b border-border px-2 font-mono text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1 text-foreground">
          <Info className="size-3" aria-hidden/>
          {log.count('info')}
        </span>
        <span className="flex items-center gap-1 text-warning">
          <TriangleAlert className="size-3" aria-hidden/>
          {log.count('warn')}
        </span>
        <span className="flex items-center gap-1 text-destructive">
          <CircleAlert className="size-3" aria-hidden/>
          {log.count('error')}
        </span>
        <IconButton label="Limpar console" size="sm" className="ml-auto" onClick={() => log.clear()}>
          <Trash2 />
        </IconButton>
      </div>
      <div ref={listRef} className="flex-1 overflow-auto py-1">
        {log.entries.map((entry) => (<LogRow key={entry.id} entry={entry}/>))}
      </div>
    </div>);
}
