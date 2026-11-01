export interface KeyChord {
    readonly ctrl: boolean;
    readonly shift: boolean;
    readonly alt: boolean;
    readonly key: string;
}
const CODE_KEYS: Readonly<Record<string, string>> = {
    BracketLeft: '[',
    BracketRight: ']',
    Quote: "'",
    Semicolon: ';',
    Comma: ',',
    Period: '.',
    Slash: '/',
    Backslash: '\\',
    Backquote: '`',
    Minus: '-',
    Equal: '=',
    NumpadAdd: '+',
    NumpadSubtract: '-',
    NumpadMultiply: '*',
    NumpadDivide: '/',
    NumpadDecimal: '.',
    NumpadEnter: 'enter',
    Space: 'space',
};
const MODIFIER_KEYS = new Set(['control', 'shift', 'alt', 'meta', 'os', 'altgraph', 'capslock', 'numlock', 'scrolllock', 'fn']);
const KEY_LABELS: Readonly<Record<string, string>> = {
    space: 'Espaço',
    arrowup: '↑',
    arrowdown: '↓',
    arrowleft: '←',
    arrowright: '→',
    escape: 'Esc',
    delete: 'Del',
    backspace: 'Backspace',
    enter: 'Enter',
    tab: 'Tab',
    home: 'Home',
    end: 'End',
    pageup: 'PgUp',
    pagedown: 'PgDn',
    insert: 'Ins',
    contextmenu: 'Menu',
};
export function physicalKey(event: KeyboardEvent): string {
    const { code } = event;
    if (code.length === 4 && code.startsWith('Key'))
        return code.slice(3).toLowerCase();
    if (code.length === 6 && code.startsWith('Digit'))
        return code.slice(5);
    if (code.length === 7 && code.startsWith('Numpad') && code[6] >= '0' && code[6] <= '9')
        return code.slice(6);
    const mapped = CODE_KEYS[code];
    if (mapped)
        return mapped;
    const key = event.key.toLowerCase();
    return key === ' ' ? 'space' : key;
}
export function isModifierOnly(event: KeyboardEvent): boolean {
    return MODIFIER_KEYS.has(event.key.toLowerCase());
}
export function chordFromEvent(event: KeyboardEvent): KeyChord {
    return { ctrl: event.ctrlKey || event.metaKey, shift: event.shiftKey, alt: event.altKey, key: physicalKey(event) };
}
export function serializeChord(chord: KeyChord): string {
    const parts: string[] = [];
    if (chord.ctrl)
        parts.push('ctrl');
    if (chord.shift)
        parts.push('shift');
    if (chord.alt)
        parts.push('alt');
    parts.push(chord.key);
    return parts.join(' ');
}
export function parseChord(text: string): KeyChord | null {
    const parts = text.trim().toLowerCase().split(/\s+/);
    const key = parts.pop();
    if (!key)
        return null;
    const chord = { ctrl: false, shift: false, alt: false, key };
    for (const part of parts) {
        if (part === 'ctrl')
            chord.ctrl = true;
        else if (part === 'shift')
            chord.shift = true;
        else if (part === 'alt')
            chord.alt = true;
        else
            return null;
    }
    return chord;
}
export function chordKeyLabel(key: string): string {
    const label = KEY_LABELS[key];
    if (label)
        return label;
    if (/^f\d{1,2}$/.test(key))
        return key.toUpperCase();
    return key.length === 1 ? key.toUpperCase() : key;
}
export function formatChord(chord: KeyChord | string): string {
    const parsed = typeof chord === 'string' ? parseChord(chord) : chord;
    if (!parsed)
        return '';
    const parts: string[] = [];
    if (parsed.ctrl)
        parts.push('Ctrl');
    if (parsed.shift)
        parts.push('Shift');
    if (parsed.alt)
        parts.push('Alt');
    parts.push(chordKeyLabel(parsed.key));
    return parts.join('+');
}
export function chordParts(chord: string): string[] {
    const parsed = parseChord(chord);
    if (!parsed)
        return [];
    const parts: string[] = [];
    if (parsed.ctrl)
        parts.push('Ctrl');
    if (parsed.shift)
        parts.push('Shift');
    if (parsed.alt)
        parts.push('Alt');
    parts.push(chordKeyLabel(parsed.key));
    return parts;
}
