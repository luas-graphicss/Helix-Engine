'use client';
import type { ReactNode } from 'react';
import { openScriptAssetInEditor } from '@/engine/editor/operations/script-operations';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import type { FormattedValue, ValueKind } from '@/engine/scripting/debug/format-value';
import { cn } from '@/lib/utils';
export const SCRIPT_LOG_SOURCES: ReadonlySet<string> = new Set(['Scripts', 'Depurador', 'Compilador', 'Módulos', 'TypeScript']);
export function openScriptLocation(session: EditorSession, assetId: string, line: number, file?: string): void {
    const asset = session.library.get(assetId);
    if (!asset) {
        session.log.warn('Depurador', `${file ?? 'O script'} não está mais na biblioteca.`);
        return;
    }
    void openScriptAssetInEditor(session, asset, { pin: true, line: Math.max(1, line) });
}
type LocationLinkProps = {
    session: EditorSession;
    assetId: string | null;
    file: string;
    line: number;
    column?: number | null;
    className?: string;
};
export function LocationLink({ session, assetId, file, line, column, className }: LocationLinkProps) {
    const text = `${file}${line > 0 ? `:${line}` : ''}${line > 0 && column ? `:${column}` : ''}`;
    if (!assetId || line <= 0)
        return <span className={cn('shrink-0 font-mono text-muted-foreground', className)}>{text}</span>;
    return (<button type="button" onClick={() => openScriptLocation(session, assetId, line, file)} title="Abrir o script nesta linha" className={cn('shrink-0 rounded-xs px-1 font-mono text-muted-foreground underline-offset-2 hover:text-foreground hover:underline', className)}>
      {text}
    </button>);
}
export function DebugEmptyState({ title, children }: {
    title: string;
    children?: ReactNode;
}) {
    return (<div className="flex h-full flex-col items-center justify-center gap-1.5 px-6 py-4 text-center">
      <p className="text-2xs font-medium text-foreground/80 text-balance">{title}</p>
      {children && <p className="max-w-md text-3xs leading-relaxed text-muted-foreground text-pretty">{children}</p>}
    </div>);
}
const VALUE_TONE: Record<ValueKind, string> = {
    undefined: 'text-muted-foreground/70 italic',
    null: 'text-muted-foreground/70 italic',
    boolean: 'text-code-number',
    number: 'text-code-number',
    bigint: 'text-code-number',
    string: 'text-code-string',
    function: 'text-code-definition',
    array: 'text-foreground/90',
    object: 'text-foreground/90',
    entity: 'text-code-type',
    vector: 'text-code-property',
    error: 'text-destructive',
    symbol: 'text-code-meta',
};
export function ValueText({ value, className }: {
    value: FormattedValue;
    className?: string;
}) {
    return (<span className={cn('min-w-0 truncate font-mono', VALUE_TONE[value.kind], className)} title={value.text}>
      {value.text}
    </span>);
}
export function formatMs(ms: number): string {
    if (ms < 0.01)
        return '0 ms';
    if (ms < 1)
        return `${ms.toFixed(2)} ms`;
    if (ms < 10)
        return `${ms.toFixed(1)} ms`;
    return `${Math.round(ms)} ms`;
}
export function DebugSectionTitle({ children, trailing }: {
    children: ReactNode;
    trailing?: ReactNode;
}) {
    return (<div className="flex h-6 shrink-0 items-center gap-2 border-y border-border bg-surface-sunken/60 px-2 font-mono text-3xs tracking-wider text-muted-foreground uppercase">
      <span className="truncate">{children}</span>
      {trailing && <span className="ml-auto flex shrink-0 items-center gap-2 normal-case">{trailing}</span>}
    </div>);
}
export function CountChip({ children, tone = 'neutral', title }: {
    children: ReactNode;
    tone?: 'neutral' | 'warning' | 'destructive' | 'success';
    title?: string;
}) {
    return (<span title={title} className={cn('shrink-0 rounded-xs px-1 py-px font-mono text-3xs leading-none tabular-nums', tone === 'warning' && 'bg-warning/20 text-warning', tone === 'destructive' && 'bg-destructive/20 text-destructive', tone === 'success' && 'bg-axis-y/20 text-axis-y', tone === 'neutral' && 'bg-surface-raised text-muted-foreground ring-1 ring-border ring-inset')}>
      {children}
    </span>);
}
