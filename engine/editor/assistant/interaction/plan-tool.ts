import { PLAN_STEP_STATUSES, type PlanStep } from '@/engine/editor/assistant/conversation/conversation-entry';
import { ToolFailure } from '@/engine/editor/assistant/tools/tool-failure';
import type { ToolInput } from '@/engine/editor/assistant/tools/tool-input';
import { choice, parameters, recordList, text } from '@/engine/editor/assistant/tools/tool-parameters';
import type { InteractionTool } from './interaction-tool';
const MAX_STEPS = 12;
const TITLE_LIMIT = 120;
function readStep(input: ToolInput): PlanStep {
    const title = input.text('title').trim();
    if (!title)
        throw new ToolFailure('Every plan step needs a non-empty "title".');
    return { title: title.slice(0, TITLE_LIMIT), status: input.choice('status', PLAN_STEP_STATUSES) };
}
export const updatePlanTool: InteractionTool = {
    name: 'update_plan',
    description: 'Publishes the work plan as a checklist the user watches while you work. Call it before starting a task that takes three or more steps, and again whenever a step starts or finishes. Always send the complete list, with at most one step in_progress.',
    parameters: parameters({
        steps: recordList('Every step of the plan, in execution order.', {
            title: text('Short description of the step, in the language of the user.'),
            status: choice('Progress of the step.', PLAN_STEP_STATUSES),
        }, MAX_STEPS),
    }, ['steps']),
    run({ conversation }, input) {
        const steps = input.records('steps', MAX_STEPS).map(readStep);
        conversation.setPlan(steps);
        const completed = steps.filter((step) => step.status === 'completed').length;
        return `Plan published: ${completed} of ${steps.length} steps completed.`;
    },
};
