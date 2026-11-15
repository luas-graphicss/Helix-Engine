import { isRecord, recordsOf, type JsonRecord } from './json-value';
function modelIdOf(model: JsonRecord): string[] {
    if (typeof model.id === 'string')
        return [model.id];
    return typeof model.name === 'string' ? [model.name] : [];
}
export function readModelIds(payload: unknown): string[] {
    const models = isRecord(payload) ? (payload.data ?? payload.models) : payload;
    const ids = new Set(recordsOf(models).flatMap(modelIdOf));
    return Array.from(ids).sort((a, b) => a.localeCompare(b));
}
