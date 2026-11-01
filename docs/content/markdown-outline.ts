export interface OutlineEntry {
    readonly id: string;
    readonly text: string;
    readonly level: 2 | 3;
}
export function slugify(text: string): string {
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/[\s-]+/g, '-');
}
export function plainHeadingText(markdown: string): string {
    return markdown
        .replace(/`([^`]*)`/g, '$1')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/[*_~]+/g, '')
        .trim();
}
export class SlugCounter {
    private readonly seen = new Map<string, number>();
    next(text: string): string {
        const base = slugify(text) || 'secao';
        const count = this.seen.get(base) ?? 0;
        this.seen.set(base, count + 1);
        return count === 0 ? base : `${base}-${count}`;
    }
}
const HEADING_PATTERN = /^(#{2,3})\s+(.+?)\s*#*\s*$/;
const FENCE_PATTERN = /^(```|~~~)/;
const IMAGE_PATTERN = /!\[[^\]]*\]\([^)]*\)/g;
export function extractOutline(body: string): OutlineEntry[] {
    const entries: OutlineEntry[] = [];
    const slugs = new SlugCounter();
    let insideFence = false;
    for (const line of body.split(/\r?\n/)) {
        if (FENCE_PATTERN.test(line)) {
            insideFence = !insideFence;
            continue;
        }
        if (insideFence)
            continue;
        const match = HEADING_PATTERN.exec(line);
        if (!match)
            continue;
        const text = plainHeadingText(match[2]);
        entries.push({ id: slugs.next(text), text, level: match[1].length as 2 | 3 });
    }
    return entries;
}
export function searchableText(body: string): string {
    return body
        .replace(/^(```|~~~)[^\n]*$/gm, ' ')
        .split(/\r?\n/)
        .filter((line) => !/^\s*\|?\s*:?-{3,}/.test(line))
        .join(' ')
        .replace(/\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/g, ' ')
        .replace(IMAGE_PATTERN, ' ')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/[`|*_~#>]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
export function plainBodyText(body: string, maxLength = 600): string {
    const withoutFences = body.replace(/```[\s\S]*?```/g, ' ');
    const text = withoutFences
        .split(/\r?\n/)
        .filter((line) => !/^\s*(#|\||>|-{3,}|\*{3,})/.test(line))
        .join(' ')
        .replace(IMAGE_PATTERN, ' ')
        .replace(/`([^`]*)`/g, '$1')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/[*_~#>]+/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}…` : text;
}
