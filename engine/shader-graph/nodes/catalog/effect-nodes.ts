import { COLOR_ADJUST_CHUNK, HUE_SHIFT_CHUNK, LUMINANCE_CHUNK } from '../glsl/color-chunks';
import { HOLOGRAM_CHUNK, LAVA_CHUNK, WATER_CHUNK } from '../glsl/effect-chunks';
import { HEIGHT_NORMAL_CHUNK } from '../glsl/surface-chunks';
import type { NodeDefinition } from '../node-definition';
import { autoInput, colorInput, floatInput, output, timeInput, uvInput } from '../socket-builders';
export const EFFECT_NODES: readonly NodeDefinition[] = [
    {
        type: 'effect-dissolve',
        label: 'Dissolver',
        category: 'effect',
        description: 'Compara um ruído com a quantidade: ligue a máscara no Recorte e o brilho da borda no Emissivo.',
        inputs: [floatInput('noise', 'Ruído', 0.5), floatInput('amount', 'Quantidade', 0.4), floatInput('edge', 'Largura da borda', 0.06), colorInput('color', 'Cor da borda', [1, 0.35, 0.05]), floatInput('intensity', 'Intensidade', 4)],
        outputs: [output('mask', 'Máscara', 'float'), output('glow', 'Brilho', 'vec3')],
        emit: (context) => {
            const noise = context.input('noise');
            const amount = context.input('amount');
            const mask = context.local('float', `step(${amount}, ${noise})`);
            const band = `(1.0 - smoothstep(${amount}, ${amount} + max(${context.input('edge')}, 0.0001), ${noise}))`;
            return { mask, glow: `${context.input('color')} * ${context.input('intensity')} * ${mask} * ${band}` };
        },
    },
    {
        type: 'effect-hologram',
        label: 'Holograma',
        category: 'effect',
        description: 'Linhas de varredura, brilho de contorno e tremulação: ligue o brilho no Emissivo e a opacidade na Opacidade.',
        models: ['surface'],
        inputs: [colorInput('color', 'Cor', [0.1, 0.8, 1]), floatInput('density', 'Densidade das linhas', 60), floatInput('speed', 'Velocidade', 1), timeInput()],
        outputs: [output('glow', 'Brilho', 'vec3'), output('opacity', 'Opacidade', 'float')],
        emit: (context) => {
            context.include(HOLOGRAM_CHUNK);
            const surface = `${context.builtin('worldPosition')}, ${context.builtin('normal')}, ${context.builtin('viewDirection')}`;
            const hologram = context.local('vec4', `sgHologram(${surface}, ${context.input('color')}, ${context.input('density')}, ${context.input('speed')}, ${context.input('time')})`);
            return { glow: `${hologram}.rgb`, opacity: `${hologram}.a` };
        },
    },
    {
        type: 'effect-water',
        label: 'Água',
        category: 'effect',
        description: 'Ondas animadas com cor por profundidade, espuma nas cristas e a normal das ondas.',
        models: ['surface'],
        inputs: [uvInput(), floatInput('scale', 'Escala', 6), floatInput('speed', 'Velocidade', 0.6), floatInput('strength', 'Força das ondas', 0.1), colorInput('shallow', 'Cor rasa', [0.1, 0.55, 0.6]), colorInput('deep', 'Cor funda', [0.01, 0.08, 0.2]), timeInput()],
        outputs: [output('color', 'Cor', 'vec3'), output('normal', 'Normal', 'vec3'), output('height', 'Altura', 'float')],
        emit: (context) => {
            context.include(WATER_CHUNK);
            context.include(HEIGHT_NORMAL_CHUNK);
            const height = context.local('float', `sgWaterHeight(${context.input('uv')} * ${context.input('scale')}, ${context.input('time')} * ${context.input('speed')})`);
            return {
                color: `mix(${context.input('deep')}, ${context.input('shallow')}, smoothstep(0.25, 0.8, ${height})) + vec3(smoothstep(0.8, 0.95, ${height}) * 0.6)`,
                normal: `sgHeightNormal(${height}, s.normal, s.worldPosition, ${context.input('strength')})`,
                height,
            };
        },
    },
    {
        type: 'effect-lava',
        label: 'Lava',
        category: 'effect',
        description: 'Crosta escura com rachaduras incandescentes que escorrem: cor, brilho, rugosidade e altura.',
        inputs: [uvInput(), floatInput('scale', 'Escala', 3), floatInput('speed', 'Velocidade', 0.12), floatInput('intensity', 'Intensidade', 5), timeInput()],
        outputs: [output('color', 'Cor', 'vec3'), output('glow', 'Brilho', 'vec3'), output('roughness', 'Rugosidade', 'float'), output('height', 'Altura', 'float')],
        emit: (context) => {
            context.include(LAVA_CHUNK);
            const lava = context.local('vec2', `sgLava(${context.input('uv')} * ${context.input('scale')}, ${context.input('time')} * ${context.input('speed')})`);
            return {
                color: `mix(vec3(0.02, 0.015, 0.012), vec3(0.12, 0.05, 0.03), ${lava}.y)`,
                glow: `mix(vec3(1.0, 0.18, 0.02), vec3(1.0, 0.8, 0.3), ${lava}.x) * ${lava}.x * ${lava}.x * ${context.input('intensity')}`,
                roughness: `mix(0.95, 0.35, ${lava}.x)`,
                height: `1.0 - ${lava}.x`,
            };
        },
    },
    {
        type: 'effect-color-adjust',
        label: 'Ajuste de cor',
        category: 'effect',
        description: 'Saturação, contraste e brilho de uma cor.',
        inputs: [colorInput('color', 'Cor', [1, 1, 1]), floatInput('saturation', 'Saturação', 1), floatInput('contrast', 'Contraste', 1), floatInput('brightness', 'Brilho', 0)],
        outputs: [output('color', 'Cor', 'vec3')],
        emit: (context) => {
            context.include(COLOR_ADJUST_CHUNK);
            return { color: `sgColorAdjust(${context.input('color')}, ${context.input('saturation')}, ${context.input('contrast')}, ${context.input('brightness')})` };
        },
    },
    {
        type: 'effect-hue-shift',
        label: 'Deslocar matiz',
        category: 'effect',
        description: 'Gira o matiz: 1 dá uma volta completa.',
        inputs: [colorInput('color', 'Cor', [1, 0, 0]), floatInput('shift', 'Desvio', 0)],
        outputs: [output('color', 'Cor', 'vec3')],
        emit: (context) => {
            context.include(HUE_SHIFT_CHUNK);
            return { color: `sgHueShift(${context.input('color')}, ${context.input('shift')})` };
        },
    },
    {
        type: 'effect-posterize',
        label: 'Posterizar',
        category: 'effect',
        description: 'Reduz os tons a poucos níveis.',
        inputs: [autoInput('x', 'Valor'), floatInput('steps', 'Níveis', 4)],
        outputs: [output('value', 'Resultado', 'auto')],
        emit: (context) => {
            const steps = context.local('float', `max(${context.input('steps')}, 1.0)`);
            return { value: `floor(${context.input('x')} * ${steps}) / ${steps}` };
        },
    },
    {
        type: 'effect-luminance',
        label: 'Luminância',
        category: 'effect',
        description: 'Brilho percebido de uma cor.',
        inputs: [colorInput('color', 'Cor', [1, 1, 1])],
        outputs: [output('value', 'Valor', 'float')],
        emit: (context) => {
            context.include(LUMINANCE_CHUNK);
            return { value: `sgLuminance(${context.input('color')})` };
        },
    },
];
