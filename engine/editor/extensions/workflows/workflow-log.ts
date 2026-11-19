import type { EditorLog } from '@/engine/editor/session/editor-log';
import type { WorkflowOutcome, WorkflowReporter } from './workflow-runner';
const LOG_SOURCE = 'Fluxos';
const MS_PER_SECOND = 1000;
function formatDuration(durationMs: number): string {
    return `${(durationMs / MS_PER_SECOND).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} s`;
}
const OUTCOME_TEXT: Readonly<Record<WorkflowOutcome, string>> = {
    done: 'concluído',
    failed: 'interrompido por um erro',
    cancelled: 'cancelado',
};
export function createWorkflowReporter(log: EditorLog): WorkflowReporter {
    return {
        started: (workflow) => log.info(LOG_SOURCE, `${workflow.title}: iniciado.`),
        finished: (workflow, result) => {
            const message = `${workflow.title}: ${OUTCOME_TEXT[result.outcome]} em ${formatDuration(result.durationMs)}.`;
            if (result.outcome === 'failed')
                log.error(LOG_SOURCE, message);
            else if (result.outcome === 'cancelled')
                log.warn(LOG_SOURCE, message);
            else
                log.info(LOG_SOURCE, message);
        },
    };
}
