import { chordFromEvent, isModifierOnly, parseChord, serializeChord } from '@/engine/editor/shortcuts/key-chord';
const KEY_ALIASES: Readonly<Record<string, string>> = {
    control: 'ctrl',
    cmd: 'ctrl',
    command: 'ctrl',
    meta: 'ctrl',
    option: 'alt',
    esc: 'escape',
    del: 'delete',
    return: 'enter',
    up: 'arrowup',
    down: 'arrowdown',
    left: 'arrowleft',
    right: 'arrowright',
};
const MODIFIER_NAMES = new Set(['ctrl', 'shift', 'alt']);
function canonicalKeyName(part: string): string {
    return Object.hasOwn(KEY_ALIASES, part) ? KEY_ALIASES[part] : part;
}
export function normalizeShortcut(text: string): string | null {
    const parts = text
        .trim()
        .toLowerCase()
        .split(/[\s+]+/)
        .filter((part) => part.length > 0)
        .map(canonicalKeyName);
    const chord = parseChord(parts.join(' '));
    return chord && !MODIFIER_NAMES.has(chord.key) ? serializeChord(chord) : null;
}
export function eventChord(event: KeyboardEvent): string | null {
    return isModifierOnly(event) ? null : serializeChord(chordFromEvent(event));
}
