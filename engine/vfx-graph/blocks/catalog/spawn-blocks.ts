import type { BlockDefinition } from '../block-definition';
export const SPAWN_RATE_BLOCK = 'spawn-rate';
export const SPAWN_BURST_BLOCK = 'spawn-burst';
export const SPAWN_BLOCKS: readonly BlockDefinition[] = [
    {
        type: SPAWN_RATE_BLOCK,
        label: 'Taxa constante',
        description: 'Emite partículas sem parar, tantas por segundo: fogo, fumaça, chuva.',
        stage: 'spawn',
        category: 'emission',
        params: [{ id: 'rate', label: 'Por segundo', kind: 'number', fallback: 200, min: 0 }],
    },
    {
        type: SPAWN_BURST_BLOCK,
        label: 'Rajada',
        description: 'Solta muitas partículas de uma vez: explosões, impactos, relâmpagos.',
        stage: 'spawn',
        category: 'emission',
        params: [
            { id: 'count', label: 'Quantidade', kind: 'number', fallback: 200, min: 0 },
            { id: 'time', label: 'Início', kind: 'number', fallback: 0, min: 0, unit: 's' },
            { id: 'interval', label: 'Repetir a cada', kind: 'number', fallback: 0, min: 0, unit: 's', hint: 'Zero dispara uma única vez por ciclo' },
        ],
    },
];
