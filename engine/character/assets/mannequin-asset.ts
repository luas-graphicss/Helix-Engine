import { FileBundle } from '@/engine/assets/import/file-bundle';
import { importGltf } from '@/engine/assets/import/gltf/gltf-importer';
import { buildCharacterModelAsset, MANNEQUIN_MODEL_ID, type CharacterModelAsset } from './character-model-asset';
import { registerCharacterModel } from './character-model-registry';
export const MANNEQUIN_MODEL_URL = '/models/xbot.glb';
export const MANNEQUIN_LABEL = 'Manequim Helix';
let pending: Promise<CharacterModelAsset> | null = null;
let loaded: CharacterModelAsset | null = null;
export function loadMannequinAsset(): Promise<CharacterModelAsset> {
    if (pending)
        return pending;
    pending = (async () => {
        const response = await fetch(MANNEQUIN_MODEL_URL);
        if (!response.ok)
            throw new Error(`Não foi possível baixar o manequim (${response.status}).`);
        const file = new File([await response.blob()], 'xbot.glb', { type: 'model/gltf-binary' });
        const imported = await importGltf(file, new FileBundle([]));
        if (imported.skins.length === 0)
            throw new Error('O modelo do manequim não tem esqueleto.');
        const asset = buildCharacterModelAsset(imported, { id: MANNEQUIN_MODEL_ID, label: MANNEQUIN_LABEL, source: 'xbot.glb', builtin: true });
        loaded = asset;
        registerCharacterModel(asset);
        return asset;
    })();
    pending.catch(() => {
        pending = null;
    });
    return pending;
}
export function getLoadedMannequinAsset(): CharacterModelAsset | null {
    return loaded;
}
