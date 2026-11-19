import { HEIGHT_NORMAL_CHUNK } from '../glsl/surface-chunks';
import type { NodeDefinition } from '../node-definition';
import { builtinInput, floatInput, output } from '../socket-builders';
export const SHADING_NODES: readonly NodeDefinition[] = [
    {
        type: 'shading-light',
        label: 'Iluminação',
        category: 'shading',
        description: 'Termos da luz do sol para sombreamento próprio: difusa, difusa suavizada, brilho especular e a cor da luz.',
        models: ['surface'],
        inputs: [builtinInput('normal', 'Normal', 'vec3', 'normal'), floatInput('shininess', 'Polimento', 32)],
        outputs: [output('diffuse', 'Difusa', 'float'), output('wrapped', 'Difusa suave', 'float'), output('specular', 'Especular', 'float'), output('color', 'Cor da luz', 'vec3')],
        emit: (context) => {
            const normal = context.local('vec3', `normalize(${context.input('normal')})`);
            const facing = context.local('float', `dot(${normal}, uSunDirection)`);
            const halfway = `normalize(uSunDirection + ${context.builtin('viewDirection')})`;
            return {
                diffuse: `max(${facing}, 0.0)`,
                wrapped: `${facing} * 0.5 + 0.5`,
                specular: `pow(max(dot(${normal}, ${halfway}), 0.0), max(${context.input('shininess')}, 1.0))`,
                color: 'uSunColor',
            };
        },
    },
    {
        type: 'shading-fresnel',
        label: 'Fresnel',
        category: 'shading',
        description: 'Cresce nas bordas vistas de raspão: contornos, brilho de borda e hologramas.',
        models: ['surface'],
        inputs: [builtinInput('normal', 'Normal', 'vec3', 'normal'), floatInput('power', 'Expoente', 3)],
        outputs: [output('value', 'Valor', 'float')],
        emit: (context) => ({
            value: `pow(1.0 - clamp(dot(normalize(${context.input('normal')}), ${context.builtin('viewDirection')}), 0.0, 1.0), ${context.input('power')})`,
        }),
    },
    {
        type: 'shading-toon-ramp',
        label: 'Rampa toon',
        category: 'shading',
        description: 'Quebra um valor contínuo em faixas chapadas.',
        inputs: [floatInput('value', 'Valor', 0.5), floatInput('steps', 'Faixas', 3)],
        outputs: [output('value', 'Valor', 'float')],
        emit: (context) => {
            const steps = context.local('float', `max(${context.input('steps')}, 2.0)`);
            return { value: `floor(clamp(${context.input('value')}, 0.0, 0.999) * ${steps}) / (${steps} - 1.0)` };
        },
    },
    {
        type: 'shading-height-normal',
        label: 'Normal por altura',
        category: 'shading',
        description: 'Cria relevo a partir de um valor de altura, sem precisar de mapa de normais.',
        models: ['surface'],
        inputs: [floatInput('height', 'Altura', 0), floatInput('strength', 'Força', 0.1)],
        outputs: [output('normal', 'Normal', 'vec3')],
        emit: (context) => {
            context.include(HEIGHT_NORMAL_CHUNK);
            return { normal: `sgHeightNormal(${context.input('height')}, s.normal, s.worldPosition, ${context.input('strength')})` };
        },
    },
];
