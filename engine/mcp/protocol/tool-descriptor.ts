import { parseJsonSchema, type JsonSchema } from './json-schema';
import { isRecord, isText } from './json-shape';
export const TOOL_ACCESS_LEVELS = ['read', 'scene', 'code', 'destructive', 'run'] as const;
export type ToolAccessLevel = (typeof TOOL_ACCESS_LEVELS)[number];
const TOOL_NAME_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;
const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 4000;
export interface ToolDescriptor {
    readonly name: string;
    readonly title: string;
    readonly description: string;
    readonly access: ToolAccessLevel;
    readonly inputSchema: JsonSchema;
}
export function isToolName(value: string): boolean {
    return TOOL_NAME_PATTERN.test(value);
}
export function parseToolDescriptor(value: unknown): ToolDescriptor | null {
    if (!isRecord(value))
        return null;
    const { name, title, description } = value;
    if (!isText(name) || !isToolName(name))
        return null;
    if (!isText(title) || title.length > MAX_TITLE_LENGTH || !isText(description) || description.length > MAX_DESCRIPTION_LENGTH)
        return null;
    const access = TOOL_ACCESS_LEVELS.find((level) => level === value.access);
    const inputSchema = parseJsonSchema(value.inputSchema);
    if (!access || !inputSchema)
        return null;
    return { name, title, description, access, inputSchema };
}
