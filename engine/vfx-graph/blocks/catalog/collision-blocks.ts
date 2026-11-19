import type { BlockDefinition, BlockScope } from '../block-definition';
const GROUND_RESPONSE: Record<string, (scope: BlockScope) => string> = {
    bounce: (scope) => `velocity = vec3(velocity.x, -velocity.y * ${scope.uniform('bounce')}, velocity.z);
    velocity.xz *= 1.0 - ${scope.uniform('friction')};`,
    stick: () => `velocity = vec3(0.0);
    spin = 0.0;`,
    kill: () => 'age = lifetime;',
};
export const COLLISION_BLOCKS: readonly BlockDefinition[] = [
    {
        type: 'ground-collision',
        label: 'Colisão com o chão',
        description: 'Um plano horizontal em que as partículas quicam, grudam ou somem.',
        stage: 'update',
        category: 'collision',
        afterMotion: true,
        params: [
            { id: 'height', label: 'Altura', kind: 'number', fallback: 0, unit: 'm' },
            {
                id: 'mode',
                label: 'Ao tocar',
                kind: 'select',
                fallback: 'bounce',
                options: [
                    { value: 'bounce', label: 'Quicar' },
                    { value: 'stick', label: 'Grudar' },
                    { value: 'kill', label: 'Sumir' },
                ],
            },
            { id: 'bounce', label: 'Quique', kind: 'number', fallback: 0.4, min: 0, max: 1, hint: 'Só vale no modo Quicar' },
            { id: 'friction', label: 'Atrito', kind: 'number', fallback: 0.3, min: 0, max: 1, hint: 'Só vale no modo Quicar' },
        ],
        emit: (scope) => `if (position.y < ${scope.uniform('height')} && velocity.y < 0.0) {
    position.y = ${scope.uniform('height')};
    ${GROUND_RESPONSE[scope.choice('mode')](scope)}
}`,
    },
];
