import type { BlockParam } from '../blocks/block-definition';
import type { ContextKind } from '../document/effect-document';
import type { SpriteShape } from '../glsl/sprite-chunks.glsl';
export const DEFAULT_CAPACITY = 4096;
export const MAX_CAPACITY = 1048576;
export const SPRITE_SHAPE_LABEL: Record<SpriteShape, string> = {
    soft: 'Brilho suave',
    disc: 'Disco',
    spark: 'Faísca',
    smoke: 'Fumaça',
    ring: 'Anel',
    streak: 'Risco',
    square: 'Quadrado',
};
export interface ContextDefinition {
    readonly kind: ContextKind;
    readonly label: string;
    readonly description: string;
    readonly settings: readonly BlockParam[];
}
export const CONTEXT_DEFINITIONS: Record<ContextKind, ContextDefinition> = {
    spawn: {
        kind: 'spawn',
        label: 'Emissão',
        description: 'Decide quando e quantas partículas nascem.',
        settings: [
            {
                id: 'loop',
                label: 'Ciclo',
                kind: 'select',
                fallback: 'loop',
                options: [
                    { value: 'loop', label: 'Repetir' },
                    { value: 'once', label: 'Uma vez' },
                ],
            },
            { id: 'duration', label: 'Duração', kind: 'number', fallback: 5, min: 0.05, unit: 's', hint: 'Tempo de um ciclo de emissão' },
        ],
    },
    initialize: {
        kind: 'initialize',
        label: 'Inicialização',
        description: 'Roda uma vez por partícula, quando ela nasce: posição, velocidade, cor e tempo de vida.',
        settings: [
            {
                id: 'capacity',
                label: 'Capacidade',
                kind: 'number',
                fallback: DEFAULT_CAPACITY,
                min: 1,
                max: MAX_CAPACITY,
                hint: 'Máximo de partículas vivas ao mesmo tempo; reserva a memória na GPU',
            },
        ],
    },
    update: {
        kind: 'update',
        label: 'Atualização',
        description: 'Roda a cada quadro em todas as partículas vivas, direto na GPU: forças, turbulência e colisão.',
        settings: [],
    },
    output: {
        kind: 'output',
        label: 'Saída',
        description: 'Desenha cada partícula como um quadrado com forma, mistura e brilho próprios.',
        settings: [
            {
                id: 'blend',
                label: 'Mistura',
                kind: 'select',
                fallback: 'additive',
                options: [
                    { value: 'additive', label: 'Aditiva (luz)' },
                    { value: 'alpha', label: 'Transparente (matéria)' },
                ],
            },
            {
                id: 'shape',
                label: 'Forma',
                kind: 'select',
                fallback: 'soft',
                options: Object.entries(SPRITE_SHAPE_LABEL).map(([value, label]) => ({ value, label })),
            },
            {
                id: 'orientation',
                label: 'Orientação',
                kind: 'select',
                fallback: 'camera',
                options: [
                    { value: 'camera', label: 'Voltada para a câmera' },
                    { value: 'ground', label: 'Deitada no chão' },
                ],
            },
            { id: 'intensity', label: 'Intensidade', kind: 'number', fallback: 1, min: 0, unit: '×', hint: 'Multiplica o brilho; acima de 1 estoura em HDR' },
        ],
    },
};
