'use client';
import { useEffect, useRef } from 'react';
import type { BuildLogLine } from '@/engine/build/build-progress';
import { WELL_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
const LEVEL_CLASS = {
    info: 'text-muted-foreground',
    warn: 'text-warning',
    error: 'text-destructive',
} as const;
function timeOf(at: number): string {
    return new Date(at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
export function BuildLog({ lines, className, follow = true }: {
    lines: readonly BuildLogLine[];
    className?: string;
    follow?: boolean;
}) {
    const listRef = useRef<HTMLOListElement>(null);
    useEffect(() => {
        const list = listRef.current;
        if (!list || !follow)
            return;
        list.scrollTop = list.scrollHeight;
    }, [lines.length, follow]);
    if (lines.length === 0)
        return null;
    return (<ol ref={listRef} className={cn('max-h-40 overflow-y-auto rounded-sm px-3 py-2 font-mono text-3xs leading-relaxed', WELL_CLASS, className)} aria-label="Registro da compilação" aria-live="polite">
      {lines.map((line, index) => (<li key={`${line.at}-${index}`} className="flex gap-2">
          <time dateTime={new Date(line.at).toISOString()} className="shrink-0 text-muted-foreground/60 tabular-nums">
            {timeOf(line.at)}
          </time>
          <span className={cn('min-w-0 break-words', LEVEL_CLASS[line.level])}>{line.message}</span>
        </li>))}
    </ol>);
}
