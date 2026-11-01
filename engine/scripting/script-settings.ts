export type ScriptPropValue = string | number | boolean | null | ScriptPropValue[] | {
    [key: string]: ScriptPropValue;
};
export interface ScriptSettings {
    assetId: string | null;
    enabled: boolean;
    props: Record<string, ScriptPropValue>;
    executionOrder: number;
}
export function createScriptSettings(options: Partial<ScriptSettings> = {}): ScriptSettings {
    return {
        assetId: options.assetId ?? null,
        enabled: options.enabled ?? true,
        props: options.props ? JSON.parse(JSON.stringify(options.props)) as Record<string, ScriptPropValue> : {},
        executionOrder: options.executionOrder ?? 0,
    };
}
