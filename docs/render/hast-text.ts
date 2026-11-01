import type { Element, Nodes } from 'hast';
export function hastText(node: Nodes | undefined): string {
    if (!node)
        return '';
    if (node.type === 'text')
        return node.value;
    if ('children' in node)
        return node.children.map((child) => hastText(child)).join('');
    return '';
}
export function isSoleImageParagraph(paragraph: Element | undefined): boolean {
    if (!paragraph)
        return false;
    const content = paragraph.children.filter((child) => !(child.type === 'text' && child.value.trim().length === 0));
    const [only] = content;
    return content.length === 1 && only.type === 'element' && only.tagName === 'img';
}
export function codeLanguageOf(pre: Element | undefined): string | null {
    const code = pre?.children.find((child): child is Element => child.type === 'element' && child.tagName === 'code');
    if (!code)
        return null;
    const raw = code.properties.className ?? code.properties.class;
    const classes = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/\s+/) : [];
    for (const entry of classes) {
        if (typeof entry === 'string' && entry.startsWith('language-'))
            return entry.slice('language-'.length);
    }
    return null;
}
