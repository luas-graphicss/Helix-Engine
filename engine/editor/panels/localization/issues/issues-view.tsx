'use client';
import type { LocalizationIssues } from '@/engine/editor/localization/localization-issues';
import type { LocalizationTable, TranslationIssue, TranslationIssueKind } from '@/engine/localization/analysis/translation-issues';
import { FOCUS_RING_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
import { ISSUE_KIND_LABEL } from '../localization-labels';
import { PaneNote } from '../shared/pane';
const MAX_VISIBLE_ISSUES = 300;
const HEADER_CLASS = 'px-2 py-1 text-left font-semibold';
const CELL_CLASS = 'px-2 py-1';
const EMPTY_NOTE = 'Sem pendências: cada texto e cada ativo tem valor em todos os idiomas, sem erro de sintaxe nem argumento trocado.';
const TABLE_LABEL: Record<LocalizationTable, string> = { strings: 'Texto', assets: 'Ativo' };
const KIND_CLASS: Record<TranslationIssueKind, string> = {
    syntax: 'text-destructive',
    arguments: 'text-warning',
    plural: 'text-warning',
    asset: 'text-destructive',
    missing: 'text-muted-foreground',
};
type IssuesViewProps = {
    issues: LocalizationIssues;
    onOpen: (issue: TranslationIssue) => void;
};
type IssueRowProps = {
    issue: TranslationIssue;
    onOpen: (issue: TranslationIssue) => void;
};
function IssueRow({ issue, onOpen }: IssueRowProps) {
    return (<tr className="border-b border-border/60 hover:bg-highlight">
      <td className={cn(CELL_CLASS, 'whitespace-nowrap', KIND_CLASS[issue.kind])}>{ISSUE_KIND_LABEL[issue.kind]}</td>
      <td className={cn(CELL_CLASS, 'text-muted-foreground')}>{TABLE_LABEL[issue.table]}</td>
      <th scope="row" className="max-w-0 px-1 py-0.5 text-left font-normal">
        <button type="button" title={`Abrir ${issue.key}`} onClick={() => onOpen(issue)} className={cn('block w-full truncate rounded-xs px-1 py-0.5 text-left font-mono text-foreground hover:text-primary', FOCUS_RING_CLASS)}>
          {issue.key}
        </button>
      </th>
      <td className={cn(CELL_CLASS, 'font-mono text-foreground/80')}>{issue.locale}</td>
      <td className={cn(CELL_CLASS, 'max-w-0 truncate text-muted-foreground')} title={issue.detail}>
        {issue.detail}
      </td>
    </tr>);
}
export function IssuesView({ issues, onOpen }: IssuesViewProps) {
    if (issues.all.length === 0)
        return <PaneNote>{EMPTY_NOTE}</PaneNote>;
    const shown = issues.all.slice(0, MAX_VISIBLE_ISSUES);
    return (<div className="h-full overflow-auto">
      <table aria-label="Pendências da localização" className="w-full table-fixed border-collapse text-2xs">
        <thead className="sticky top-0 z-10 border-b border-border bg-surface-raised text-3xs tracking-[0.08em] text-foreground/90 uppercase">
          <tr>
            <th scope="col" className={cn(HEADER_CLASS, 'w-28')}>Problema</th>
            <th scope="col" className={cn(HEADER_CLASS, 'w-16')}>Tabela</th>
            <th scope="col" className={cn(HEADER_CLASS, 'w-1/4')}>Chave</th>
            <th scope="col" className={cn(HEADER_CLASS, 'w-20')}>Idioma</th>
            <th scope="col" className={HEADER_CLASS}>Detalhe</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((issue, index) => (<IssueRow key={index} issue={issue} onOpen={onOpen}/>))}
        </tbody>
      </table>
      {issues.all.length > shown.length && (<PaneNote>
          Mostrando {shown.length} de {issues.all.length} pendências. As demais aparecem conforme estas forem resolvidas.
        </PaneNote>)}
    </div>);
}
