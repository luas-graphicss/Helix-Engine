import { isFiniteNumber, isRecord, isText, isTextList } from './json-shape';
const MAX_SCHEMA_DEPTH = 6;
export interface JsonSchema {
    readonly type?: string;
    readonly description?: string;
    readonly enum?: readonly string[];
    readonly properties?: Readonly<Record<string, JsonSchema>>;
    readonly required?: readonly string[];
    readonly items?: JsonSchema;
    readonly minItems?: number;
    readonly maxItems?: number;
}
function parseProperties(value: unknown, depth: number): Record<string, JsonSchema> | null {
    if (!isRecord(value))
        return null;
    const properties: Record<string, JsonSchema> = {};
    for (const [name, candidate] of Object.entries(value)) {
        const schema = parseJsonSchema(candidate, depth + 1);
        if (!schema)
            return null;
        properties[name] = schema;
    }
    return properties;
}
export function parseJsonSchema(value: unknown, depth = 0): JsonSchema | null {
    if (!isRecord(value) || depth > MAX_SCHEMA_DEPTH)
        return null;
    const properties = value.properties === undefined ? undefined : parseProperties(value.properties, depth);
    const items = value.items === undefined ? undefined : parseJsonSchema(value.items, depth + 1);
    if (properties === null || items === null)
        return null;
    return {
        type: isText(value.type) ? value.type : undefined,
        description: isText(value.description) ? value.description : undefined,
        enum: isTextList(value.enum) ? value.enum : undefined,
        properties,
        required: isTextList(value.required) ? value.required : undefined,
        items,
        minItems: isFiniteNumber(value.minItems) ? value.minItems : undefined,
        maxItems: isFiniteNumber(value.maxItems) ? value.maxItems : undefined,
    };
}
