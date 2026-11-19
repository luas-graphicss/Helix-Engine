import type { BlockDefinition, BlockScope, RangeParam } from '../block-definition';
const SPEED: RangeParam = { id: 'speed', label: 'Rapidez', kind: 'range', fallback: [1, 2], unit: 'm/s' };
function randomSpeed(scope: BlockScope): string {
    return `mix(${scope.uniform('speed')}.x, ${scope.uniform('speed')}.y, vfxRand(${scope.salt()}))`;
}
export const VELOCITY_BLOCKS: readonly BlockDefinition[] = [
    {
        type: 'velocity-direction',
        label: 'Velocidade: direção',
        description: 'Lança as partículas em uma direção, abertas em cone.',
        stage: 'initialize',
        category: 'velocity',
        params: [
            { id: 'direction', label: 'Direção', kind: 'vector', fallback: [0, 1, 0] },
            SPEED,
            { id: 'spread', label: 'Abertura', kind: 'number', fallback: 15, min: 0, max: 180, unit: '°' },
        ],
        emit: (scope) => `{
    vec3 coneForward = normalize(${scope.uniform('direction')} + vec3(0.0, 1e-6, 0.0));
    vec3 coneReference = abs(coneForward.y) > 0.99 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
    vec3 coneRight = normalize(cross(coneReference, coneForward));
    vec3 coneUp = cross(coneForward, coneRight);
    float coneCos = mix(1.0, cos(radians(${scope.uniform('spread')})), vfxRand(${scope.salt()}));
    float coneSin = sqrt(max(1.0 - coneCos * coneCos, 0.0));
    float coneTurn = vfxRand(${scope.salt()}) * 6.2831853;
    velocity += (coneForward * coneCos + (coneRight * cos(coneTurn) + coneUp * sin(coneTurn)) * coneSin) * ${randomSpeed(scope)};
}`,
    },
    {
        type: 'velocity-radial',
        label: 'Velocidade: radial',
        description: 'Empurra cada partícula para longe de um centro: explosões e ondas de choque.',
        stage: 'initialize',
        category: 'velocity',
        params: [{ id: 'center', label: 'Centro', kind: 'vector', fallback: [0, 0, 0] }, SPEED],
        emit: (scope) => `{
    vec3 radialOut = position - ${scope.uniform('center')};
    float radialReach = length(radialOut);
    radialOut = radialReach > 1e-5 ? radialOut / radialReach : vfxRandomDirection(${scope.salt()});
    velocity += radialOut * ${randomSpeed(scope)};
}`,
    },
    {
        type: 'velocity-random',
        label: 'Velocidade: aleatória',
        description: 'Cada partícula sai em uma direção qualquer.',
        stage: 'initialize',
        category: 'velocity',
        params: [SPEED],
        emit: (scope) => `velocity += vfxRandomDirection(${scope.salt()}) * ${randomSpeed(scope)};`,
    },
    {
        type: 'velocity-tangent',
        label: 'Velocidade: giro',
        description: 'Lança as partículas em volta de um eixo vertical: redemoinhos e anéis de magia.',
        stage: 'initialize',
        category: 'velocity',
        params: [{ id: 'center', label: 'Centro', kind: 'vector', fallback: [0, 0, 0] }, SPEED],
        emit: (scope) => `{
    vec3 tangentOut = position - ${scope.uniform('center')};
    vec3 tangent = cross(vec3(0.0, 1.0, 0.0), tangentOut);
    float tangentReach = length(tangent);
    velocity += (tangentReach > 1e-5 ? tangent / tangentReach : vec3(1.0, 0.0, 0.0)) * ${randomSpeed(scope)};
}`,
    },
];
