export const RENDER_LAYER_COUNT = 16;
export const DEFAULT_RENDER_LAYER = 0;
export const ALL_RENDER_LAYERS = (1 << RENDER_LAYER_COUNT) - 1;
export const MAX_RENDER_LAYER_NAME_LENGTH = 24;
const DEFAULT_LAYER_NAMES: readonly string[] = ['Padrão', 'Primeiro plano', 'Interface'];
export interface RenderLayerSettings {
    names: string[];
}
export function createRenderLayerSettings(): RenderLayerSettings {
    return { names: Array.from({ length: RENDER_LAYER_COUNT }, (_, layer) => DEFAULT_LAYER_NAMES[layer] ?? '') };
}
export function normalizeRenderLayerSettings(settings: RenderLayerSettings): RenderLayerSettings {
    const source = Array.isArray(settings.names) ? settings.names : [];
    const names = Array.from({ length: RENDER_LAYER_COUNT }, (_, layer) => {
        const name: unknown = source[layer];
        return typeof name === 'string' ? name.trim().slice(0, MAX_RENDER_LAYER_NAME_LENGTH) : '';
    });
    if (names[DEFAULT_RENDER_LAYER] === '')
        names[DEFAULT_RENDER_LAYER] = DEFAULT_LAYER_NAMES[DEFAULT_RENDER_LAYER];
    return { names };
}
export function clampRenderLayer(layer: number): number {
    if (!Number.isFinite(layer))
        return DEFAULT_RENDER_LAYER;
    return Math.max(0, Math.min(Math.floor(layer), RENDER_LAYER_COUNT - 1));
}
export function renderLayerBit(layer: number): number {
    return 1 << clampRenderLayer(layer);
}
export function normalizeLayerMask(mask: number): number {
    return Number.isFinite(mask) ? mask & ALL_RENDER_LAYERS : ALL_RENDER_LAYERS;
}
export function maskIncludesLayer(mask: number, layer: number): boolean {
    return (mask & renderLayerBit(layer)) !== 0;
}
export function toggleMaskLayer(mask: number, layer: number): number {
    return normalizeLayerMask(mask ^ renderLayerBit(layer));
}
export function isRenderLayerNamed(settings: RenderLayerSettings, layer: number): boolean {
    return (settings.names[layer] ?? '') !== '';
}
export function renderLayerName(settings: RenderLayerSettings, layer: number): string {
    return settings.names[layer] || `Camada ${layer}`;
}
export function namedRenderLayers(settings: RenderLayerSettings): number[] {
    const layers: number[] = [];
    for (let layer = 0; layer < RENDER_LAYER_COUNT; layer++) {
        if (isRenderLayerNamed(settings, layer))
            layers.push(layer);
    }
    return layers;
}
export function firstUnnamedRenderLayer(settings: RenderLayerSettings): number | null {
    for (let layer = 0; layer < RENDER_LAYER_COUNT; layer++) {
        if (!isRenderLayerNamed(settings, layer))
            return layer;
    }
    return null;
}
