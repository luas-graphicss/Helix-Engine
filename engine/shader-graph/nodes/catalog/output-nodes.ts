import type { ShaderModel } from '@/engine/renderer/shaders/custom/custom-shader.glsl';
import { OUTPUT_NODE_TYPE } from '../../document/graph-document';
import type { NodeDefinition } from '../node-definition';
import type { SocketType } from '../socket-types';
export interface OutputPin {
    readonly id: string;
    readonly label: string;
    readonly type: SocketType;
    readonly translucent?: boolean;
    readonly fallback?: string;
    write(value: string): string;
}
const OUTPUT_PINS: Record<ShaderModel, readonly OutputPin[]> = {
    surface: [
        { id: 'baseColor', label: 'Cor base', type: 'vec3', write: (value) => `s.baseColor = ${value};` },
        { id: 'metallic', label: 'Metálico', type: 'float', write: (value) => `s.metallic = clamp(${value}, 0.0, 1.0);` },
        { id: 'roughness', label: 'Rugosidade', type: 'float', write: (value) => `s.roughness = clamp(${value}, 0.0, 1.0);` },
        { id: 'normal', label: 'Normal', type: 'vec3', write: (value) => `s.normal = normalize(${value});` },
        { id: 'emissive', label: 'Emissivo', type: 'vec3', write: (value) => `s.emissive = ${value};` },
        { id: 'occlusion', label: 'Oclusão', type: 'float', write: (value) => `s.occlusion = clamp(${value}, 0.0, 1.0);` },
        { id: 'alpha', label: 'Opacidade', type: 'float', translucent: true, write: (value) => `s.alpha = clamp(${value}, 0.0, 1.0);` },
        { id: 'clip', label: 'Recorte', type: 'float', write: (value) => `if (${value} < 0.5) discard;` },
    ],
    post: [{ id: 'color', label: 'Cor', type: 'vec3', fallback: 'fragColor = texture(uSceneColor, vUv);', write: (value) => `fragColor = vec4(${value}, 1.0);` }],
};
export function outputPins(model: ShaderModel): readonly OutputPin[] {
    return OUTPUT_PINS[model];
}
function outputNode(model: ShaderModel, label: string, description: string): NodeDefinition {
    return {
        type: OUTPUT_NODE_TYPE[model],
        label,
        category: 'output',
        description,
        models: [model],
        inputs: OUTPUT_PINS[model].map((pin) => ({ id: pin.id, label: pin.label, type: pin.type, connectOnly: true })),
        outputs: [],
        emit: () => ({}),
    };
}
export const OUTPUT_NODES: readonly NodeDefinition[] = [
    outputNode('surface', 'Saída PBR', 'Entrega a superfície à iluminação PBR da engine. Pinos soltos mantêm o valor do material; o Recorte descarta o pixel abaixo de 0,5.'),
    outputNode('post', 'Saída de tela', 'Cor final do efeito de pós-processamento. Sem ligação, a cena passa intacta.'),
];
