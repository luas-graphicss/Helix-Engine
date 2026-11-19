import type { BlockValue, BlockValues } from './block-values';
import { unusedId } from './unique-id';
export const VFX_GRAPH_FORMAT = 'helix-vfx-graph';
export const VFX_GRAPH_VERSION = 1;
export const CONTEXT_KINDS = ['spawn', 'initialize', 'update', 'output'] as const;
export type ContextKind = (typeof CONTEXT_KINDS)[number];
export interface EffectBlock {
    readonly id: string;
    readonly type: string;
    readonly enabled: boolean;
    readonly values: BlockValues;
}
export interface EffectContext {
    readonly id: string;
    readonly kind: ContextKind;
    readonly x: number;
    readonly y: number;
    readonly values: BlockValues;
    readonly blocks: readonly EffectBlock[];
}
export interface FlowLink {
    readonly id: string;
    readonly from: string;
    readonly to: string;
}
export interface VfxGraphDocument {
    readonly format: typeof VFX_GRAPH_FORMAT;
    readonly version: typeof VFX_GRAPH_VERSION;
    readonly contexts: readonly EffectContext[];
    readonly links: readonly FlowLink[];
}
const FLOW_TARGETS: Record<ContextKind, readonly ContextKind[]> = {
    spawn: ['initialize'],
    initialize: ['update', 'output'],
    update: ['output'],
    output: [],
};
export function createEffectGraph(): VfxGraphDocument {
    return { format: VFX_GRAPH_FORMAT, version: VFX_GRAPH_VERSION, contexts: [], links: [] };
}
export function findContext(document: VfxGraphDocument, id: string): EffectContext | null {
    return document.contexts.find((context) => context.id === id) ?? null;
}
export function canFlow(from: ContextKind, to: ContextKind): boolean {
    return FLOW_TARGETS[from].includes(to);
}
export function addContext(document: VfxGraphDocument, kind: ContextKind, x: number, y: number): {
    document: VfxGraphDocument;
    contextId: string;
} {
    const contextId = unusedId('c', new Set(document.contexts.map((context) => context.id)));
    return { document: { ...document, contexts: [...document.contexts, { id: contextId, kind, x, y, values: {}, blocks: [] }] }, contextId };
}
export function removeContexts(document: VfxGraphDocument, ids: ReadonlySet<string>): VfxGraphDocument {
    const contexts = document.contexts.filter((context) => !ids.has(context.id));
    if (contexts.length === document.contexts.length)
        return document;
    return { ...document, contexts, links: document.links.filter((link) => !ids.has(link.from) && !ids.has(link.to)) };
}
export function moveContexts(document: VfxGraphDocument, ids: ReadonlySet<string>, deltaX: number, deltaY: number): VfxGraphDocument {
    if (ids.size === 0 || (deltaX === 0 && deltaY === 0))
        return document;
    return { ...document, contexts: document.contexts.map((context) => (ids.has(context.id) ? { ...context, x: context.x + deltaX, y: context.y + deltaY } : context)) };
}
export function setContextValue(document: VfxGraphDocument, contextId: string, key: string, value: BlockValue): VfxGraphDocument {
    return { ...document, contexts: document.contexts.map((context) => (context.id === contextId ? { ...context, values: { ...context.values, [key]: value } } : context)) };
}
export function flowInto(document: VfxGraphDocument, contextId: string): FlowLink | null {
    return document.links.find((link) => link.to === contextId) ?? null;
}
export function connectFlow(document: VfxGraphDocument, fromId: string, toId: string): VfxGraphDocument {
    const from = findContext(document, fromId);
    const to = findContext(document, toId);
    if (!from || !to || !canFlow(from.kind, to.kind))
        return document;
    if (document.links.some((link) => link.from === fromId && link.to === toId))
        return document;
    const replacesUpdate = from.kind === 'initialize' && to.kind === 'update';
    const kept = document.links.filter((link) => {
        if (link.to === toId)
            return false;
        return !(replacesUpdate && link.from === fromId && findContext(document, link.to)?.kind === 'update');
    });
    const id = unusedId('l', new Set(kept.map((link) => link.id)));
    return { ...document, links: [...kept, { id, from: fromId, to: toId }] };
}
export function disconnectFlow(document: VfxGraphDocument, linkId: string): VfxGraphDocument {
    const links = document.links.filter((link) => link.id !== linkId);
    return links.length === document.links.length ? document : { ...document, links };
}
