import { EDITOR_EVENT_NAMES } from '@/engine/editor/extensions/events/editor-events';
import type { WorkflowContribution, WorkflowStep, WorkflowStepControl } from '@/engine/editor/extensions/workflows/workflow-contribution';
import { HelixArgumentError, HelixError } from '../../runtime/script-errors';
import { describeType, requireFunction, requireNumber, requireObject, requireOneOf, requireString } from '../../runtime/values';
import { requireContributionId, type ExtensionApiContext } from './extension-api-context';
type StepData = Record<string, unknown>;
type StepRun = (step: ReturnType<typeof createStepContext>) => unknown;
interface StepDefinition {
    readonly title: string;
    readonly run: StepRun;
}
const MAX_STEPS = 64;
function createStepContext(control: WorkflowStepControl, data: StepData) {
    return {
        data,
        get cancelled(): boolean {
            return control.cancelled;
        },
        progress: (fraction: unknown, message?: unknown) => control.report(requireNumber(fraction, 'step.progress', 'o progresso'), message === undefined || message === null ? null : String(message)),
    };
}
function stepDefinitionsOf(settings: Record<string, unknown>, title: string, member: string): StepDefinition[] {
    if (settings.steps === undefined)
        return [{ title, run: requireFunction<StepRun>(settings.run, member, 'run') }];
    if (settings.run !== undefined)
        throw new HelixArgumentError(member, 'informe steps ou run, não os dois.');
    if (!Array.isArray(settings.steps))
        throw new HelixArgumentError(member, `steps precisa ser uma lista; recebido ${describeType(settings.steps)}.`);
    if (settings.steps.length === 0 || settings.steps.length > MAX_STEPS)
        throw new HelixArgumentError(member, `steps precisa ter de 1 a ${MAX_STEPS} passos.`);
    return settings.steps.map((item: unknown, index) => {
        const step = requireObject(item, member, `o passo ${index + 1}`);
        return { title: requireString(step.title, member, `o título do passo ${index + 1}`), run: requireFunction<StepRun>(step.run, member, `run do passo ${index + 1}`) };
    });
}
export function createWorkflowsApi(context: ExtensionApiContext) {
    const { host, extensions } = context;
    const { workflows, workflowRunner } = extensions;
    const find = (id: unknown, member: string): WorkflowContribution => {
        const key = requireContributionId(id, member);
        const workflow = workflows.get(key);
        if (!workflow)
            throw new HelixError(`${member}: o fluxo "${key}" não está registrado.`);
        return workflow;
    };
    return {
        register: (id: unknown, options: unknown) => {
            const member = 'helix.editor.workflows.register';
            const key = requireContributionId(id, member);
            const settings = requireObject(options, member);
            const title = settings.title === undefined ? key : requireString(settings.title, member, 'o título');
            const definitions = stepDefinitionsOf(settings, title, member);
            const owner = host.current;
            let data: StepData = {};
            const steps: WorkflowStep[] = definitions.map((definition, index) => ({
                title: definition.title,
                run: async (control) => {
                    if (index === 0)
                        data = {};
                    const phase = `fluxo "${key}" (${definition.title})`;
                    let pending: unknown;
                    const started = context.run(owner, phase, () => {
                        pending = definition.run(createStepContext(control, data));
                    });
                    if (!started)
                        throw new HelixError(`${phase} falhou.`);
                    try {
                        await pending;
                    }
                    catch (cause) {
                        context.run(owner, phase, () => {
                            throw cause;
                        });
                        throw new HelixError(`${phase} falhou.`);
                    }
                },
            }));
            const workflow: WorkflowContribution = {
                id: key,
                title,
                description: settings.description === undefined ? '' : requireString(settings.description, member, 'a descrição'),
                icon: settings.icon === undefined ? null : requireString(settings.icon, member, 'o ícone'),
                trigger: settings.trigger === undefined || settings.trigger === null ? null : requireOneOf(settings.trigger, EDITOR_EVENT_NAMES, member, 'o gatilho'),
                steps,
            };
            const unregister = context.own(workflows.register(workflow, context.ownerAssetId()));
            return {
                id: key,
                run: () => workflowRunner.run(workflow),
                cancel: () => workflowRunner.cancel(key),
                unregister,
            };
        },
        unregister: (id: unknown) => workflows.unregister(requireContributionId(id, 'helix.editor.workflows.unregister')),
        run: (id: unknown) => workflowRunner.run(find(id, 'helix.editor.workflows.run')),
        cancel: (id?: unknown) => workflowRunner.cancel(id === undefined ? null : requireContributionId(id, 'helix.editor.workflows.cancel')),
        get running(): string | null {
            return workflowRunner.progress?.workflowId ?? null;
        },
        list: () => workflows.list().map((workflow) => ({ id: workflow.id, title: workflow.title, trigger: workflow.trigger })),
    };
}
