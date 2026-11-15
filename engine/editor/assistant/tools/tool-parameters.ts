import type { ListParameter, ScalarParameter, ScalarParameterType, ToolParameter, ToolParameters } from '@/engine/editor/assistant/providers/tool-declaration';
export function parameters(properties: Readonly<Record<string, ToolParameter>>, required: readonly string[] = []): ToolParameters {
    return { type: 'object', properties, required };
}
export function text(description: string): ScalarParameter {
    return { type: 'string', description };
}
export function choice(description: string, options: readonly string[]): ScalarParameter {
    return { type: 'string', description, enum: options };
}
export function number(description: string): ScalarParameter {
    return { type: 'number', description };
}
export function integer(description: string): ScalarParameter {
    return { type: 'integer', description };
}
export function flag(description: string): ScalarParameter {
    return { type: 'boolean', description };
}
function list(description: string, itemType: ScalarParameterType, length?: number): ListParameter {
    return { type: 'array', description, items: { type: itemType }, minItems: length ?? 1, maxItems: length };
}
export function vector(description: string, length = 3): ListParameter {
    return list(description, 'number', length);
}
export function integerList(description: string): ListParameter {
    return list(description, 'integer');
}
export function textList(description: string): ListParameter {
    return list(description, 'string');
}
