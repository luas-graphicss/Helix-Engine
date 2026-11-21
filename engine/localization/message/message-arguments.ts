import type { MessageNode } from './message-ast';
export type ArgumentKind = 'text' | 'number' | 'date' | 'time' | 'list' | 'plural' | 'select';
export interface MessageArgument {
    readonly name: string;
    readonly kind: ArgumentKind;
    readonly choices: readonly string[];
}
const FALLBACK_CHOICE = 'other';
const UNTYPED_KIND: ArgumentKind = 'text';
export function walkMessage(nodes: readonly MessageNode[], visit: (node: MessageNode) => void): void {
    for (const node of nodes) {
        visit(node);
        if (node.type !== 'plural' && node.type !== 'select')
            continue;
        for (const branch of node.options.values())
            walkMessage(branch, visit);
        walkMessage(node.other, visit);
    }
}
function describeArgument(node: MessageNode): MessageArgument | null {
    switch (node.type) {
        case 'argument':
            return { name: node.name, kind: UNTYPED_KIND, choices: [] };
        case 'format':
            return { name: node.name, kind: node.format, choices: [] };
        case 'plural':
            return { name: node.name, kind: 'plural', choices: [] };
        case 'select':
            return { name: node.name, kind: 'select', choices: [...node.options.keys(), FALLBACK_CHOICE] };
        default:
            return null;
    }
}
export function collectArguments(nodes: readonly MessageNode[]): MessageArgument[] {
    const found = new Map<string, MessageArgument>();
    walkMessage(nodes, (node) => {
        const argument = describeArgument(node);
        if (argument !== null && (found.get(argument.name)?.kind ?? UNTYPED_KIND) === UNTYPED_KIND)
            found.set(argument.name, argument);
    });
    return [...found.values()];
}
export function argumentNames(nodes: readonly MessageNode[]): Set<string> {
    return new Set(collectArguments(nodes).map((argument) => argument.name));
}
