export function normalizeSearchText(text: string): string {
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}
export function searchWords(query: string): string[] {
    return normalizeSearchText(query).split(/\s+/).filter(Boolean);
}
export function matchesAllWords(haystack: string, words: readonly string[]): boolean {
    return words.every((word) => haystack.includes(word));
}
