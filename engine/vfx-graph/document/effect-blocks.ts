import type { BlockValue, BlockValues } from './block-values';
import type { EffectBlock, EffectContext, VfxGraphDocument } from './effect-document';
import { unusedId } from './unique-id';
function editContext(document: VfxGraphDocument, contextId: string, edit: (context: EffectContext) => EffectContext): VfxGraphDocument {
    let changed = false;
    const contexts = document.contexts.map((context) => {
        if (context.id !== contextId)
            return context;
        const edited = edit(context);
        changed ||= edited !== context;
        return edited;
    });
    return changed ? { ...document, contexts } : document;
}
function editBlock(document: VfxGraphDocument, contextId: string, blockId: string, edit: (block: EffectBlock) => EffectBlock): VfxGraphDocument {
    return editContext(document, contextId, (context) => {
        const index = context.blocks.findIndex((block) => block.id === blockId);
        if (index < 0)
            return context;
        const edited = edit(context.blocks[index]);
        return edited === context.blocks[index] ? context : { ...context, blocks: context.blocks.map((block, position) => (position === index ? edited : block)) };
    });
}
export function findBlock(document: VfxGraphDocument, contextId: string, blockId: string): EffectBlock | null {
    return document.contexts.find((context) => context.id === contextId)?.blocks.find((block) => block.id === blockId) ?? null;
}
export function addBlock(document: VfxGraphDocument, contextId: string, type: string, values: BlockValues = {}): {
    document: VfxGraphDocument;
    blockId: string;
} | null {
    const taken = new Set(document.contexts.flatMap((context) => context.blocks.map((block) => block.id)));
    const blockId = unusedId('b', taken);
    const edited = editContext(document, contextId, (context) => ({ ...context, blocks: [...context.blocks, { id: blockId, type, enabled: true, values }] }));
    return edited === document ? null : { document: edited, blockId };
}
export function removeBlock(document: VfxGraphDocument, contextId: string, blockId: string): VfxGraphDocument {
    return editContext(document, contextId, (context) => {
        const blocks = context.blocks.filter((block) => block.id !== blockId);
        return blocks.length === context.blocks.length ? context : { ...context, blocks };
    });
}
export function moveBlock(document: VfxGraphDocument, contextId: string, blockId: string, offset: number): VfxGraphDocument {
    return editContext(document, contextId, (context) => {
        const index = context.blocks.findIndex((block) => block.id === blockId);
        const target = Math.min(context.blocks.length - 1, Math.max(0, index + offset));
        if (index < 0 || target === index)
            return context;
        const blocks = context.blocks.filter((block) => block.id !== blockId);
        blocks.splice(target, 0, context.blocks[index]);
        return { ...context, blocks };
    });
}
export function setBlockEnabled(document: VfxGraphDocument, contextId: string, blockId: string, enabled: boolean): VfxGraphDocument {
    return editBlock(document, contextId, blockId, (block) => (block.enabled === enabled ? block : { ...block, enabled }));
}
export function setBlockValue(document: VfxGraphDocument, contextId: string, blockId: string, key: string, value: BlockValue): VfxGraphDocument {
    return editBlock(document, contextId, blockId, (block) => ({ ...block, values: { ...block.values, [key]: value } }));
}
