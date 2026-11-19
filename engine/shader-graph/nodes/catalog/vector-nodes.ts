import type { NodeDefinition } from '../node-definition';
import { floatInput, output, vectorInput } from '../socket-builders';
export const VECTOR_NODES: readonly NodeDefinition[] = [
    {
        type: 'vector-combine',
        label: 'Combinar',
        category: 'vector',
        description: 'Junta números em vetores de 2, 3 e 4 componentes.',
        inputs: [floatInput('x', 'X'), floatInput('y', 'Y'), floatInput('z', 'Z'), floatInput('w', 'W', 1)],
        outputs: [output('xy', 'XY', 'vec2'), output('xyz', 'XYZ', 'vec3'), output('xyzw', 'XYZW', 'vec4')],
        emit: (context) => {
            const x = context.input('x');
            const y = context.input('y');
            const z = context.input('z');
            return { xy: `vec2(${x}, ${y})`, xyz: `vec3(${x}, ${y}, ${z})`, xyzw: `vec4(${x}, ${y}, ${z}, ${context.input('w')})` };
        },
    },
    {
        type: 'vector-split',
        label: 'Separar',
        category: 'vector',
        description: 'Separa um vetor nos componentes.',
        inputs: [vectorInput('vector', 'Vetor', 'vec4', [0, 0, 0, 1])],
        outputs: [output('x', 'X', 'float'), output('y', 'Y', 'float'), output('z', 'Z', 'float'), output('w', 'W', 'float')],
        emit: (context) => {
            const vector = context.local('vec4', context.input('vector'));
            return { x: `${vector}.x`, y: `${vector}.y`, z: `${vector}.z`, w: `${vector}.w` };
        },
    },
    {
        type: 'vector-dot',
        label: 'Produto escalar',
        category: 'vector',
        description: 'Quanto dois vetores apontam para o mesmo lado.',
        inputs: [vectorInput('a', 'A', 'vec3', [0, 1, 0]), vectorInput('b', 'B', 'vec3', [0, 1, 0])],
        outputs: [output('value', 'Resultado', 'float')],
        emit: (context) => ({ value: `dot(${context.input('a')}, ${context.input('b')})` }),
    },
    {
        type: 'vector-cross',
        label: 'Produto vetorial',
        category: 'vector',
        description: 'Vetor perpendicular a A e B.',
        inputs: [vectorInput('a', 'A', 'vec3', [1, 0, 0]), vectorInput('b', 'B', 'vec3', [0, 1, 0])],
        outputs: [output('vector', 'Vetor', 'vec3')],
        emit: (context) => ({ vector: `cross(${context.input('a')}, ${context.input('b')})` }),
    },
    {
        type: 'vector-normalize',
        label: 'Normalizar',
        category: 'vector',
        description: 'Mantém a direção e leva o comprimento a 1.',
        inputs: [vectorInput('vector', 'Vetor', 'vec3', [0, 1, 0])],
        outputs: [output('vector', 'Vetor', 'vec3')],
        emit: (context) => ({ vector: `normalize(${context.input('vector')})` }),
    },
    {
        type: 'vector-length',
        label: 'Comprimento',
        category: 'vector',
        description: 'Comprimento do vetor.',
        inputs: [vectorInput('vector', 'Vetor', 'vec3', [0, 1, 0])],
        outputs: [output('value', 'Resultado', 'float')],
        emit: (context) => ({ value: `length(${context.input('vector')})` }),
    },
    {
        type: 'vector-distance',
        label: 'Distância',
        category: 'vector',
        description: 'Distância entre dois pontos.',
        inputs: [vectorInput('a', 'A', 'vec3', [0, 0, 0]), vectorInput('b', 'B', 'vec3', [0, 0, 0])],
        outputs: [output('value', 'Resultado', 'float')],
        emit: (context) => ({ value: `distance(${context.input('a')}, ${context.input('b')})` }),
    },
    {
        type: 'vector-reflect',
        label: 'Refletir',
        category: 'vector',
        description: 'Reflete uma direção em torno da normal.',
        inputs: [vectorInput('direction', 'Direção', 'vec3', [0, -1, 0]), vectorInput('normal', 'Normal', 'vec3', [0, 1, 0])],
        outputs: [output('vector', 'Vetor', 'vec3')],
        emit: (context) => ({ vector: `reflect(${context.input('direction')}, normalize(${context.input('normal')}))` }),
    },
];
