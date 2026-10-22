import type { CharacterModelAsset } from './character-model-asset';
type Listener = () => void;
const models = new Map<string, CharacterModelAsset>();
const listeners = new Set<Listener>();
let version = 0;
let nextImportedId = 1;
let sorted: CharacterModelAsset[] = [];
function notify(): void {
    version++;
    sorted = Array.from(models.values()).sort((a, b) => Number(b.builtin) - Number(a.builtin) || a.label.localeCompare(b.label, 'pt-BR'));
    for (const listener of listeners)
        listener();
}
export function registerCharacterModel(asset: CharacterModelAsset): CharacterModelAsset {
    models.set(asset.id, asset);
    notify();
    return asset;
}
export function allocateCharacterModelId(): string {
    return `character_model_${nextImportedId++}`;
}
export function getCharacterModel(id: string): CharacterModelAsset | null {
    return models.get(id) ?? null;
}
export function listCharacterModels(): readonly CharacterModelAsset[] {
    return sorted;
}
export function removeCharacterModel(id: string): boolean {
    const asset = models.get(id);
    if (!asset || asset.builtin)
        return false;
    models.delete(id);
    notify();
    return true;
}
export function subscribeCharacterModels(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
export function characterModelsVersion(): number {
    return version;
}
