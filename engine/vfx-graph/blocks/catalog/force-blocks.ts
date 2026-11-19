import type { BlockDefinition } from '../block-definition';
export const FORCE_BLOCKS: readonly BlockDefinition[] = [
    {
        type: 'gravity',
        label: 'Gravidade',
        description: 'Puxa as partículas para baixo; valores negativos fazem subir, como ar quente.',
        stage: 'update',
        category: 'force',
        params: [{ id: 'strength', label: 'Aceleração', kind: 'number', fallback: 9.81, unit: 'm/s²' }],
        emit: (scope) => `velocity.y -= ${scope.uniform('strength')} * dt;`,
    },
    {
        type: 'wind',
        label: 'Vento',
        description: 'Arrasta as partículas até a velocidade do vento.',
        stage: 'update',
        category: 'force',
        params: [
            { id: 'velocity', label: 'Velocidade', kind: 'vector', fallback: [2, 0, 0] },
            { id: 'response', label: 'Resposta', kind: 'number', fallback: 1.5, min: 0, hint: 'Quão depressa a partícula alcança o vento' },
        ],
        emit: (scope) => `velocity += (${scope.uniform('velocity')} - velocity) * min(${scope.uniform('response')} * dt, 1.0);`,
    },
    {
        type: 'drag',
        label: 'Arrasto',
        description: 'Freia as partículas aos poucos, como o ar freia uma faísca.',
        stage: 'update',
        category: 'force',
        params: [{ id: 'amount', label: 'Freio', kind: 'number', fallback: 1, min: 0 }],
        emit: (scope) => `velocity *= exp(-${scope.uniform('amount')} * dt);`,
    },
    {
        type: 'turbulence',
        label: 'Turbulência',
        description: 'Campo de redemoinhos que dá vida a fogo, fumaça e magia.',
        stage: 'update',
        category: 'force',
        params: [
            { id: 'strength', label: 'Força', kind: 'number', fallback: 2, min: 0 },
            { id: 'frequency', label: 'Detalhe', kind: 'number', fallback: 0.8, min: 0, hint: 'Valores altos criam redemoinhos menores' },
            { id: 'speed', label: 'Evolução', kind: 'number', fallback: 0.5, hint: 'Quão depressa o campo muda com o tempo' },
        ],
        emit: (scope) => `velocity += vfxTurbulence(position * ${scope.uniform('frequency')} + vec3(0.0, time * ${scope.uniform('speed')}, 0.0)) * ${scope.uniform('strength')} * dt;`,
    },
    {
        type: 'vortex',
        label: 'Vórtice',
        description: 'Faz as partículas girarem em volta de um eixo, com sucção opcional para dentro.',
        stage: 'update',
        category: 'force',
        params: [
            { id: 'center', label: 'Centro', kind: 'vector', fallback: [0, 0, 0] },
            { id: 'axis', label: 'Eixo', kind: 'vector', fallback: [0, 1, 0] },
            { id: 'strength', label: 'Giro', kind: 'number', fallback: 3 },
            { id: 'pull', label: 'Sucção', kind: 'number', fallback: 0.5 },
        ],
        emit: (scope) => `{
    vec3 vortexAxis = normalize(${scope.uniform('axis')} + vec3(0.0, 1e-6, 0.0));
    vec3 vortexOffset = position - ${scope.uniform('center')};
    vec3 vortexRadial = vortexOffset - vortexAxis * dot(vortexOffset, vortexAxis);
    velocity += (cross(vortexAxis, vortexRadial) * ${scope.uniform('strength')} - vortexRadial * ${scope.uniform('pull')}) * dt;
}`,
    },
    {
        type: 'attractor',
        label: 'Atrator',
        description: 'Puxa as partículas para um ponto; força negativa as repele.',
        stage: 'update',
        category: 'force',
        params: [
            { id: 'center', label: 'Ponto', kind: 'vector', fallback: [0, 1, 0] },
            { id: 'strength', label: 'Força', kind: 'number', fallback: 4 },
            { id: 'radius', label: 'Alcance', kind: 'number', fallback: 3, min: 0.01, unit: 'm' },
        ],
        emit: (scope) => `{
    vec3 attractorToward = ${scope.uniform('center')} - position;
    float attractorReach = length(attractorToward);
    velocity += attractorToward / max(attractorReach, 0.05) * ${scope.uniform('strength')} * (1.0 - smoothstep(0.0, ${scope.uniform('radius')}, attractorReach)) * dt;
}`,
    },
    {
        type: 'jitter',
        label: 'Tremor',
        description: 'Sacode cada partícula em direções aleatórias: eletricidade, insetos, faíscas nervosas.',
        stage: 'update',
        category: 'force',
        params: [{ id: 'strength', label: 'Força', kind: 'number', fallback: 20, min: 0 }],
        emit: (scope) => `velocity += vfxRandomDirection(${scope.salt()}) * ${scope.uniform('strength')} * dt;`,
    },
];
