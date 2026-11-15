import { ToolFailure } from './tool-failure';
function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}
function isText(value: unknown): value is string {
    return typeof value === 'string';
}
function numberFrom(value: unknown): number | undefined {
    if (isFiniteNumber(value))
        return value;
    if (!isText(value) || value.trim() === '')
        return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}
export class ToolInput {
    constructor(private readonly values: Readonly<Record<string, unknown>>) { }
    has(key: string): boolean {
        return this.read(key) !== undefined;
    }
    text(key: string): string {
        return this.demand(key, this.optionalText(key));
    }
    optionalText(key: string): string | undefined {
        const value = this.read(key);
        if (value === undefined)
            return undefined;
        if (!isText(value))
            throw new ToolFailure(`"${key}" must be a string.`);
        return value;
    }
    optionalNumber(key: string): number | undefined {
        const value = this.read(key);
        if (value === undefined)
            return undefined;
        const parsed = numberFrom(value);
        if (parsed === undefined)
            throw new ToolFailure(`"${key}" must be a finite number.`);
        return parsed;
    }
    integer(key: string): number {
        return this.demand(key, this.optionalInteger(key));
    }
    optionalInteger(key: string): number | undefined {
        const value = this.optionalNumber(key);
        if (value !== undefined && !Number.isInteger(value))
            throw new ToolFailure(`"${key}" must be an integer.`);
        return value;
    }
    optionalFlag(key: string): boolean | undefined {
        const value = this.read(key);
        if (value === undefined)
            return undefined;
        if (typeof value !== 'boolean')
            throw new ToolFailure(`"${key}" must be true or false.`);
        return value;
    }
    choice<TOption extends string>(key: string, options: readonly TOption[]): TOption {
        return this.demand(key, this.optionalChoice(key, options));
    }
    optionalChoice<TOption extends string>(key: string, options: readonly TOption[]): TOption | undefined {
        const value = this.optionalText(key);
        if (value === undefined)
            return undefined;
        const match = options.find((option) => option === value);
        if (match === undefined)
            throw new ToolFailure(`"${key}" must be one of: ${options.join(', ')}.`);
        return match;
    }
    optionalVector(key: string, length = 3): number[] | undefined {
        const value = this.read(key);
        if (value === undefined)
            return undefined;
        if (!Array.isArray(value) || value.length !== length || !value.every(isFiniteNumber))
            throw new ToolFailure(`"${key}" must be an array of ${length} numbers.`);
        return value;
    }
    integers(key: string): number[] {
        const value = this.read(key);
        if (!Array.isArray(value) || value.length === 0 || !value.every(isFiniteNumber) || !value.every(Number.isInteger))
            throw new ToolFailure(`"${key}" must be a non-empty array of integers.`);
        return value;
    }
    texts(key: string): string[] {
        const value = this.read(key);
        if (!Array.isArray(value) || value.length === 0 || !value.every(isText))
            throw new ToolFailure(`"${key}" must be a non-empty array of strings.`);
        return value;
    }
    private read(key: string): unknown {
        const value = Object.hasOwn(this.values, key) ? this.values[key] : undefined;
        return value === null ? undefined : value;
    }
    private demand<TValue>(key: string, value: TValue | undefined): TValue {
        if (value === undefined)
            throw new ToolFailure(`"${key}" is required.`);
        return value;
    }
}
