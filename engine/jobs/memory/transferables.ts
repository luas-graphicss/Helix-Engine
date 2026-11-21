import { isSharedBuffer } from './job-buffer';
const MAX_DEPTH = 6;
function childrenOf(value: object): Iterable<unknown> {
    if (Array.isArray(value) || value instanceof Set)
        return value;
    if (value instanceof Map)
        return [...value.keys(), ...value.values()];
    return Object.values(value);
}
function visit(value: unknown, depth: number, found: Set<ArrayBuffer>, seen: Set<object>): void {
    if (typeof value !== 'object' || value === null || depth > MAX_DEPTH || seen.has(value))
        return;
    seen.add(value);
    if (value instanceof ArrayBuffer) {
        found.add(value);
        return;
    }
    if (ArrayBuffer.isView(value)) {
        if (!isSharedBuffer(value.buffer))
            found.add(value.buffer);
        return;
    }
    for (const child of childrenOf(value))
        visit(child, depth + 1, found, seen);
}
export function collectTransferables(root: unknown): ArrayBuffer[] {
    const found = new Set<ArrayBuffer>();
    visit(root, 0, found, new Set());
    return Array.from(found).filter((buffer) => buffer.byteLength > 0);
}
