import type { SearchRecord } from '../content/docs-content';
export interface SearchHit {
    readonly record: SearchRecord;
    readonly heading: {
        readonly id: string;
        readonly text: string;
    } | null;
    readonly score: number;
}
export function normalizeSearchText(text: string): string {
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}
function tokenize(query: string): string[] {
    return normalizeSearchText(query)
        .split(/[\s,.;:/()[\]{}"']+/)
        .filter((token) => token.length > 1);
}
export function searchRecords(records: readonly SearchRecord[], query: string, limit = 12): SearchHit[] {
    const tokens = tokenize(query);
    if (tokens.length === 0)
        return [];
    const phrase = normalizeSearchText(query.trim());
    const hits: SearchHit[] = [];
    for (const record of records) {
        const title = normalizeSearchText(record.title);
        const description = normalizeSearchText(record.description);
        const text = normalizeSearchText(record.text ?? record.excerpt ?? '');
        const category = normalizeSearchText(record.categoryLabel);
        const headings = record.headings.map((heading) => ({ ...heading, normalized: normalizeSearchText(heading.text) }));
        let score = 0;
        let matchedHeading: SearchHit['heading'] = null;
        let allTokensFound = true;
        for (const token of tokens) {
            let tokenScore = 0;
            if (title.includes(token))
                tokenScore += title.startsWith(token) ? 12 : 8;
            const heading = headings.find((entry) => entry.normalized.includes(token));
            if (heading) {
                tokenScore += 5;
                matchedHeading ??= { id: heading.id, text: heading.text };
            }
            if (category.includes(token))
                tokenScore += 3;
            if (description.includes(token))
                tokenScore += 3;
            if (text.includes(token))
                tokenScore += 1;
            if (tokenScore === 0) {
                allTokensFound = false;
                break;
            }
            score += tokenScore;
        }
        if (!allTokensFound)
            continue;
        if (phrase.length > 2 && title.includes(phrase))
            score += 10;
        if (title === phrase)
            score += 20;
        hits.push({ record, heading: title.includes(tokens[0]) ? null : matchedHeading, score });
    }
    hits.sort((a, b) => b.score - a.score || a.record.title.localeCompare(b.record.title, 'pt-BR'));
    return hits.slice(0, limit);
}
