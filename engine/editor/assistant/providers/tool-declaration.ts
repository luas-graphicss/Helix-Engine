export type ScalarParameterType = 'string' | 'number' | 'integer' | 'boolean';
export interface ScalarParameter {
    readonly type: ScalarParameterType;
    readonly description: string;
    readonly enum?: readonly string[];
}
export interface ListParameter {
    readonly type: 'array';
    readonly description: string;
    readonly items: {
        readonly type: ScalarParameterType;
    };
    readonly minItems?: number;
    readonly maxItems?: number;
}
export type ToolParameter = ScalarParameter | ListParameter;
export interface ToolParameters {
    readonly type: 'object';
    readonly properties: Readonly<Record<string, ToolParameter>>;
    readonly required: readonly string[];
}
export interface ToolDeclaration {
    readonly name: string;
    readonly description: string;
    readonly parameters: ToolParameters;
}
