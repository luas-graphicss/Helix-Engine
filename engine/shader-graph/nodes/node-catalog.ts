import type { ShaderModel } from '@/engine/renderer/shaders/custom/custom-shader.glsl';
import { EFFECT_NODES } from './catalog/effect-nodes';
import { INPUT_NODES } from './catalog/input-nodes';
import { MATH_NODES } from './catalog/math-nodes';
import { OUTPUT_NODES } from './catalog/output-nodes';
import { POST_NODES } from './catalog/post-nodes';
import { PROCEDURAL_NODES } from './catalog/procedural-nodes';
import { SHADING_NODES } from './catalog/shading-nodes';
import { TEXTURE_NODES } from './catalog/texture-nodes';
import { UV_NODES } from './catalog/uv-nodes';
import { VECTOR_NODES } from './catalog/vector-nodes';
import type { NodeCategory, NodeDefinition } from './node-definition';
const PLACEABLE_NODES: readonly NodeDefinition[] = [...INPUT_NODES, ...TEXTURE_NODES, ...UV_NODES, ...PROCEDURAL_NODES, ...MATH_NODES, ...VECTOR_NODES, ...SHADING_NODES, ...EFFECT_NODES, ...POST_NODES];
const DEFINITIONS = new Map([...PLACEABLE_NODES, ...OUTPUT_NODES].map((definition) => [definition.type, definition]));
export const NODE_CATEGORY_LABEL: Record<NodeCategory, string> = {
    input: 'Entradas',
    texture: 'Texturas',
    uv: 'UV',
    procedural: 'Procedural',
    math: 'Matemática',
    vector: 'Vetores',
    shading: 'Sombreamento',
    effect: 'Efeitos',
    post: 'Pós-processo',
    output: 'Saída',
};
export const PLACEABLE_CATEGORIES: readonly NodeCategory[] = ['input', 'texture', 'uv', 'procedural', 'math', 'vector', 'shading', 'effect', 'post'];
export function nodeDefinition(type: string): NodeDefinition | null {
    return DEFINITIONS.get(type) ?? null;
}
export function supportsModel(definition: NodeDefinition, model: ShaderModel): boolean {
    return definition.models === undefined || definition.models.includes(model);
}
export function placeableNodes(model: ShaderModel): NodeDefinition[] {
    return PLACEABLE_NODES.filter((definition) => supportsModel(definition, model));
}
