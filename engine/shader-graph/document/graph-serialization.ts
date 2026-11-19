import { SHADER_MODELS } from '@/engine/renderer/shaders/custom/custom-shader.glsl';
import { OUTPUT_NODE_TYPE, SHADER_GRAPH_FORMAT, SHADER_GRAPH_VERSION, type GraphLink, type GraphNode, type GraphValue, type ShaderGraphDocument, type SocketRef, } from './graph-document';
export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}
function parseValue(value: unknown): GraphValue | null {
    if (typeof value === 'string' || isFiniteNumber(value))
        return value;
    if (Array.isArray(value) && value.every(isFiniteNumber))
        return value;
    return null;
}
function parseNode(value: unknown): GraphNode | null {
    if (!isRecord(value) || typeof value.id !== 'string' || typeof value.type !== 'string')
        return null;
    if (!isFiniteNumber(value.x) || !isFiniteNumber(value.y) || !isRecord(value.values))
        return null;
    const values: Record<string, GraphValue> = {};
    for (const [key, raw] of Object.entries(value.values)) {
        const parsed = parseValue(raw);
        if (parsed !== null)
            values[key] = parsed;
    }
    return { id: value.id, type: value.type, x: value.x, y: value.y, values };
}
function parseSocketRef(value: unknown): SocketRef | null {
    if (!isRecord(value) || typeof value.node !== 'string' || typeof value.socket !== 'string')
        return null;
    return { node: value.node, socket: value.socket };
}
function parseLink(value: unknown): GraphLink | null {
    if (!isRecord(value) || typeof value.id !== 'string')
        return null;
    const from = parseSocketRef(value.from);
    const to = parseSocketRef(value.to);
    return from && to ? { id: value.id, from, to } : null;
}
export function parseShaderGraph(value: unknown): ShaderGraphDocument | null {
    if (!isRecord(value) || value.format !== SHADER_GRAPH_FORMAT || value.version !== SHADER_GRAPH_VERSION)
        return null;
    const model = SHADER_MODELS.find((candidate) => candidate === value.model);
    if (!model || !Array.isArray(value.nodes) || !Array.isArray(value.links))
        return null;
    const nodes: GraphNode[] = [];
    for (const raw of value.nodes) {
        const node = parseNode(raw);
        if (!node)
            return null;
        nodes.push(node);
    }
    if (!nodes.some((node) => node.type === OUTPUT_NODE_TYPE[model]))
        return null;
    const nodeIds = new Set(nodes.map((node) => node.id));
    const links: GraphLink[] = [];
    for (const raw of value.links) {
        const link = parseLink(raw);
        if (link && nodeIds.has(link.from.node) && nodeIds.has(link.to.node))
            links.push(link);
    }
    return { format: SHADER_GRAPH_FORMAT, version: SHADER_GRAPH_VERSION, model, nodes, links };
}
