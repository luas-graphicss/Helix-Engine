const ENTRY_KEY_PATTERN = /^[\p{L}\p{N}_][\p{L}\p{N}_./-]*$/u;
const GROUP_SEPARATOR = '.';
export const MAX_ENTRY_KEY_LENGTH = 96;
export function normalizeEntryKey(value: unknown): string | null {
    if (typeof value !== 'string')
        return null;
    const key = value.trim();
    return key.length <= MAX_ENTRY_KEY_LENGTH && ENTRY_KEY_PATTERN.test(key) ? key : null;
}
export function entryGroup(key: string): string {
    const separator = key.indexOf(GROUP_SEPARATOR);
    return separator > 0 ? key.slice(0, separator) : '';
}
export function uniqueEntryKey(taken: ReadonlySet<string>, base: string): string {
    if (!taken.has(base))
        return base;
    let suffix = 2;
    while (taken.has(`${base}-${suffix}`))
        suffix++;
    return `${base}-${suffix}`;
}
