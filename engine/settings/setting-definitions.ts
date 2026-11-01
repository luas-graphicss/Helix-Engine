interface SettingBase<T> {
    readonly label: string;
    readonly description: string;
    readonly default: T;
    readonly requiresReopen?: boolean;
}
export interface BooleanSetting extends SettingBase<boolean> {
    readonly type: 'boolean';
}
export interface NumberSetting extends SettingBase<number> {
    readonly type: 'number';
    readonly min: number;
    readonly max: number;
    readonly step: number;
    readonly unit?: string;
    readonly scale?: 'linear' | 'log';
    readonly decimals?: number;
}
export interface SelectOption<T extends string> {
    readonly value: T;
    readonly label: string;
    readonly hint?: string;
}
export interface SelectSetting<T extends string = string> extends SettingBase<T> {
    readonly type: 'select';
    readonly options: readonly SelectOption<T>[];
}
export interface TextSetting extends SettingBase<string> {
    readonly type: 'text';
    readonly maxLength: number;
    readonly placeholder?: string;
    readonly monospace?: boolean;
}
export type SettingDefinition = BooleanSetting | NumberSetting | SelectSetting | TextSetting;
export function booleanSetting(definition: Omit<BooleanSetting, 'type'>): BooleanSetting {
    return { type: 'boolean', ...definition };
}
export function numberSetting(definition: Omit<NumberSetting, 'type'>): NumberSetting {
    return { type: 'number', ...definition };
}
export function selectSetting<const T extends string>(definition: Omit<SelectSetting<T>, 'type'> & {
    readonly default: NoInfer<T>;
}): SelectSetting<T> {
    return { type: 'select', ...definition };
}
export function textSetting(definition: Omit<TextSetting, 'type'>): TextSetting {
    return { type: 'text', ...definition };
}
export function coerceSettingValue(definition: SettingDefinition, value: unknown): boolean | number | string | undefined {
    switch (definition.type) {
        case 'boolean':
            return typeof value === 'boolean' ? value : undefined;
        case 'number': {
            if (typeof value !== 'number' || !Number.isFinite(value))
                return undefined;
            return Math.min(definition.max, Math.max(definition.min, value));
        }
        case 'select':
            return typeof value === 'string' && definition.options.some((option) => option.value === value) ? value : undefined;
        case 'text':
            return typeof value === 'string' ? value.trim().slice(0, definition.maxLength) : undefined;
    }
}
export function formatSettingNumber(definition: NumberSetting, value: number): string {
    const decimals = definition.decimals ?? (definition.step >= 1 ? 0 : definition.step >= 0.1 ? 1 : 2);
    return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: decimals })}${definition.unit ?? ''}`;
}
