import type { JsonValue } from '@/engine/net/protocol';
export function parseTestTicket(text: string): JsonValue | null {
    const trimmed = text.trim();
    if (!trimmed)
        return null;
    try {
        return JSON.parse(trimmed) as JsonValue;
    }
    catch {
        return trimmed;
    }
}
