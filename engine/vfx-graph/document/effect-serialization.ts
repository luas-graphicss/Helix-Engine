import type { BlockValue, BlockValues } from './block-values';
import { canFlow, CONTEXT_KINDS, VFX_GRAPH_FORMAT, VFX_GRAPH_VERSION, type ContextKind, type EffectBlock, type EffectContext, type FlowLink, type VfxGraphDocument, } from './effect-document';
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isContextKind(value: unknown): value is ContextKind {
    return CONTEXT_KINDS.some((kind) => kind === value);
}
function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}
function parseValue(value: unknown): BlockValue | null {
    if (typeof value === 'string' || isFiniteNumber(value))
        return value;
    if (!Array.isArray(value))
        return null;
    const components: readonly unknown[] = value;
    return components.every(isFiniteNumber) ? components : null;
}
function parseValues(value: unknown): BlockValues {
    if (!isRecord(value))
        return {};
    return Object.fromEntries(Object.entries(value).flatMap(([key, raw]) => {
        const parsed = parseValue(raw);
        return parsed === null ? [] : [[key, parsed] as const];
    }));
}
function parseBlock(value: unknown, takenIds: Set<string>): EffectBlock | null {
    if (!isRecord(value) || typeof value.id !== 'string' || typeof value.type !== 'string' || takenIds.has(value.id))
        return null;
    takenIds.add(value.id);
    return { id: value.id, type: value.type, enabled: value.enabled !== false, values: parseValues(value.values) };
}
function parseContext(value: unknown, takenContextIds: Set<string>, takenBlockIds: Set<string>): EffectContext | null {
    if (!isRecord(value) || typeof value.id !== 'string' || !isContextKind(value.kind) || takenContextIds.has(value.id))
        return null;
    if (!isFiniteNumber(value.x) || !isFiniteNumber(value.y))
        return null;
    takenContextIds.add(value.id);
    const rawBlocks: readonly unknown[] = Array.isArray(value.blocks) ? value.blocks : [];
    const blocks = rawBlocks.flatMap((block) => parseBlock(block, takenBlockIds) ?? []);
    return { id: value.id, kind: value.kind, x: value.x, y: value.y, values: parseValues(value.values), blocks };
}
function parseLinks(value: unknown, contexts: readonly EffectContext[]): FlowLink[] {
    const rawLinks: readonly unknown[] = Array.isArray(value) ? value : [];
    const kinds = new Map(contexts.map((context) => [context.id, context.kind]));
    const takenIds = new Set<string>();
    const fedContexts = new Set<string>();
    const links: FlowLink[] = [];
    for (const raw of rawLinks) {
        if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.from !== 'string' || typeof raw.to !== 'string')
            continue;
        const from = kinds.get(raw.from);
        const to = kinds.get(raw.to);
        if (!from || !to || !canFlow(from, to) || takenIds.has(raw.id) || fedContexts.has(raw.to))
            continue;
        takenIds.add(raw.id);
        fedContexts.add(raw.to);
        links.push({ id: raw.id, from: raw.from, to: raw.to });
    }
    return links;
}
export function parseEffectGraph(value: unknown): VfxGraphDocument | null {
    if (!isRecord(value) || value.format !== VFX_GRAPH_FORMAT || value.version !== VFX_GRAPH_VERSION || !Array.isArray(value.contexts))
        return null;
    const rawContexts: readonly unknown[] = value.contexts;
    const takenContextIds = new Set<string>();
    const takenBlockIds = new Set<string>();
    const contexts = rawContexts.flatMap((context) => parseContext(context, takenContextIds, takenBlockIds) ?? []);
    return { format: VFX_GRAPH_FORMAT, version: VFX_GRAPH_VERSION, contexts, links: parseLinks(value.links, contexts) };
}
