import type { ContextKind } from '../document/effect-document';
import type { BlockCategory, BlockDefinition } from './block-definition';
import { APPEARANCE_BLOCKS } from './catalog/appearance-blocks';
import { ATTRIBUTE_BLOCKS } from './catalog/attribute-blocks';
import { COLLISION_BLOCKS } from './catalog/collision-blocks';
import { FORCE_BLOCKS } from './catalog/force-blocks';
import { SHAPE_BLOCKS } from './catalog/shape-blocks';
import { SPAWN_BLOCKS } from './catalog/spawn-blocks';
import { VELOCITY_BLOCKS } from './catalog/velocity-blocks';
export const BLOCK_DEFINITIONS: readonly BlockDefinition[] = [
    ...SPAWN_BLOCKS,
    ...SHAPE_BLOCKS,
    ...ATTRIBUTE_BLOCKS,
    ...VELOCITY_BLOCKS,
    ...FORCE_BLOCKS,
    ...COLLISION_BLOCKS,
    ...APPEARANCE_BLOCKS,
];
const DEFINITION_BY_TYPE = new Map(BLOCK_DEFINITIONS.map((definition) => [definition.type, definition]));
export const BLOCK_CATEGORY_LABEL: Record<BlockCategory, string> = {
    emission: 'Emissão',
    shape: 'Forma de origem',
    attribute: 'Atributos',
    velocity: 'Velocidade inicial',
    force: 'Forças',
    collision: 'Colisão',
    appearance: 'Aparência',
};
export function blockDefinition(type: string): BlockDefinition | null {
    return DEFINITION_BY_TYPE.get(type) ?? null;
}
export function blocksForStage(stage: ContextKind): readonly BlockDefinition[] {
    return BLOCK_DEFINITIONS.filter((definition) => definition.stage === stage);
}
