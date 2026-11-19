import type { EffectContext, VfxGraphDocument } from './effect-document';
export interface EffectSystem {
    readonly id: string;
    readonly spawn: EffectContext | null;
    readonly initialize: EffectContext;
    readonly update: EffectContext | null;
    readonly outputs: readonly EffectContext[];
}
export function resolveSystems(document: VfxGraphDocument): EffectSystem[] {
    const contexts = new Map(document.contexts.map((context) => [context.id, context]));
    const downstream = (id: string): EffectContext[] => document.links.filter((link) => link.from === id).flatMap((link) => contexts.get(link.to) ?? []);
    return document.contexts
        .filter((context) => context.kind === 'initialize')
        .map((initialize) => {
        const upstream = document.links.find((link) => link.to === initialize.id);
        const source = upstream ? contexts.get(upstream.from) : undefined;
        const targets = downstream(initialize.id);
        const update = targets.find((context) => context.kind === 'update') ?? null;
        const outputs = [...targets, ...(update ? downstream(update.id) : [])].filter((context) => context.kind === 'output');
        return { id: initialize.id, spawn: source?.kind === 'spawn' ? source : null, initialize, update, outputs };
    });
}
export function systemContexts(system: EffectSystem): EffectContext[] {
    return [system.spawn, system.initialize, system.update, ...system.outputs].flatMap((context) => context ?? []);
}
export function systemOf(document: VfxGraphDocument, contextId: string): EffectSystem | null {
    return resolveSystems(document).find((system) => systemContexts(system).some((context) => context.id === contextId)) ?? null;
}
