import type { BlockDefinition, SelectParam, VectorParam } from '../block-definition';
const CENTER: VectorParam = { id: 'center', label: 'Centro', kind: 'vector', fallback: [0, 0, 0] };
const SPHERE_FILL: SelectParam = {
    id: 'mode',
    label: 'Preencher',
    kind: 'select',
    fallback: 'volume',
    options: [
        { value: 'volume', label: 'Volume' },
        { value: 'surface', label: 'Casca' },
    ],
};
const CIRCLE_FILL: SelectParam = {
    id: 'mode',
    label: 'Preencher',
    kind: 'select',
    fallback: 'area',
    options: [
        { value: 'area', label: 'Área' },
        { value: 'edge', label: 'Borda' },
    ],
};
export const SHAPE_BLOCKS: readonly BlockDefinition[] = [
    {
        type: 'position-sphere',
        label: 'Posição: esfera',
        description: 'Nasce dentro de uma esfera ou sobre a casca dela.',
        stage: 'initialize',
        category: 'shape',
        params: [CENTER, { id: 'radius', label: 'Raio', kind: 'number', fallback: 0.5, min: 0, unit: 'm' }, SPHERE_FILL],
        emit: (scope) => {
            const sample = scope.choice('mode') === 'surface' ? 'vfxRandomDirection' : 'vfxRandomInSphere';
            return `position += ${scope.uniform('center')} + ${sample}(${scope.salt()}) * ${scope.uniform('radius')};`;
        },
    },
    {
        type: 'position-box',
        label: 'Posição: caixa',
        description: 'Nasce em qualquer ponto de uma caixa: chuva, neve, poeira no ar.',
        stage: 'initialize',
        category: 'shape',
        params: [CENTER, { id: 'size', label: 'Tamanho', kind: 'vector', fallback: [1, 1, 1] }],
        emit: (scope) => `position += ${scope.uniform('center')} + (vfxRandomVec3(${scope.salt()}) - 0.5) * ${scope.uniform('size')};`,
    },
    {
        type: 'position-circle',
        label: 'Posição: círculo',
        description: 'Nasce em um círculo deitado no chão: base de fogueira, anel de magia.',
        stage: 'initialize',
        category: 'shape',
        params: [CENTER, { id: 'radius', label: 'Raio', kind: 'number', fallback: 0.5, min: 0, unit: 'm' }, CIRCLE_FILL],
        emit: (scope) => {
            const reach = scope.choice('mode') === 'edge' ? '1.0' : `sqrt(vfxRand(${scope.salt()}))`;
            return `{
    float circleAngle = vfxRand(${scope.salt()}) * 6.2831853;
    position += ${scope.uniform('center')} + vec3(cos(circleAngle), 0.0, sin(circleAngle)) * ${scope.uniform('radius')} * ${reach};
}`;
        },
    },
    {
        type: 'position-line',
        label: 'Posição: linha',
        description: 'Nasce ao longo de um segmento entre dois pontos.',
        stage: 'initialize',
        category: 'shape',
        params: [
            { id: 'start', label: 'Início', kind: 'vector', fallback: [-1, 0, 0] },
            { id: 'end', label: 'Fim', kind: 'vector', fallback: [1, 0, 0] },
        ],
        emit: (scope) => `position += mix(${scope.uniform('start')}, ${scope.uniform('end')}, vfxRand(${scope.salt()}));`,
    },
    {
        type: 'position-arc',
        label: 'Posição: arco elétrico',
        description: 'Distribui as partículas em um raio em zigue-zague entre dois pontos, que muda de forma várias vezes por segundo.',
        stage: 'initialize',
        category: 'shape',
        params: [
            { id: 'start', label: 'Início', kind: 'vector', fallback: [0, 3, 0] },
            { id: 'end', label: 'Fim', kind: 'vector', fallback: [0, 0, 0] },
            { id: 'amplitude', label: 'Desvio', kind: 'number', fallback: 0.35, min: 0, unit: 'm' },
            { id: 'segments', label: 'Dobras', kind: 'number', fallback: 7, min: 1 },
            { id: 'rate', label: 'Trocas', kind: 'number', fallback: 14, min: 0, unit: 'Hz' },
        ],
        emit: (scope) => `{
    vec3 arcFrom = ${scope.uniform('start')};
    vec3 arcAxis = ${scope.uniform('end')} - arcFrom;
    if (dot(arcAxis, arcAxis) < 1e-8)
        arcAxis = vec3(0.0, 1.0, 0.0);
    vec3 arcReference = abs(arcAxis.y) > 0.9 * length(arcAxis) ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
    vec3 arcSide = normalize(cross(arcAxis, arcReference));
    vec3 arcLift = normalize(cross(arcAxis, arcSide));
    float arcAlong = vfxRand(${scope.salt()});
    float arcStep = floor(time * ${scope.uniform('rate')});
    float arcPhase = arcAlong * ${scope.uniform('segments')};
    vec2 arcSway = vec2(vfxZigzag(arcPhase + arcStep * 17.13), vfxZigzag(arcPhase + arcStep * 31.71 + 57.0)) * 2.0 - 1.0;
    position += arcFrom + arcAxis * arcAlong + (arcSide * arcSway.x + arcLift * arcSway.y) * ${scope.uniform('amplitude')} * sin(arcAlong * 3.14159265);
}`,
    },
];
