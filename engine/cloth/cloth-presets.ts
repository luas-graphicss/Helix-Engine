import type { MeshData } from '@/engine/renderer/geometry/mesh-data';
import { createClothSettings, type ClothSettings } from './cloth-settings';
import { createFlatSheet, createHangingSheet, createSkirt } from './mesh/cloth-shapes';
const CLOTH_PRESET_IDS = ['sheet', 'flag', 'cape', 'garment'] as const;
export type ClothPresetId = (typeof CLOTH_PRESET_IDS)[number];
interface ClothPreset {
    readonly id: ClothPresetId;
    readonly label: string;
    readonly description: string;
    readonly settings: Readonly<ClothSettings>;
    readonly createMesh: () => MeshData;
}
export const CLOTH_PRESETS: readonly ClothPreset[] = [
    {
        id: 'sheet',
        label: 'Tecido',
        description: 'Pano solto de 2 m: cai e se molda aos colisores que encontrar pelo caminho',
        settings: createClothSettings({ density: 0.3, bendStiffness: 0.25 }),
        createMesh: () => createFlatSheet('Tecido', { width: 2, length: 2, columns: 28, rows: 28 }),
    },
    {
        id: 'flag',
        label: 'Bandeira',
        description: 'Presa pela lateral, como num mastro, e agitada pelo vento',
        settings: createClothSettings({ anchor: 'left', density: 0.15, stretchStiffness: 0.95, bendStiffness: 0.1, damping: 0.08, windSpeed: 8, windTurbulence: 0.6, airDrag: 1.4 }),
        createMesh: () => createHangingSheet('Bandeira', { width: 1.5, length: 1, columns: 30, rows: 20 }),
    },
    {
        id: 'cape',
        label: 'Capa',
        description: 'Presa pela borda de cima: acompanha o ator pai e ondula atrás dele',
        settings: createClothSettings({ anchor: 'top', density: 0.35, bendStiffness: 0.3, damping: 0.2, airDrag: 1.2 }),
        createMesh: () => createHangingSheet('Capa', { width: 0.8, length: 1.25, columns: 16, rows: 24 }),
    },
    {
        id: 'garment',
        label: 'Roupa',
        description: 'Saia presa pela cintura que balança com o movimento de quem a veste',
        settings: createClothSettings({ anchor: 'top', anchorBand: 0.06, density: 0.3, bendStiffness: 0.35, damping: 0.25, thickness: 0.025 }),
        createMesh: () => createSkirt('Saia', { waistRadius: 0.17, hemRadius: 0.36, length: 0.6, columns: 32, rows: 12 }),
    },
];
export function getClothPreset(id: ClothPresetId): ClothPreset {
    const preset = CLOTH_PRESETS.find((candidate) => candidate.id === id);
    if (!preset)
        throw new Error(`Unknown cloth preset "${id}"`);
    return preset;
}
export function findClothPreset(settings: ClothSettings): ClothPresetId | null {
    const keys = Object.keys(settings) as (keyof ClothSettings)[];
    const match = CLOTH_PRESETS.find((preset) => keys.every((key) => preset.settings[key] === settings[key]));
    return match?.id ?? null;
}
