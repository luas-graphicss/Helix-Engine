export interface ArticleFrontmatter {
    readonly title: string;
    readonly description: string;
    readonly order: number;
}
export interface ParsedMarkdown {
    readonly frontmatter: ArticleFrontmatter;
    readonly body: string;
}
const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
function unquote(value: string): string {
    const trimmed = value.trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'")))
        return trimmed.slice(1, -1);
    return trimmed;
}
export function parseMarkdownDocument(source: string, filePath: string): ParsedMarkdown {
    const match = FRONTMATTER_PATTERN.exec(source);
    if (!match)
        throw new Error(`${filePath}: o artigo precisa começar com um cabeçalho entre linhas "---".`);
    const fields = new Map<string, string>();
    for (const line of match[1].split(/\r?\n/)) {
        const separator = line.indexOf(':');
        if (separator === -1)
            continue;
        fields.set(line.slice(0, separator).trim(), unquote(line.slice(separator + 1)));
    }
    const title = fields.get('title');
    if (!title)
        throw new Error(`${filePath}: o cabeçalho precisa de "title".`);
    const order = Number(fields.get('order') ?? '0');
    if (!Number.isFinite(order))
        throw new Error(`${filePath}: "order" precisa ser um número.`);
    return {
        frontmatter: { title, description: fields.get('description') ?? '', order },
        body: source.slice(match[0].length),
    };
}
