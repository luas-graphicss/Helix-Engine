import * as vec3 from '@/engine/core/math/vec3';
import { createDiscLight, createPointLight, createRectLight, createSpotLight, createTubeLight, type LocalLight, type LocalLightType, } from './light';
export type LightPresetId = 'candle' | 'bulb' | 'bonfire' | 'flashlight' | 'street-lamp' | 'stage-spot' | 'fluorescent' | 'neon' | 'softbox' | 'ceiling-panel' | 'downlight' | 'alarm';
export interface LightPreset {
    readonly id: LightPresetId;
    readonly label: string;
    readonly description: string;
    readonly type: LocalLightType;
    readonly create: () => LocalLight;
}
export const LIGHT_PRESETS: readonly LightPreset[] = [
    {
        id: 'candle',
        label: 'Vela',
        description: 'Chama pequena e quente, tremulando devagar; alcance curto.',
        type: 'point',
        create: () => createPointLight({ temperature: 1850, intensity: 3, range: 3.5, sourceRadius: 0.015, falloff: 2, animation: 'flicker', animationSpeed: 6, animationAmount: 0.35 }),
    },
    {
        id: 'bulb',
        label: 'Lâmpada incandescente',
        description: 'Bulbo de 60 W: branco quente, uniforme, para interiores.',
        type: 'point',
        create: () => createPointLight({ temperature: 2700, intensity: 15, range: 9, sourceRadius: 0.035 }),
    },
    {
        id: 'bonfire',
        label: 'Fogueira',
        description: 'Fonte larga e alaranjada, com tremulação forte e alcance médio.',
        type: 'point',
        create: () => createPointLight({ temperature: 1950, intensity: 28, range: 12, sourceRadius: 0.25, falloff: 2, animation: 'flicker', animationSpeed: 3.5, animationAmount: 0.5 }),
    },
    {
        id: 'flashlight',
        label: 'Lanterna',
        description: 'Feixe estreito e frio que alcança longe.',
        type: 'spot',
        create: () => createSpotLight({ temperature: 5800, intensity: 70, range: 28, innerAngle: 10, outerAngle: 20, sourceRadius: 0.03 }),
    },
    {
        id: 'street-lamp',
        label: 'Poste de rua',
        description: 'Vapor de sódio: cone largo e âmbar apontado para baixo.',
        type: 'spot',
        create: () => createSpotLight({ temperature: 2100, intensity: 55, range: 20, innerAngle: 40, outerAngle: 62, sourceRadius: 0.12 }),
    },
    {
        id: 'stage-spot',
        label: 'Canhão de palco',
        description: 'Feixe muito concentrado e intenso, branco neutro.',
        type: 'spot',
        create: () => createSpotLight({ temperature: 6200, intensity: 160, range: 45, innerAngle: 5, outerAngle: 9, sourceRadius: 0.08, specular: 1.2 }),
    },
    {
        id: 'fluorescent',
        label: 'Fluorescente',
        description: 'Tubo de 1,2 m, branco frio, com um zumbido visual leve.',
        type: 'tube',
        create: () => createTubeLight({ temperature: 4300, intensity: 10, range: 8, length: 1.2, sourceRadius: 0.018, animation: 'flicker', animationSpeed: 24, animationAmount: 0.06 }),
    },
    {
        id: 'neon',
        label: 'Neon',
        description: 'Tubo fino e saturado, magenta por padrão; brilha mais do que ilumina.',
        type: 'tube',
        create: () => createTubeLight({ color: vec3.create(1, 0.08, 0.55), intensity: 6, range: 5, length: 1, sourceRadius: 0.01, specular: 1.4 }),
    },
    {
        id: 'softbox',
        label: 'Softbox de estúdio',
        description: 'Painel 1 × 1 m, luz do dia, suave e sem brilho pontual.',
        type: 'rect',
        create: () => createRectLight({ temperature: 5600, intensity: 14, range: 10, width: 1, height: 1, specular: 0.8 }),
    },
    {
        id: 'ceiling-panel',
        label: 'Painel de teto',
        description: 'Luminária embutida 1,2 × 0,6 m, branco neutro.',
        type: 'rect',
        create: () => createRectLight({ temperature: 4000, intensity: 10, range: 8, width: 1.2, height: 0.6 }),
    },
    {
        id: 'downlight',
        label: 'Spot embutido',
        description: 'Disco pequeno e quente, para nichos e corredores.',
        type: 'disc',
        create: () => createDiscLight({ temperature: 3000, intensity: 8, range: 5, radius: 0.07 }),
    },
    {
        id: 'alarm',
        label: 'Alarme',
        description: 'Vermelho saturado piscando a 1 Hz.',
        type: 'point',
        create: () => createPointLight({ color: vec3.create(1, 0.04, 0.02), intensity: 25, range: 9, sourceRadius: 0.05, animation: 'strobe', animationSpeed: 1, animationAmount: 1 }),
    },
];
export function getLightPreset(id: LightPresetId): LightPreset {
    const preset = LIGHT_PRESETS.find((candidate) => candidate.id === id);
    if (!preset)
        throw new Error(`Preset de luz desconhecido: ${id}`);
    return preset;
}
