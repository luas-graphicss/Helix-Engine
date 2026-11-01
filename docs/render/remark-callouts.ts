import type { Blockquote, Parent, Root, RootContent } from 'mdast';
export const CALLOUT_KINDS = ['note', 'tip', 'important', 'warning', 'caution'] as const;
export type CalloutKind = (typeof CALLOUT_KINDS)[number];
const MARKER_PATTERN = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:[ \t]+([^\n]+))?(?:\n|$)/;
function isParent(node: RootContent | Root): node is Parent & (RootContent | Root) {
    return 'children' in node && Array.isArray(node.children);
}
function toCallout(blockquote: Blockquote): void {
    const [first] = blockquote.children;
    if (!first || first.type !== 'paragraph')
        return;
    const [lead] = first.children;
    if (!lead || lead.type !== 'text')
        return;
    const match = MARKER_PATTERN.exec(lead.value);
    if (!match)
        return;
    const kind = match[1].toLowerCase() as CalloutKind;
    const title = match[2]?.trim();
    lead.value = lead.value.slice(match[0].length);
    if (lead.value.length === 0)
        first.children.shift();
    if (first.children.length === 0)
        blockquote.children.shift();
    blockquote.data = {
        ...blockquote.data,
        hName: 'aside',
        hProperties: { 'data-callout': kind, ...(title ? { 'data-title': title } : {}) },
    };
}
function visit(node: RootContent | Root): void {
    if (node.type === 'blockquote')
        toCallout(node);
    if (isParent(node))
        for (const child of node.children)
            visit(child);
}
export function remarkCallouts() {
    return (tree: Root) => {
        visit(tree);
    };
}
