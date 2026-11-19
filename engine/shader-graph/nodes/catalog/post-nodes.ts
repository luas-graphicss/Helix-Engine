import { HASH_CHUNK } from '../glsl/noise-chunks';
import { BLUR_CHUNK, CHROMATIC_ABERRATION_CHUNK, EDGE_CHUNK } from '../glsl/post-chunks';
import type { NodeDefinition } from '../node-definition';
import { floatInput, output, timeInput, uvInput } from '../socket-builders';
const POST_ONLY = ['post'] as const;
export const POST_NODES: readonly NodeDefinition[] = [
    {
        type: 'post-scene-color',
        label: 'Cor da cena',
        category: 'post',
        description: 'A imagem renderizada, lida na UV dada.',
        models: POST_ONLY,
        inputs: [uvInput()],
        outputs: [output('color', 'Cor', 'vec3')],
        emit: (context) => ({ color: `texture(uSceneColor, ${context.input('uv')}).rgb` }),
    },
    {
        type: 'post-scene-depth',
        label: 'Profundidade',
        category: 'post',
        description: 'Distância da câmera em metros e a mesma medida de 0 a 1 até o plano distante.',
        models: POST_ONLY,
        inputs: [uvInput()],
        outputs: [output('depth', 'Metros', 'float'), output('normalized', 'De 0 a 1', 'float')],
        emit: (context) => {
            const depth = context.local('float', `helixLinearDepth(texture(uSceneDepth, ${context.input('uv')}).r)`);
            return { depth, normalized: `clamp(${depth} / uFar, 0.0, 1.0)` };
        },
    },
    {
        type: 'post-vignette',
        label: 'Vinheta',
        category: 'post',
        description: 'Máscara que escurece os cantos: multiplique pela cor.',
        models: POST_ONLY,
        inputs: [uvInput(), floatInput('intensity', 'Intensidade', 0.6), floatInput('softness', 'Suavidade', 0.5)],
        outputs: [output('mask', 'Máscara', 'float')],
        emit: (context) => ({
            mask: `1.0 - ${context.input('intensity')} * smoothstep(1.0 - ${context.input('softness')}, 1.4, length((${context.input('uv')} - 0.5) * 2.0))`,
        }),
    },
    {
        type: 'post-chromatic-aberration',
        label: 'Aberração cromática',
        category: 'post',
        description: 'Separa os canais de cor em direção às bordas.',
        models: POST_ONLY,
        inputs: [uvInput(), floatInput('strength', 'Força', 0.012)],
        outputs: [output('color', 'Cor', 'vec3')],
        emit: (context) => {
            context.include(CHROMATIC_ABERRATION_CHUNK);
            return { color: `sgChromaticAberration(${context.input('uv')}, ${context.input('strength')})` };
        },
    },
    {
        type: 'post-pixelate',
        label: 'Pixelizar',
        category: 'post',
        description: 'Agrupa a UV em blocos: ligue na UV de Cor da cena.',
        models: POST_ONLY,
        inputs: [uvInput(), floatInput('size', 'Tamanho do bloco', 6)],
        outputs: [output('uv', 'UV', 'vec2')],
        emit: (context) => {
            const size = context.local('float', `max(${context.input('size')}, 1.0)`);
            return { uv: `(floor(${context.input('uv')} * uResolution / ${size}) + 0.5) * ${size} / uResolution` };
        },
    },
    {
        type: 'post-blur',
        label: 'Desfoque',
        category: 'post',
        description: 'Desfoca a cena em nove amostras.',
        models: POST_ONLY,
        inputs: [uvInput(), floatInput('radius', 'Raio', 2)],
        outputs: [output('color', 'Cor', 'vec3')],
        emit: (context) => {
            context.include(BLUR_CHUNK);
            return { color: `sgBlur(${context.input('uv')}, ${context.input('radius')})` };
        },
    },
    {
        type: 'post-edge',
        label: 'Contorno',
        category: 'post',
        description: 'Realça onde o brilho da cena muda de repente: traço de desenho.',
        models: POST_ONLY,
        inputs: [uvInput(), floatInput('thickness', 'Espessura', 1.5)],
        outputs: [output('edge', 'Borda', 'float')],
        emit: (context) => {
            context.include(EDGE_CHUNK);
            return { edge: `sgEdge(${context.input('uv')}, ${context.input('thickness')})` };
        },
    },
    {
        type: 'post-grain',
        label: 'Granulação',
        category: 'post',
        description: 'Ruído de filme que muda a cada quadro: some à cor.',
        models: POST_ONLY,
        inputs: [uvInput(), floatInput('amount', 'Quantidade', 0.08), timeInput()],
        outputs: [output('grain', 'Grão', 'float')],
        emit: (context) => {
            context.include(HASH_CHUNK);
            return { grain: `(sgHash(${context.input('uv')} * uResolution + fract(${context.input('time')}) * 91.7) - 0.5) * ${context.input('amount')}` };
        },
    },
];
