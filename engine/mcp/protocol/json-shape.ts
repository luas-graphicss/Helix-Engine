export type JsonRecord = Readonly<Record<string, unknown>>;
export function isRecord(value: unknown): value is JsonRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function isText(value: unknown): value is string {
    return typeof value === 'string';
}
export function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}
export function isTextList(value: unknown): value is string[] {
    return Array.isArray(value) && value.every(isText);
}
