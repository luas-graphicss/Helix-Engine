import type { GraphLink, GraphNode, ShaderGraphDocument, SocketRef } from '../document/graph-document';
export function socketKey(ref: SocketRef): string {
    return `${ref.node}:${ref.socket}`;
}
export function indexIncomingLinks(links: readonly GraphLink[]): Map<string, GraphLink> {
    return new Map(links.map((link) => [socketKey(link.to), link]));
}
export function evaluationOrder(document: ShaderGraphDocument, rootId: string): GraphNode[] | null {
    const nodes = new Map(document.nodes.map((node) => [node.id, node]));
    const upstream = new Map<string, string[]>();
    for (const link of document.links) {
        const sources = upstream.get(link.to.node) ?? [];
        sources.push(link.from.node);
        upstream.set(link.to.node, sources);
    }
    const order: GraphNode[] = [];
    const state = new Map<string, 'visiting' | 'done'>();
    const visit = (id: string): boolean => {
        const node = nodes.get(id);
        if (!node || state.get(id) === 'done')
            return true;
        if (state.get(id) === 'visiting')
            return false;
        state.set(id, 'visiting');
        for (const source of upstream.get(id) ?? []) {
            if (!visit(source))
                return false;
        }
        state.set(id, 'done');
        order.push(node);
        return true;
    };
    return visit(rootId) ? order : null;
}
