import { POLAR_UV_CHUNK, ROTATE_UV_CHUNK } from '../glsl/uv-chunks';
import type { NodeDefinition } from '../node-definition';
import { floatInput, output, timeInput, uvInput, vectorInput } from '../socket-builders';
const UV_OUTPUT = [output('uv', 'UV', 'vec2')];
export const UV_NODES: readonly NodeDefinition[] = [
    {
        type: 'uv-tiling-offset',
        label: 'Repetição e deslocamento',
        category: 'uv',
        description: 'Multiplica a UV pela repetição e soma o deslocamento.',
        inputs: [uvInput(), vectorInput('tiling', 'Repetição', 'vec2', [1, 1]), vectorInput('offset', 'Deslocamento', 'vec2', [0, 0])],
        outputs: UV_OUTPUT,
        emit: (context) => ({ uv: `${context.input('uv')} * ${context.input('tiling')} + ${context.input('offset')}` }),
    },
    {
        type: 'uv-panner',
        label: 'Rolagem',
        category: 'uv',
        description: 'Desliza a UV com o tempo.',
        inputs: [uvInput(), vectorInput('speed', 'Velocidade', 'vec2', [0.1, 0]), timeInput()],
        outputs: UV_OUTPUT,
        emit: (context) => ({ uv: `${context.input('uv')} + ${context.input('speed')} * ${context.input('time')}` }),
    },
    {
        type: 'uv-rotate',
        label: 'Rotação',
        category: 'uv',
        description: 'Gira a UV em torno do centro, em radianos.',
        inputs: [uvInput(), vectorInput('center', 'Centro', 'vec2', [0.5, 0.5]), floatInput('angle', 'Ângulo', 0)],
        outputs: UV_OUTPUT,
        emit: (context) => {
            context.include(ROTATE_UV_CHUNK);
            return { uv: `sgRotate(${context.input('uv')}, ${context.input('center')}, ${context.input('angle')})` };
        },
    },
    {
        type: 'uv-polar',
        label: 'Coordenadas polares',
        category: 'uv',
        description: 'Troca a UV por raio e ângulo em torno do centro.',
        inputs: [uvInput(), vectorInput('center', 'Centro', 'vec2', [0.5, 0.5])],
        outputs: UV_OUTPUT,
        emit: (context) => {
            context.include(POLAR_UV_CHUNK);
            return { uv: `sgPolar(${context.input('uv')}, ${context.input('center')})` };
        },
    },
    {
        type: 'uv-distort',
        label: 'Distorção',
        category: 'uv',
        description: 'Empurra a UV por um valor centrado em 0,5, como um ruído.',
        inputs: [uvInput(), vectorInput('offset', 'Desvio', 'vec2', [0.5, 0.5]), floatInput('strength', 'Força', 0.1)],
        outputs: UV_OUTPUT,
        emit: (context) => ({ uv: `${context.input('uv')} + (${context.input('offset')} - 0.5) * ${context.input('strength')}` }),
    },
    {
        type: 'uv-screen',
        label: 'UV de tela',
        category: 'uv',
        description: 'Posição do pixel na tela, de 0 a 1.',
        inputs: [],
        outputs: UV_OUTPUT,
        emit: () => ({ uv: 'gl_FragCoord.xy / uResolution' }),
    },
];
