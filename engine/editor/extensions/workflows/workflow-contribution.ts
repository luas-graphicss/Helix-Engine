import type { EditorEventName } from '../events/editor-events';
import type { Contribution } from '../registry/contribution-registry';
export interface WorkflowStepControl {
    readonly cancelled: boolean;
    report(fraction: number, message: string | null): void;
}
export interface WorkflowStep {
    readonly title: string;
    run(control: WorkflowStepControl): Promise<void>;
}
export interface WorkflowContribution extends Contribution {
    readonly title: string;
    readonly description: string;
    readonly icon: string | null;
    readonly trigger: EditorEventName | null;
    readonly steps: readonly WorkflowStep[];
}
