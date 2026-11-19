import type { BlockValues } from '../document/block-values';
import { CONTEXT_GAP, CONTEXT_WIDTH, contextHeight, SYSTEM_GAP } from '../document/context-layout';
import { addBlock } from '../document/effect-blocks';
import { addContext, connectFlow, CONTEXT_KINDS, createEffectGraph, findContext, setContextValue, type ContextKind, type VfxGraphDocument } from '../document/effect-document';
export interface BlockSpec {
    readonly type: string;
    readonly values: BlockValues;
}
export interface ContextSpec {
    readonly settings?: BlockValues;
    readonly blocks: readonly BlockSpec[];
}
export type SystemSpec = Readonly<Record<ContextKind, ContextSpec>>;
export type GradientStop = readonly [
    position: number,
    red: number,
    green: number,
    blue: number,
    alpha: number
];
const ORIGIN_X = 40;
const ORIGIN_Y = 40;
export function block(type: string, values: BlockValues = {}): BlockSpec {
    return { type, values };
}
export function gradient(first: GradientStop, second: GradientStop, third: GradientStop, fourth: GradientStop): readonly number[] {
    return [...first, ...second, ...third, ...fourth];
}
export function appendSystem(document: VfxGraphDocument, system: SystemSpec, x: number, y: number): VfxGraphDocument {
    let current = document;
    let previousId: string | null = null;
    let top = y;
    for (const kind of CONTEXT_KINDS) {
        const spec = system[kind];
        const added = addContext(current, kind, x, top);
        current = added.document;
        for (const [key, value] of Object.entries(spec.settings ?? {}))
            current = setContextValue(current, added.contextId, key, value);
        for (const blockSpec of spec.blocks)
            current = addBlock(current, added.contextId, blockSpec.type, blockSpec.values)?.document ?? current;
        if (previousId)
            current = connectFlow(current, previousId, added.contextId);
        const context = findContext(current, added.contextId);
        top += (context ? contextHeight(context) : 0) + CONTEXT_GAP;
        previousId = added.contextId;
    }
    return current;
}
export function buildEffect(systems: readonly SystemSpec[]): VfxGraphDocument {
    return systems.reduce((document, system, column) => appendSystem(document, system, ORIGIN_X + column * (CONTEXT_WIDTH + SYSTEM_GAP), ORIGIN_Y), createEffectGraph());
}
