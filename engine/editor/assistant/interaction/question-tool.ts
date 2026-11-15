import type { QuestionOption } from '@/engine/editor/assistant/conversation/conversation-entry';
import { ToolFailure } from '@/engine/editor/assistant/tools/tool-failure';
import type { ToolInput } from '@/engine/editor/assistant/tools/tool-input';
import { parameters, recordList, text } from '@/engine/editor/assistant/tools/tool-parameters';
import type { InteractionTool } from './interaction-tool';
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 4;
const QUESTION_LIMIT = 400;
const LABEL_LIMIT = 80;
const DESCRIPTION_LIMIT = 200;
function readOption(input: ToolInput): QuestionOption {
    const label = input.text('label').trim();
    if (!label)
        throw new ToolFailure('Every option needs a non-empty "label".');
    const description = input.optionalText('description') ?? '';
    return { label: label.slice(0, LABEL_LIMIT), description: description.trim().slice(0, DESCRIPTION_LIMIT) };
}
export const askUserTool: InteractionTool = {
    name: 'ask_user',
    description: 'Asks the user one multiple-choice question and waits for the answer before you continue. Use it when the request is ambiguous in a way that changes what you build, or when the choice belongs to the user. Offer 2 to 4 concrete options with the recommended one first. The editor always adds an "Other" option for a free-text answer, so never include one.',
    parameters: parameters({
        question: text('The question, in the language of the user.'),
        options: recordList('Between 2 and 4 distinct answers to choose from.', {
            label: text('Short answer shown on the option.'),
            description: text('What choosing this option leads to.'),
        }, MAX_OPTIONS),
    }, ['question', 'options']),
    awaitsUser: true,
    async run({ conversation, awaitAnswer }, input) {
        const question = input.text('question').trim();
        if (!question)
            throw new ToolFailure('"question" must not be empty.');
        const options = input.records('options', MAX_OPTIONS).map(readOption);
        if (options.length < MIN_OPTIONS)
            throw new ToolFailure(`"options" needs at least ${MIN_OPTIONS} items.`);
        const entryId = conversation.addQuestion(question.slice(0, QUESTION_LIMIT), options);
        const answer = await awaitAnswer(entryId);
        conversation.resolveQuestion(entryId, answer);
        if (!answer)
            throw new ToolFailure('The user stopped the assistant without answering.');
        return answer.custom ? `The user typed their own answer instead of picking an option: ${answer.text}` : `The user chose: ${answer.text}`;
    },
};
