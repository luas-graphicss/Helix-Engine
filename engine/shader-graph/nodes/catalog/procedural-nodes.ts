import { FBM_CHUNK, VALUE_NOISE_CHUNK, VORONOI_CHUNK } from '../glsl/noise-chunks';
import type { NodeDefinition } from '../node-definition';
import { floatInput, output, uvInput } from '../socket-builders';
const GRADIENT_EXPRESSION: Record<string, (uv: string) => string> = {
    horizontal: (uv) => `${uv}.x`,
    vertical: (uv) => `${uv}.y`,
    radial: (uv) => `clamp(1.0 - length(${uv} - 0.5) * 2.0, 0.0, 1.0)`,
};
export const PROCEDURAL_NODES: readonly NodeDefinition[] = [
    {
        type: 'noise-value',
        label: 'Ruído suave',
        category: 'procedural',
        description: 'Ruído contínuo entre 0 e 1.',
        inputs: [uvInput(), floatInput('scale', 'Escala', 8)],
        outputs: [output('value', 'Valor', 'float')],
        emit: (context) => {
            context.include(VALUE_NOISE_CHUNK);
            return { value: `sgValueNoise(${context.input('uv')} * ${context.input('scale')})` };
        },
    },
    {
        type: 'noise-fractal',
        label: 'Ruído fractal',
        category: 'procedural',
        description: 'Cinco oitavas de ruído somadas: nuvens, manchas e desgaste.',
        inputs: [uvInput(), floatInput('scale', 'Escala', 4)],
        outputs: [output('value', 'Valor', 'float')],
        emit: (context) => {
            context.include(FBM_CHUNK);
            return { value: `sgFbm(${context.input('uv')} * ${context.input('scale')})` };
        },
    },
    {
        type: 'noise-voronoi',
        label: 'Voronoi',
        category: 'procedural',
        description: 'Células: distância ao ponto mais próximo e um valor aleatório por célula.',
        inputs: [uvInput(), floatInput('scale', 'Escala', 6)],
        outputs: [output('distance', 'Distância', 'float'), output('cell', 'Célula', 'float')],
        emit: (context) => {
            context.include(VORONOI_CHUNK);
            const voronoi = context.local('vec2', `sgVoronoi(${context.input('uv')} * ${context.input('scale')})`);
            return { distance: `${voronoi}.x`, cell: `${voronoi}.y` };
        },
    },
    {
        type: 'pattern-checker',
        label: 'Xadrez',
        category: 'procedural',
        description: 'Quadrados alternados de 0 e 1.',
        inputs: [uvInput(), floatInput('scale', 'Escala', 8)],
        outputs: [output('value', 'Valor', 'float')],
        emit: (context) => {
            const cell = context.local('vec2', `floor(${context.input('uv')} * ${context.input('scale')})`);
            return { value: `mod(${cell}.x + ${cell}.y, 2.0)` };
        },
    },
    {
        type: 'pattern-stripes',
        label: 'Listras',
        category: 'procedural',
        description: 'Faixas horizontais de 0 e 1.',
        inputs: [uvInput(), floatInput('frequency', 'Frequência', 10), floatInput('width', 'Largura', 0.5)],
        outputs: [output('value', 'Valor', 'float')],
        emit: (context) => {
            const uv = context.local('vec2', context.input('uv'));
            return { value: `step(${context.input('width')}, fract(${uv}.y * ${context.input('frequency')}))` };
        },
    },
    {
        type: 'pattern-gradient',
        label: 'Gradiente',
        category: 'procedural',
        description: 'Rampa de 0 a 1 ao longo da UV.',
        params: [
            {
                kind: 'select',
                id: 'direction',
                label: 'Direção',
                options: [
                    { value: 'horizontal', label: 'Horizontal' },
                    { value: 'vertical', label: 'Vertical' },
                    { value: 'radial', label: 'Radial' },
                ],
                fallback: 'horizontal',
            },
        ],
        inputs: [uvInput()],
        outputs: [output('value', 'Valor', 'float')],
        emit: (context) => {
            const uv = context.local('vec2', context.input('uv'));
            const build = GRADIENT_EXPRESSION[context.text('direction')] ?? GRADIENT_EXPRESSION.horizontal;
            return { value: build(uv) };
        },
    },
];
