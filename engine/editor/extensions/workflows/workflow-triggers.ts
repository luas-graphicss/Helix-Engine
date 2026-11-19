import { EDITOR_EVENT_NAMES, type EditorEvents } from '../events/editor-events';
import type { WorkflowContribution } from './workflow-contribution';
export interface TriggeredRunner {
    isPending(workflowId: string): boolean;
    run(workflow: WorkflowContribution): unknown;
}
export interface WorkflowSource {
    list(): readonly WorkflowContribution[];
}
export function connectWorkflowTriggers(events: EditorEvents, workflows: WorkflowSource, runner: TriggeredRunner): () => void {
    const unsubscribes = EDITOR_EVENT_NAMES.map((name) => events.on(name, () => {
        for (const workflow of workflows.list())
            if (workflow.trigger === name && !runner.isPending(workflow.id))
                runner.run(workflow);
    }));
    return () => {
        for (const unsubscribe of unsubscribes)
            unsubscribe();
    };
}
