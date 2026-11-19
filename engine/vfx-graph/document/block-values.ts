export type BlockValue = number | string | readonly number[];
export type BlockValues = Readonly<Record<string, BlockValue>>;
export function numberOf(value: BlockValue | undefined, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
export function numbersOf(value: BlockValue | undefined, fallback: readonly number[]): readonly number[] {
    return typeof value === 'object' && value.length === fallback.length ? value : fallback;
}
export function textOf(value: BlockValue | undefined, fallback: string): string {
    return typeof value === 'string' ? value : fallback;
}
