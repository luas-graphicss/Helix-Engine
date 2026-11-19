'use client';
import { Play, Square } from 'lucide-react';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { IconButton } from '@/engine/ui/icon-button';
import type { EditorEventName } from '../../events/editor-events';
import type { WorkflowContribution } from '../../workflows/workflow-contribution';
import type { WorkflowOutcome } from '../../workflows/workflow-runner';
import { extensionIcon } from '../extension-icon';
import { useContributions } from '../use-contributions';
import { useWorkflowRunner } from './use-workflow-runner';
const OUTCOME_LABEL: Readonly<Record<WorkflowOutcome, string>> = {
    done: 'concluído',
    failed: 'falhou',
    cancelled: 'cancelado',
};
const TRIGGER_LABEL: Readonly<Record<EditorEventName, string>> = {
    selectionChanged: 'ao mudar a seleção',
    sceneChanged: 'ao mudar a cena',
    assetsChanged: 'ao mudar os ativos',
    historyChanged: 'ao mudar o histórico',
    toolChanged: 'ao trocar de ferramenta',
    playModeChanged: 'ao simular ou parar',
    projectSaved: 'ao salvar',
};
function WorkflowRow({ workflow }: {
    workflow: WorkflowContribution;
}) {
    const runner = useWorkflowRunner();
    const Icon = extensionIcon(workflow.icon ?? 'workflow');
    const running = runner.progress?.workflowId === workflow.id;
    const pending = runner.isPending(workflow.id);
    const result = runner.resultOf(workflow.id);
    const status = running ? 'em execução' : pending ? 'na fila' : result ? OUTCOME_LABEL[result.outcome] : workflow.trigger ? TRIGGER_LABEL[workflow.trigger] : '';
    return (<li className="flex h-control items-center gap-1.5 px-2 text-2xs text-foreground/90 hover:bg-highlight" title={workflow.description || workflow.title}>
      <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden/>
      <span className="min-w-0 flex-1 truncate">{workflow.title}</span>
      <span className="shrink-0 font-mono text-3xs text-muted-foreground/70">{status}</span>
      {pending ? (<IconButton label={`Cancelar ${workflow.title}`} size="xs" onClick={() => runner.cancel(workflow.id)}>
          <Square />
        </IconButton>) : (<IconButton label={`Executar ${workflow.title}`} size="xs" onClick={() => void runner.run(workflow)}>
          <Play />
        </IconButton>)}
    </li>);
}
export function WorkflowList() {
    const workflows = useContributions(useEditorSession().extensions.workflows);
    if (workflows.length === 0)
        return null;
    return (<section aria-label="Fluxos de trabalho" className="shrink-0 border-t border-border">
      <h3 className="px-2 pt-1.5 pb-0.5 text-3xs font-medium tracking-wider text-muted-foreground uppercase">Fluxos de trabalho</h3>
      <ul className="max-h-48 overflow-auto pb-1">
        {workflows.map((workflow) => (<WorkflowRow key={workflow.id} workflow={workflow}/>))}
      </ul>
    </section>);
}
