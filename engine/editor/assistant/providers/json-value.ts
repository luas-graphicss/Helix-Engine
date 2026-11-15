export type JsonRecord = Record<string, unknown>;
export function isRecord(value: unknown): value is JsonRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function recordsOf(value: unknown): JsonRecord[] {
    return Array.isArray(value) ? value.filter(isRecord) : [];
}
export function parseJson(text: string): unknown {
    try {
        return JSON.parse(text);
    }
    catch {
        return undefined;
    }
}
