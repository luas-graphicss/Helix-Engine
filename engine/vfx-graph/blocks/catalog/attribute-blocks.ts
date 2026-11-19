import type { BlockDefinition } from '../block-definition';
export const LIFETIME_BLOCK = 'set-lifetime';
export const DEFAULT_LIFETIME_SECONDS = 1;
export const ATTRIBUTE_BLOCKS: readonly BlockDefinition[] = [
    {
        type: LIFETIME_BLOCK,
        label: 'Tempo de vida',
        description: 'Quantos segundos cada partícula dura, sorteado entre o mínimo e o máximo.',
        stage: 'initialize',
        category: 'attribute',
        params: [{ id: 'seconds', label: 'Segundos', kind: 'range', fallback: [1, 2], unit: 's' }],
        emit: (scope) => `lifetime = mix(${scope.uniform('seconds')}.x, ${scope.uniform('seconds')}.y, vfxRand(${scope.salt()}));`,
    },
    {
        type: 'set-size',
        label: 'Tamanho',
        description: 'Lado do quadrado de cada partícula, sorteado entre o mínimo e o máximo.',
        stage: 'initialize',
        category: 'attribute',
        params: [{ id: 'size', label: 'Lado', kind: 'range', fallback: [0.05, 0.12], unit: 'm' }],
        emit: (scope) => `size = mix(${scope.uniform('size')}.x, ${scope.uniform('size')}.y, vfxRand(${scope.salt()}));`,
    },
    {
        type: 'set-color',
        label: 'Cor',
        description: 'Cor de nascimento, sorteada entre duas cores.',
        stage: 'initialize',
        category: 'attribute',
        params: [
            { id: 'from', label: 'De', kind: 'color', fallback: [1, 1, 1, 1] },
            { id: 'to', label: 'Até', kind: 'color', fallback: [1, 1, 1, 1] },
        ],
        emit: (scope) => `color = mix(${scope.uniform('from')}, ${scope.uniform('to')}, vfxRand(${scope.salt()}));`,
    },
    {
        type: 'set-rotation',
        label: 'Rotação',
        description: 'Ângulo de nascimento e velocidade de giro do quadrado.',
        stage: 'initialize',
        category: 'attribute',
        params: [
            { id: 'angle', label: 'Ângulo', kind: 'range', fallback: [0, 360], unit: '°' },
            { id: 'spin', label: 'Giro', kind: 'range', fallback: [-90, 90], unit: '°/s' },
        ],
        emit: (scope) => `rotation = radians(mix(${scope.uniform('angle')}.x, ${scope.uniform('angle')}.y, vfxRand(${scope.salt()})));
spin = radians(mix(${scope.uniform('spin')}.x, ${scope.uniform('spin')}.y, vfxRand(${scope.salt()})));`,
    },
];
