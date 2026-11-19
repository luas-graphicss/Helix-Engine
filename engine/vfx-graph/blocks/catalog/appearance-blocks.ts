import type { BlockDefinition } from '../block-definition';
export const STRETCH_BLOCK = 'stretch-by-velocity';
export const APPEARANCE_BLOCKS: readonly BlockDefinition[] = [
    {
        type: 'color-over-life',
        label: 'Cor ao longo da vida',
        description: 'Multiplica a cor da partícula por um degradê que vai do nascimento à morte.',
        stage: 'output',
        category: 'appearance',
        params: [{ id: 'gradient', label: 'Degradê', kind: 'gradient', fallback: [0, 1, 1, 1, 1, 0.33, 1, 1, 1, 1, 0.66, 1, 1, 1, 1, 1, 1, 1, 1, 0] }],
        emit: (scope) => `color *= ${scope.gradient('gradient', 'life')};`,
    },
    {
        type: 'size-over-life',
        label: 'Tamanho ao longo da vida',
        description: 'Cresce ou encolhe a partícula enquanto ela envelhece.',
        stage: 'output',
        category: 'appearance',
        params: [
            { id: 'start', label: 'No início', kind: 'number', fallback: 1, min: 0, unit: '×' },
            { id: 'end', label: 'No fim', kind: 'number', fallback: 0, min: 0, unit: '×' },
            { id: 'curve', label: 'Curva', kind: 'number', fallback: 1, min: 0.05, hint: 'Abaixo de 1 muda depressa no começo; acima de 1, no fim' },
        ],
        emit: (scope) => `size *= mix(${scope.uniform('start')}, ${scope.uniform('end')}, pow(life, ${scope.uniform('curve')}));`,
    },
    {
        type: 'fade',
        label: 'Esmaecer',
        description: 'Aparece e some aos poucos, sem estalo no nascimento nem na morte.',
        stage: 'output',
        category: 'appearance',
        params: [
            { id: 'in', label: 'Entrada', kind: 'number', fallback: 0.1, min: 0, max: 1, hint: 'Fração da vida gasta aparecendo' },
            { id: 'out', label: 'Saída', kind: 'number', fallback: 0.4, min: 0, max: 1, hint: 'Fração da vida gasta sumindo' },
        ],
        emit: (scope) => `color.a *= smoothstep(0.0, max(${scope.uniform('in')}, 1e-4), life) * (1.0 - smoothstep(1.0 - max(${scope.uniform('out')}, 1e-4), 1.0, life));`,
    },
    {
        type: STRETCH_BLOCK,
        label: 'Esticar pela velocidade',
        description: 'Alinha o quadrado ao movimento e o alonga com a rapidez: chuva, faíscas, respingos.',
        stage: 'output',
        category: 'appearance',
        params: [{ id: 'factor', label: 'Alongamento', kind: 'number', fallback: 0.05, min: 0, unit: 's' }],
        emit: (scope) => `stretch += ${scope.uniform('factor')};`,
    },
    {
        type: 'flicker',
        label: 'Cintilar',
        description: 'Faz o brilho de cada partícula piscar por conta própria: brasas, vagalumes, energia.',
        stage: 'output',
        category: 'appearance',
        params: [
            { id: 'amount', label: 'Quanto', kind: 'number', fallback: 0.5, min: 0, max: 1 },
            { id: 'rate', label: 'Ritmo', kind: 'number', fallback: 12, min: 0, unit: 'Hz' },
        ],
        emit: (scope) => `color.rgb *= 1.0 - ${scope.uniform('amount')} * vfxHashFloat(floor(time * ${scope.uniform('rate')}) + seed * 97.0);`,
    },
];
