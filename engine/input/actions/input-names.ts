export const MAX_INPUT_NAME_LENGTH = 48;
const RESERVED_NAME_CHARACTERS = /[/<>{}#]/g;
export function sanitizeInputName(name: string): string {
    return name.replace(RESERVED_NAME_CHARACTERS, '').replace(/\s+/g, ' ').trim().slice(0, MAX_INPUT_NAME_LENGTH);
}
export function uniqueName(base: string, taken: readonly string[]): string {
    if (!taken.includes(base))
        return base;
    let suffix = 2;
    while (taken.includes(`${base} ${suffix}`))
        suffix++;
    return `${base} ${suffix}`;
}
