import { detectAssetKind } from '@/engine/assets/library/asset-kinds';
import type { AssetKind, LibraryAsset } from '@/engine/assets/library/asset-types';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import type { MaterialTextureSlot } from '@/engine/core/scene/material';
import { summarizeEntity } from '@/engine/editor/assistant/tools/entity-summary';
import { ToolFailure } from '@/engine/editor/assistant/tools/tool-failure';
import { addOrReuseLibraryFiles } from '@/engine/editor/operations/asset-library-operations';
import type { ImportPlacement } from '@/engine/editor/operations/import-operations';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import type { RemoteAssetKind } from '../catalog/asset-source';
import { placeAudio } from './audio-insertion';
import { addBackdropDome, convertPanorama } from './backdrop-insertion';
import { applyMaterialMaps } from './material-map-insertion';
import { insertModel } from './model-insertion';
import type { DownloadedFile } from './package-download';
export interface InsertionOptions {
    readonly name: string;
    readonly entity: Entity | null;
    readonly slot: MaterialTextureSlot;
    readonly placement: ImportPlacement;
    readonly position: Vec3 | null;
    readonly addToScene: boolean;
    readonly saveToLibrary: boolean;
}
function filesOf(downloads: readonly DownloadedFile[]): File[] {
    return downloads.map(({ file }) => file);
}
function presentLibraryAssets(assets: readonly LibraryAsset[]): object[] {
    return assets.map(({ id, name, kind }) => ({ id, name, kind }));
}
function requireImportable(files: readonly File[], kind: AssetKind): void {
    const rejected = files.find((file) => detectAssetKind(file.name) !== kind);
    if (rejected)
        throw new ToolFailure(`The engine cannot import "${rejected.name}" as ${kind}. Pick another format from inspect_asset.`);
}
async function insertMaterialMaps(session: EditorSession, maps: readonly DownloadedFile[], entity: Entity | null): Promise<object> {
    const files = filesOf(maps);
    requireImportable(files, 'texture');
    const applied = entity ? await applyMaterialMaps(session, entity, maps) : [];
    return { library: presentLibraryAssets(await addOrReuseLibraryFiles(session, files)), applied };
}
async function insertAudio(session: EditorSession, downloads: readonly DownloadedFile[], options: InsertionOptions): Promise<object> {
    const files = filesOf(downloads);
    requireImportable(files, 'audio');
    const [asset] = await addOrReuseLibraryFiles(session, files);
    if (!asset)
        throw new ToolFailure('The audio could not be added to the asset library. Call read_console for the reason.');
    return { library: presentLibraryAssets([asset]), ...placeAudio(session, asset, options) };
}
async function insertPanorama(session: EditorSession, downloads: readonly DownloadedFile[], options: InsertionOptions): Promise<object> {
    const panorama = await convertPanorama(downloads[0].file, options.name);
    const library = presentLibraryAssets(await addOrReuseLibraryFiles(session, [panorama]));
    if (!options.addToScene)
        return { library };
    return { library, backdrop: summarizeEntity(await addBackdropDome(session, panorama, options.name)) };
}
export function insertDownloadedAsset(session: EditorSession, kind: RemoteAssetKind, downloads: readonly DownloadedFile[], options: InsertionOptions): Promise<object> {
    switch (kind) {
        case 'model':
            return insertModel(session, filesOf(downloads), options);
        case 'texture':
            return insertMaterialMaps(session, downloads, options.entity);
        case 'image':
            return insertMaterialMaps(session, downloads.map(({ file }) => ({ file, slots: [options.slot] })), options.entity);
        case 'audio':
            return insertAudio(session, downloads, options);
        case 'hdri':
            return insertPanorama(session, downloads, options);
    }
}
