import type { ShaderModel } from '@/engine/renderer/shaders/custom/custom-shader.glsl';
export const SHADER_GRAPH_FORMAT = 'helix-shader-graph';
export const SHADER_GRAPH_VERSION = 1;
export type GraphValue = number | string | readonly number[];
export interface GraphNode {
    readonly id: string;
    readonly type: string;
    readonly x: number;
    readonly y: number;
    readonly values: Readonly<Record<string, GraphValue>>;
}
export interface SocketRef {
    readonly node: string;
    readonly socket: string;
}
export interface GraphLink {
    readonly id: string;
    readonly from: SocketRef;
    readonly to: SocketRef;
}
export interface ShaderGraphDocument {
    readonly format: typeof SHADER_GRAPH_FORMAT;
    readonly version: typeof SHADER_GRAPH_VERSION;
    readonly model: ShaderModel;
    readonly nodes: readonly GraphNode[];
    readonly links: readonly GraphLink[];
}
export const OUTPUT_NODE_TYPE: Record<ShaderModel, string> = { surface: 'output-surface', post: 'output-post' };
const OUTPUT_NODE_X = 640;
const OUTPUT_NODE_Y = 160;
export function isOutputNode(node: GraphNode): boolean {
    return node.type === OUTPUT_NODE_TYPE.surface || node.type === OUTPUT_NODE_TYPE.post;
}
function unusedId(prefix: string, taken: ReadonlySet<string>): string {
    let index = taken.size + 1;
    while (taken.has(`${prefix}${index}`))
        index++;
    return `${prefix}${index}`;
}
export function createShaderGraph(model: ShaderModel): ShaderGraphDocument {
    return {
        format: SHADER_GRAPH_FORMAT,
        version: SHADER_GRAPH_VERSION,
        model,
        nodes: [{ id: 'n1', type: OUTPUT_NODE_TYPE[model], x: OUTPUT_NODE_X, y: OUTPUT_NODE_Y, values: {} }],
        links: [],
    };
}
export function findNode(document: ShaderGraphDocument, id: string): GraphNode | null {
    return document.nodes.find((node) => node.id === id) ?? null;
}
export function addNode(document: ShaderGraphDocument, type: string, x: number, y: number): {
    document: ShaderGraphDocument;
    nodeId: string;
} {
    const nodeId = unusedId('n', new Set(document.nodes.map((node) => node.id)));
    return { document: { ...document, nodes: [...document.nodes, { id: nodeId, type, x, y, values: {} }] }, nodeId };
}
export function removeNodes(document: ShaderGraphDocument, ids: ReadonlySet<string>): ShaderGraphDocument {
    const removed = new Set(document.nodes.filter((node) => ids.has(node.id) && !isOutputNode(node)).map((node) => node.id));
    if (removed.size === 0)
        return document;
    return {
        ...document,
        nodes: document.nodes.filter((node) => !removed.has(node.id)),
        links: document.links.filter((link) => !removed.has(link.from.node) && !removed.has(link.to.node)),
    };
}
export function moveNodes(document: ShaderGraphDocument, ids: ReadonlySet<string>, deltaX: number, deltaY: number): ShaderGraphDocument {
    if (ids.size === 0 || (deltaX === 0 && deltaY === 0))
        return document;
    return { ...document, nodes: document.nodes.map((node) => (ids.has(node.id) ? { ...node, x: node.x + deltaX, y: node.y + deltaY } : node)) };
}
export function setNodeValue(document: ShaderGraphDocument, nodeId: string, key: string, value: GraphValue): ShaderGraphDocument {
    return { ...document, nodes: document.nodes.map((node) => (node.id === nodeId ? { ...node, values: { ...node.values, [key]: value } } : node)) };
}
export function linkInto(document: ShaderGraphDocument, target: SocketRef): GraphLink | null {
    return document.links.find((link) => link.to.node === target.node && link.to.socket === target.socket) ?? null;
}
function dependsOn(document: ShaderGraphDocument, nodeId: string, ancestorId: string): boolean {
    const pending = [nodeId];
    const visited = new Set<string>();
    while (pending.length > 0) {
        const current = pending.pop();
        if (current === undefined || visited.has(current))
            continue;
        if (current === ancestorId)
            return true;
        visited.add(current);
        for (const link of document.links) {
            if (link.to.node === current)
                pending.push(link.from.node);
        }
    }
    return false;
}
export function connect(document: ShaderGraphDocument, from: SocketRef, to: SocketRef): ShaderGraphDocument {
    if (from.node === to.node || dependsOn(document, from.node, to.node))
        return document;
    const existing = linkInto(document, to);
    if (existing && existing.from.node === from.node && existing.from.socket === from.socket)
        return document;
    const kept = document.links.filter((link) => link !== existing);
    const id = unusedId('l', new Set(kept.map((link) => link.id)));
    return { ...document, links: [...kept, { id, from, to }] };
}
export function disconnect(document: ShaderGraphDocument, linkId: string): ShaderGraphDocument {
    const links = document.links.filter((link) => link.id !== linkId);
    return links.length === document.links.length ? document : { ...document, links };
}
