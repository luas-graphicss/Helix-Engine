import type { GraphValue } from './graph-document';
export function numbersOf(value: GraphValue | undefined, fallback: readonly number[]): readonly number[] {
    if (typeof value === 'number')
        return [value];
    if (typeof value === 'object')
        return value;
    return fallback;
}
export function numberOf(value: GraphValue | undefined, fallback: number): number {
    return typeof value === 'number' ? value : fallback;
}
export function textOf(value: GraphValue | undefined, fallback: string): string {
    return typeof value === 'string' ? value : fallback;
}
