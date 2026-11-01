'use client';
import { CircleX, Hammer, Info, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { compileProject } from '@/engine/editor/operations/script-operations';
import { debugFileName } from '@/engine/scripting/debug/script-debugger';
import { cn } from '@/lib/utils';
import type { CodeDiagnostic, CodeDiagnosticSeverity } from '../../code-editor';
import { IconButton } from '@/engine/ui/icon-button';
import { PanelToolbar } from '@/engine/ui/panel-toolbar';
import { useCodeSelector } from '../../ui/use-code-editor';
import { CountChip, DebugEmptyState, DebugSectionTitle, LocationLink } from '../debug-shared';
const SEVERITY_ORDER: Record<CodeDiagnosticSeverity, number> = { error: 0, warning: 1, info: 2 };
const SEVERITY_ICON: Record<CodeDiagnosticSeverity, typeof CircleX> = { error: CircleX, warning: TriangleAlert, info: Info };
const SEVERITY_TONE: Record<CodeDiagnosticSeverity, string> = { error: 'text-destructive', warning: 'text-warning', info: 'text-primary' };
const SEVERITY_LABEL: Record<CodeDiagnosticSeverity, string> = { error: 'Erros', warning: 'Avisos', info: 'Informações' };
interface FileGroup {
    readonly assetId: string;
    readonly file: string;
    readonly diagnostics: readonly CodeDiagnostic[];
}
function fileNameOf(session: EditorSession, assetId: string): string {
    const asset = session.library.get(assetId);
    if (!asset)
        return 'script removido';
    return asset.details.kind === 'script' ? debugFileName(asset.name, asset.details.language) : asset.name;
}
function groupByFile(session: EditorSession, diagnostics: readonly CodeDiagnostic[], live: ReadonlyMap<string, readonly CodeDiagnostic[]>, visible: ReadonlySet<CodeDiagnosticSeverity>): FileGroup[] {
    const byAsset = new Map<string, CodeDiagnostic[]>();
    for (const [assetId, list] of live)
        byAsset.set(assetId, list.slice());
    for (const diagnostic of diagnostics) {
        if (live.has(diagnostic.assetId))
            continue;
        const list = byAsset.get(diagnostic.assetId) ?? [];
        list.push(diagnostic);
        byAsset.set(diagnostic.assetId, list);
    }
    const groups: FileGroup[] = [];
    for (const [assetId, list] of byAsset) {
        const filtered = list.filter((diagnostic) => visible.has(diagnostic.severity)).sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.line - b.line || a.column - b.column);
        if (filtered.length === 0)
            continue;
        groups.push({ assetId, file: fileNameOf(session, assetId), diagnostics: filtered });
    }
    return groups.sort((a, b) => SEVERITY_ORDER[a.diagnostics[0].severity] - SEVERITY_ORDER[b.diagnostics[0].severity] || a.file.localeCompare(b.file, 'pt-BR'));
}
function DiagnosticRow({ diagnostic, file, session }: {
    diagnostic: CodeDiagnostic;
    file: string;
    session: EditorSession;
}) {
    const Icon = SEVERITY_ICON[diagnostic.severity];
    return (<li className="flex min-h-row items-center gap-2 px-2 py-0.5 text-2xs hover:bg-surface-hover">
      <Icon className={cn('size-3 shrink-0', SEVERITY_TONE[diagnostic.severity])} aria-label={SEVERITY_LABEL[diagnostic.severity]}/>
      <span className="min-w-0 flex-1 truncate text-foreground" title={diagnostic.message}>
        {diagnostic.message}
      </span>
      {diagnostic.code && <span className="shrink-0 font-mono text-3xs text-muted-foreground">{diagnostic.code}</span>}
      <span className="shrink-0 rounded-xs bg-surface-raised px-1 font-mono text-3xs text-muted-foreground ring-1 ring-border ring-inset">{diagnostic.source}</span>
      <LocationLink session={session} assetId={diagnostic.assetId} file={file} line={diagnostic.line} column={diagnostic.column}/>
    </li>);
}
function SeverityToggle({ severity, count, active, onToggle }: {
    severity: CodeDiagnosticSeverity;
    count: number;
    active: boolean;
    onToggle: () => void;
}) {
    const Icon = SEVERITY_ICON[severity];
    return (<button type="button" role="switch" aria-checked={active} onClick={onToggle} title={`${active ? 'Ocultar' : 'Mostrar'} ${SEVERITY_LABEL[severity].toLowerCase()}`} className={cn('flex h-5 items-center gap-1 rounded-xs px-1.5 font-mono text-3xs tabular-nums transition-colors', active ? 'bg-surface-raised text-foreground ring-1 ring-border ring-inset' : 'text-muted-foreground/70 hover:text-foreground')}>
      <Icon className={cn('size-3', active ? SEVERITY_TONE[severity] : '')} aria-hidden/>
      {count}
    </button>);
}
export function AnalysisPanel() {
    const session = useSessionTopic('assets');
    const diagnostics = useCodeSelector((code) => code.diagnostics);
    const live = useCodeSelector((code) => code.liveDiagnostics);
    const compileState = useCodeSelector((code) => code.compileState);
    const compileMessage = useCodeSelector((code) => code.compileMessage);
    const [visible, setVisible] = useState<ReadonlySet<CodeDiagnosticSeverity>>(() => new Set<CodeDiagnosticSeverity>(['error', 'warning', 'info']));
    const groups = useMemo(() => groupByFile(session, diagnostics, live, visible), [session, diagnostics, live, visible]);
    const counts = useMemo(() => {
        const all = groupByFile(session, diagnostics, live, new Set<CodeDiagnosticSeverity>(['error', 'warning', 'info']));
        const result: Record<CodeDiagnosticSeverity, number> = { error: 0, warning: 0, info: 0 };
        for (const group of all)
            for (const diagnostic of group.diagnostics)
                result[diagnostic.severity]++;
        return result;
    }, [session, diagnostics, live]);
    const toggle = (severity: CodeDiagnosticSeverity) => setVisible((current) => {
        const next = new Set(current);
        if (next.has(severity))
            next.delete(severity);
        else
            next.add(severity);
        return next;
    });
    const total = counts.error + counts.warning + counts.info;
    return (<div className="flex h-full min-h-0 flex-col">
      <PanelToolbar>
        <SeverityToggle severity="error" count={counts.error} active={visible.has('error')} onToggle={() => toggle('error')}/>
        <SeverityToggle severity="warning" count={counts.warning} active={visible.has('warning')} onToggle={() => toggle('warning')}/>
        <SeverityToggle severity="info" count={counts.info} active={visible.has('info')} onToggle={() => toggle('info')}/>
        <span className={cn('ml-2 min-w-0 flex-1 truncate font-mono text-3xs', compileState === 'failed' ? 'text-destructive' : compileState === 'ok' ? 'text-axis-y' : 'text-muted-foreground')} title={compileMessage}>
          {compileMessage}
        </span>
        <IconButton label="Compilar o projeto" size="sm" disabled={compileState === 'compiling'} onClick={() => void compileProject(session)}>
          <Hammer className={compileState === 'compiling' ? 'animate-spin' : undefined}/>
        </IconButton>
      </PanelToolbar>
      {groups.length === 0 ? (<DebugEmptyState title={total === 0 ? 'Nenhum problema encontrado.' : 'Nenhum problema com os filtros atuais.'}>
          {total === 0 ? 'O verificador ao vivo confere o script aberto enquanto você digita; Compilar confere o projeto inteiro e lista aqui o que encontrar.' : 'Reative uma das severidades na barra acima para ver os problemas ocultos.'}
        </DebugEmptyState>) : (<div className="min-h-0 flex-1 overflow-auto">
          {groups.map((group) => (<section key={group.assetId} aria-label={group.file}>
              <DebugSectionTitle trailing={<>
                    {(['error', 'warning', 'info'] as const).map((severity) => {
                        const count = group.diagnostics.filter((diagnostic) => diagnostic.severity === severity).length;
                        return count > 0 ? (<CountChip key={severity} tone={severity === 'error' ? 'destructive' : severity === 'warning' ? 'warning' : 'neutral'} title={SEVERITY_LABEL[severity]}>
                          {count}
                        </CountChip>) : null;
                    })}
                  </>}>
                {group.file}
              </DebugSectionTitle>
              <ul>
                {group.diagnostics.map((diagnostic) => (<DiagnosticRow key={diagnostic.id} diagnostic={diagnostic} file={group.file} session={session}/>))}
              </ul>
            </section>))}
        </div>)}
    </div>);
}
