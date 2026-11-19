import { createCameraSettings, type CameraSettings } from './camera-settings';
import { renderLayerBit } from './layers/render-layers';
export type CameraPresetId = 'perspective' | 'orthographic' | 'overlay' | 'texture';
export interface CameraPreset {
    readonly id: CameraPresetId;
    readonly label: string;
    readonly actorName: string;
    readonly description: string;
    readonly create: () => CameraSettings;
}
const FOREGROUND_LAYER = 1;
export const CAMERA_PRESETS: readonly CameraPreset[] = [
    {
        id: 'perspective',
        label: 'Câmera perspectiva',
        actorName: 'Camera',
        description: 'Câmera base com profundidade: o que está longe aparece menor',
        create: createCameraSettings,
    },
    {
        id: 'orthographic',
        label: 'Câmera ortográfica',
        actorName: 'CameraOrtografica',
        description: 'Sem perspectiva: tamanhos não mudam com a distância. Mapas, 2D e vistas isométricas',
        create: () => ({ ...createCameraSettings(), projection: 'orthographic' }),
    },
    {
        id: 'overlay',
        label: 'Câmera de sobreposição',
        actorName: 'CameraSobreposicao',
        description: 'Desenha só a camada Primeiro plano por cima de uma câmera base, na pilha dela',
        create: () => ({ ...createCameraSettings(), role: 'overlay', cullingMask: renderLayerBit(FOREGROUND_LAYER) }),
    },
    {
        id: 'texture',
        label: 'Câmera para textura',
        actorName: 'CameraTextura',
        description: 'Grava a imagem numa textura que os materiais usam: monitores, espelhos e minimapas',
        create: () => ({ ...createCameraSettings(), target: 'texture' }),
    },
];
export function findCameraPreset(id: CameraPresetId): CameraPreset {
    return CAMERA_PRESETS.find((preset) => preset.id === id) ?? CAMERA_PRESETS[0];
}
