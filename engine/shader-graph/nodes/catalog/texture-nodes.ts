import { PERTURB_NORMAL_CHUNK } from '../glsl/surface-chunks';
import type { NodeDefinition } from '../node-definition';
import { floatInput, output, uvInput } from '../socket-builders';
export const TEXTURE_NODES: readonly NodeDefinition[] = [
    {
        type: 'texture-sample',
        label: 'Textura',
        category: 'texture',
        description: 'Amostra uma textura da biblioteca de ativos.',
        params: [
            { kind: 'texture', id: 'texture', label: 'Textura' },
            {
                kind: 'select',
                id: 'space',
                label: 'Conteúdo',
                options: [
                    { value: 'srgb', label: 'Cor (sRGB)' },
                    { value: 'linear', label: 'Dados (linear)' },
                ],
                fallback: 'srgb',
            },
        ],
        inputs: [uvInput()],
        outputs: [output('rgb', 'RGB', 'vec3'), output('r', 'R', 'float'), output('g', 'G', 'float'), output('b', 'B', 'float'), output('a', 'A', 'float')],
        emit: (context) => {
            const sampler = context.textureUniform(context.text('texture') || null, context.text('space') === 'linear' ? 'linear' : 'srgb');
            const texel = context.local('vec4', `texture(${sampler}, ${context.input('uv')})`);
            return { rgb: `${texel}.rgb`, r: `${texel}.r`, g: `${texel}.g`, b: `${texel}.b`, a: `${texel}.a` };
        },
    },
    {
        type: 'texture-normal-map',
        label: 'Mapa de normal',
        category: 'texture',
        description: 'Converte um mapa de normais em espaço tangente para a normal no mundo. Sem textura, devolve a normal da superfície.',
        models: ['surface'],
        params: [{ kind: 'texture', id: 'texture', label: 'Textura' }],
        inputs: [uvInput(), floatInput('strength', 'Intensidade', 1)],
        outputs: [output('normal', 'Normal', 'vec3')],
        emit: (context) => {
            const assetId = context.text('texture');
            if (assetId === '')
                return { normal: context.builtin('normal') };
            context.include(PERTURB_NORMAL_CHUNK);
            const sampler = context.textureUniform(assetId, 'linear');
            const uv = context.local('vec2', context.input('uv'));
            return { normal: `sgPerturbNormal(texture(${sampler}, ${uv}).xyz * 2.0 - 1.0, s.normal, s.worldPosition, ${uv}, ${context.input('strength')})` };
        },
    },
];
