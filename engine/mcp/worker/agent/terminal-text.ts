import type { JsonSchema } from '@/engine/mcp/protocol/json-schema';
import type { ToolDescriptor } from '@/engine/mcp/protocol/tool-descriptor';
function firstSentence(description: string): string {
    const end = description.indexOf('. ');
    return end === -1 ? description : description.slice(0, end + 1);
}
function describeType(schema: JsonSchema): string {
    if (schema.enum)
        return schema.enum.join(' | ');
    if (schema.type === 'array')
        return `list of ${schema.items?.type ?? 'values'}`;
    return schema.type ?? 'value';
}
export function renderToolList(tools: readonly ToolDescriptor[]): string {
    const width = Math.max(0, ...tools.map((tool) => tool.name.length));
    return tools.map((tool) => `${tool.name.padEnd(width)}  [${tool.access}]  ${firstSentence(tool.description)}`).join('\n');
}
export function renderToolDetails(tool: ToolDescriptor): string {
    const required = new Set(tool.inputSchema.required ?? []);
    const properties = Object.entries(tool.inputSchema.properties ?? {});
    const argumentLines = properties.map(([name, schema]) => `  ${name}${required.has(name) ? '*' : ''} (${describeType(schema)}): ${schema.description ?? ''}`);
    return [`${tool.name}  [${tool.access}]  ${tool.title}`, tool.description, properties.length === 0 ? 'No arguments.' : 'Arguments (* = required):', ...argumentLines].join('\n');
}
