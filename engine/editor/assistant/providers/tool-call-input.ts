import type { ToolCall } from './chat-protocol';
import { isRecord, parseJson } from './json-value';
type ParsedInput = Pick<ToolCall, 'input' | 'inputError'>;
const NOT_AN_OBJECT: ParsedInput = { input: {}, inputError: 'Tool arguments must be a JSON object.' };
export function parseToolCallInput(raw: unknown): ParsedInput {
    if (isRecord(raw))
        return { input: raw, inputError: null };
    if (typeof raw !== 'string')
        return NOT_AN_OBJECT;
    if (raw.trim() === '')
        return { input: {}, inputError: null };
    const parsed = parseJson(raw);
    if (parsed === undefined)
        return { input: {}, inputError: 'Tool arguments are not valid JSON.' };
    return isRecord(parsed) ? { input: parsed, inputError: null } : NOT_AN_OBJECT;
}
