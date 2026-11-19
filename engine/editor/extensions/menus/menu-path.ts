const MAX_SEGMENTS = 5;
const MAX_SEGMENT_LENGTH = 48;
const DIACRITICS = /[\u0300-\u036f]/g;
export function menuLabelKey(label: string): string {
    return label.normalize('NFD').replace(DIACRITICS, '').toLowerCase();
}
export function parseMenuPath(text: string): string[] | null {
    const segments = text.split('/').map((segment) => segment.trim());
    if (segments.length > MAX_SEGMENTS || segments.some((segment) => segment.length === 0 || segment.length > MAX_SEGMENT_LENGTH))
        return null;
    return segments;
}
