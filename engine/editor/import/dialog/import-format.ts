import type { ImportedMaterial, ImportedScene } from '@/engine/assets/import/import-types';
export function formatInteger(value: number): string {
    return value.toLocaleString('pt-BR');
}
export function formatBytes(bytes: number): string {
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} KB`;
    if (bytes < 1024 * 1024 * 1024)
        return `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} GB`;
}
export function formatMeters(value: number): string {
    if (value >= 1000)
        return `${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} km`;
    if (value >= 1)
        return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m`;
    if (value >= 0.01)
        return `${(value * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} cm`;
    return `${(value * 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mm`;
}
export function describeUnits(metersPerUnit: number): string {
    const known: Array<[
        number,
        string
    ]> = [
        [1, 'metros'],
        [0.01, 'centímetros'],
        [0.001, 'milímetros'],
        [0.0254, 'polegadas'],
        [0.3048, 'pés'],
        [1000, 'quilômetros'],
    ];
    const match = known.find(([value]) => Math.abs(value - metersPerUnit) / value < 1e-3);
    if (match)
        return match[1];
    return `${metersPerUnit.toLocaleString('pt-BR', { maximumSignificantDigits: 4 })} m por unidade`;
}
export function formatScale(value: number): string {
    return `×${value.toLocaleString('pt-BR', { maximumSignificantDigits: 4 })}`;
}
export interface TextureUsage {
    material: string;
    slot: string;
}
const MATERIAL_MAP_SLOTS: ReadonlyArray<{
    key: keyof ImportedMaterial;
    label: string;
}> = [
    { key: 'baseColorMap', label: 'Cor base' },
    { key: 'normalMap', label: 'Normal' },
    { key: 'metallicRoughnessMap', label: 'Metálico/Rugosidade' },
    { key: 'roughnessMap', label: 'Rugosidade' },
    { key: 'metallicMap', label: 'Metálico' },
    { key: 'occlusionMap', label: 'Oclusão' },
    { key: 'emissiveMap', label: 'Emissivo' },
];
export function computeTextureUsages(scene: ImportedScene): TextureUsage[][] {
    const usages = scene.textures.map(() => [] as TextureUsage[]);
    for (const material of scene.materials) {
        for (const { key, label } of MATERIAL_MAP_SLOTS) {
            const index = material[key];
            if (typeof index === 'number' && usages[index])
                usages[index].push({ material: material.name, slot: label });
        }
    }
    return usages;
}
export function listMaterialMaps(material: ImportedMaterial): Array<{
    slot: string;
    texture: number;
}> {
    const maps: Array<{
        slot: string;
        texture: number;
    }> = [];
    for (const { key, label } of MATERIAL_MAP_SLOTS) {
        const index = material[key];
        if (typeof index === 'number')
            maps.push({ slot: label, texture: index });
    }
    return maps;
}
