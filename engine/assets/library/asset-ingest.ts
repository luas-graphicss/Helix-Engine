import { FileBundle, isDataUri } from '@/engine/assets/import/file-bundle';
import { isModelFile } from '@/engine/assets/import/import-registry';
import { readModelFile } from '@/engine/assets/import/import-worker-client';
import { baseNameWithoutExtension, computeImportStats, fileExtension, type ImportedScene } from '@/engine/assets/import/import-types';
import { decodeImage, mimeTypeFromFileName } from '@/engine/assets/image-decoder';
import type { AnimationDocument } from '@/engine/core/animation/animation-document';
import { animationDocumentsFromScene } from '@/engine/core/animation/animation-from-imported';
import { animationDocumentToFile, readAnimations } from '@/engine/core/animation/animation-io';
import type { GuiDocument } from '@/engine/gui/document/gui-document';
import { guiDocumentToFile, readGuiDocument } from '@/engine/gui/document/gui-io';
import type { PrefabDocument } from '@/engine/project/prefab/prefab-document';
import { prefabDocumentToFile, readPrefabDocument } from '@/engine/project/prefab/prefab-io';
import type { ScriptDocument } from '@/engine/scripting/script-document';
import { readScriptDocument, scriptDocumentToFile } from '@/engine/scripting/script-io';
import type { VfxDocument } from '@/engine/vfx/document/vfx-document';
import { readVfxDocument, vfxDocumentToFile } from '@/engine/vfx/document/vfx-io';
import { animationAssetDetails, isAnimationOnlyScene, modelRigDetails } from './animation-asset';
import { detectAssetKind } from './asset-kinds';
import type { AssetLibrary } from './asset-library';
import type { AssetDetails, AssetFileEntry, AssetKind, AssetSnapshot, AssetThumbnail, AudioAssetDetails, LibraryAsset } from './asset-types';
import { audioAssetDetails, decodeAndAnalyzeAudio, probeAudioDuration, renderAudioThumbnail } from './audio-asset';
import { readFontDetails } from './font-asset';
import { guiAssetDetails } from './gui-asset';
import { prefabAssetDetails } from './prefab-asset';
import { renderAnimationThumbnail } from './thumbnails/animation-thumbnail';
import { renderFontThumbnail } from './thumbnails/font-thumbnail';
import { renderGuiThumbnail } from './thumbnails/gui-thumbnail';
import { renderImageThumbnail } from './thumbnails/image-thumbnail';
import { renderScriptThumbnail } from './thumbnails/script-thumbnail';
import { renderVfxThumbnail } from './thumbnails/vfx-thumbnail';
import { scriptAssetDetails } from './script-asset';
import { vfxAssetDetails } from './vfx-asset';
import { probeVideo } from './video-asset';
export interface ModelRendering {
    blob: Blob;
    dimensions: readonly [
        number,
        number,
        number
    ] | null;
}
export interface IngestHooks {
    renderModel?: (scene: ImportedScene) => Promise<ModelRendering | null>;
    parsedScenes?: ReadonlyMap<File, ImportedScene>;
    onProgress?: (file: File, index: number, total: number) => void;
}
export interface IngestedAsset {
    snapshot: AssetSnapshot;
    scene: ImportedScene | null;
}
export interface IngestReport {
    added: IngestedAsset[];
    duplicates: Array<{
        file: File;
        existing: LibraryAsset;
    }>;
    unsupported: File[];
    failures: Array<{
        file: File;
        message: string;
    }>;
    warnings: Array<{
        file: File;
        message: string;
    }>;
}
function errorMessage(cause: unknown): string {
    return cause instanceof Error ? cause.message : String(cause);
}
function relativePath(file: File): string {
    return file.webkitRelativePath || file.name;
}
function withPath(file: File, path: string): File {
    return file.name === path ? file : new File([file], path, { type: file.type, lastModified: file.lastModified });
}
function mimeTypeOf(file: File): string {
    return file.type || mimeTypeFromFileName(file.name) || 'application/octet-stream';
}
async function hashFile(file: File): Promise<string> {
    if (typeof crypto === 'undefined' || !crypto.subtle)
        return `${file.size}:${file.name.toLowerCase()}`;
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
function allocateId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
        return `asset_${crypto.randomUUID()}`;
    return `asset_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
async function readGltfBufferUris(file: File): Promise<string[]> {
    try {
        const document = JSON.parse(await file.text()) as {
            buffers?: Array<{
                uri?: string;
            }>;
        };
        return (document.buffers ?? []).map((buffer) => buffer.uri ?? '').filter((uri) => uri && !isDataUri(uri));
    }
    catch {
        return [];
    }
}
async function readObjMaterialLibraries(file: File): Promise<string[]> {
    const text = await file.text();
    const libraries: string[] = [];
    for (const match of text.matchAll(/^\s*mtllib\s+(.+?)\s*$/gm))
        libraries.push(match[1]);
    return libraries;
}
async function collectModelCompanions(file: File, scene: ImportedScene, bundle: FileBundle): Promise<File[]> {
    const from = relativePath(file);
    const references = scene.textures.map((texture) => texture.sourcePath).filter((path) => path && !isDataUri(path));
    if (scene.format === 'gltf')
        references.push(...(await readGltfBufferUris(file)));
    if (scene.format === 'obj')
        references.push(...(await readObjMaterialLibraries(file)));
    const companions = new Set<File>();
    for (const reference of references) {
        const resolved = bundle.resolve(reference, from);
        if (resolved && resolved !== file)
            companions.add(resolved);
    }
    return Array.from(companions);
}
interface IngestedAudio {
    details: AudioAssetDetails;
    thumbnail: AssetThumbnail | null;
    warning: string | null;
}
async function ingestAudio(file: File): Promise<IngestedAudio> {
    try {
        const decoded = await decodeAndAnalyzeAudio(file);
        const blob = await renderAudioThumbnail(decoded);
        return { details: audioAssetDetails(decoded.analysis, null), thumbnail: blob ? { blob, custom: false } : null, warning: null };
    }
    catch (cause) {
        return { details: audioAssetDetails(null, await probeAudioDuration(file)), thumbnail: null, warning: errorMessage(cause) };
    }
}
function createAsset(kind: AssetKind, name: string, primary: File, companions: File[], contentHash: string, details: AssetDetails, thumbnail: AssetThumbnail | null): LibraryAsset {
    const files: AssetFileEntry[] = [primary, ...companions].map((file) => ({ path: file.name, mimeType: mimeTypeOf(file), size: file.size }));
    const now = Date.now();
    return {
        id: allocateId(),
        kind,
        name,
        primaryPath: primary.name,
        files,
        format: fileExtension(primary.name),
        size: files.reduce((total, entry) => total + entry.size, 0),
        contentHash,
        tags: [],
        createdAt: now,
        updatedAt: now,
        details,
        thumbnail,
    };
}
export interface AnimationIngestResult {
    added: IngestedAsset | null;
    duplicate: LibraryAsset | null;
}
export async function ingestAnimationDocument(library: AssetLibrary, document: AnimationDocument, reservedNames?: Set<string>): Promise<AnimationIngestResult> {
    const file = animationDocumentToFile(document);
    const contentHash = await hashFile(file);
    const existing = library.findByHash(contentHash);
    if (existing)
        return { added: null, duplicate: existing };
    const name = library.uniqueName(document.name.trim() || baseNameWithoutExtension(file.name), reservedNames);
    reservedNames?.add(name);
    const thumbnailBlob = await renderAnimationThumbnail(document);
    const asset = createAsset('animation', name, file, [], contentHash, animationAssetDetails(document), thumbnailBlob ? { blob: thumbnailBlob, custom: false } : null);
    return { added: { snapshot: { asset, files: [file] }, scene: null }, duplicate: null };
}
export async function ingestAnimationReplacement(library: AssetLibrary, asset: LibraryAsset, document: AnimationDocument): Promise<AssetSnapshot | null> {
    const file = animationDocumentToFile(document);
    const contentHash = await hashFile(file);
    if (contentHash === asset.contentHash)
        return null;
    const trimmed = document.name.trim();
    const name = !trimmed || trimmed === asset.name ? asset.name : library.uniqueName(trimmed);
    const thumbnail = asset.thumbnail?.custom ? asset.thumbnail : await renderAnimationThumbnail(document).then((blob) => (blob ? { blob, custom: false } : null));
    const replaced: LibraryAsset = {
        ...asset,
        name,
        primaryPath: file.name,
        files: [{ path: file.name, mimeType: mimeTypeOf(file), size: file.size }],
        format: fileExtension(file.name),
        size: file.size,
        contentHash,
        updatedAt: Date.now(),
        details: animationAssetDetails(document),
        thumbnail,
    };
    return { asset: replaced, files: [file] };
}
export interface GuiIngestResult {
    added: IngestedAsset | null;
    duplicate: LibraryAsset | null;
}
export async function ingestGuiDocument(library: AssetLibrary, document: GuiDocument, options: {
    reservedNames?: Set<string>;
    forceNew?: boolean;
} = {}): Promise<GuiIngestResult> {
    const file = guiDocumentToFile(document);
    const contentHash = await hashFile(file);
    if (!options.forceNew) {
        const existing = library.findByHash(contentHash);
        if (existing)
            return { added: null, duplicate: existing };
    }
    const name = library.uniqueName(document.name.trim() || baseNameWithoutExtension(file.name), options.reservedNames);
    options.reservedNames?.add(name);
    const named = name === document.name ? document : { ...document, name };
    const namedFile = named === document ? file : guiDocumentToFile(named);
    const thumbnailBlob = await renderGuiThumbnail(named);
    const asset = createAsset('gui', name, namedFile, [], named === document ? contentHash : await hashFile(namedFile), guiAssetDetails(named), thumbnailBlob ? { blob: thumbnailBlob, custom: false } : null);
    return { added: { snapshot: { asset, files: [namedFile] }, scene: null }, duplicate: null };
}
export async function ingestGuiReplacement(library: AssetLibrary, asset: LibraryAsset, document: GuiDocument): Promise<AssetSnapshot | null> {
    const file = guiDocumentToFile(document);
    const contentHash = await hashFile(file);
    if (contentHash === asset.contentHash)
        return null;
    const trimmed = document.name.trim();
    const name = !trimmed || trimmed === asset.name ? asset.name : library.uniqueName(trimmed);
    const thumbnail = asset.thumbnail?.custom ? asset.thumbnail : await renderGuiThumbnail(document).then((blob) => (blob ? { blob, custom: false } : null));
    const replaced: LibraryAsset = {
        ...asset,
        name,
        primaryPath: file.name,
        files: [{ path: file.name, mimeType: mimeTypeOf(file), size: file.size }],
        format: fileExtension(file.name),
        size: file.size,
        contentHash,
        updatedAt: Date.now(),
        details: guiAssetDetails(document),
        thumbnail,
    };
    return { asset: replaced, files: [file] };
}
export interface VfxIngestResult {
    added: IngestedAsset | null;
    duplicate: LibraryAsset | null;
}
export async function ingestVfxDocument(library: AssetLibrary, document: VfxDocument, options: {
    reservedNames?: Set<string>;
    forceNew?: boolean;
} = {}): Promise<VfxIngestResult> {
    const file = vfxDocumentToFile(document);
    const contentHash = await hashFile(file);
    if (!options.forceNew) {
        const existing = library.findByHash(contentHash);
        if (existing)
            return { added: null, duplicate: existing };
    }
    const name = library.uniqueName(document.name.trim() || baseNameWithoutExtension(file.name), options.reservedNames);
    options.reservedNames?.add(name);
    const named = name === document.name ? document : { ...document, name };
    const namedFile = named === document ? file : vfxDocumentToFile(named);
    const thumbnailBlob = await renderVfxThumbnail(named);
    const asset = createAsset('vfx', name, namedFile, [], named === document ? contentHash : await hashFile(namedFile), vfxAssetDetails(named), thumbnailBlob ? { blob: thumbnailBlob, custom: false } : null);
    return { added: { snapshot: { asset, files: [namedFile] }, scene: null }, duplicate: null };
}
export async function ingestVfxReplacement(library: AssetLibrary, asset: LibraryAsset, document: VfxDocument): Promise<AssetSnapshot | null> {
    const file = vfxDocumentToFile(document);
    const contentHash = await hashFile(file);
    if (contentHash === asset.contentHash)
        return null;
    const trimmed = document.name.trim();
    const name = !trimmed || trimmed === asset.name ? asset.name : library.uniqueName(trimmed);
    const thumbnail = asset.thumbnail?.custom ? asset.thumbnail : await renderVfxThumbnail(document).then((blob) => (blob ? { blob, custom: false } : null));
    const replaced: LibraryAsset = {
        ...asset,
        name,
        primaryPath: file.name,
        files: [{ path: file.name, mimeType: mimeTypeOf(file), size: file.size }],
        format: fileExtension(file.name),
        size: file.size,
        contentHash,
        updatedAt: Date.now(),
        details: vfxAssetDetails(document),
        thumbnail,
    };
    return { asset: replaced, files: [file] };
}
export interface PrefabIngestResult {
    added: IngestedAsset | null;
    duplicate: LibraryAsset | null;
}
export async function ingestPrefabDocument(library: AssetLibrary, document: PrefabDocument, options: {
    reservedNames?: Set<string>;
    forceNew?: boolean;
} = {}): Promise<PrefabIngestResult> {
    const file = await prefabDocumentToFile(document);
    const contentHash = await hashFile(file);
    if (!options.forceNew) {
        const existing = library.findByHash(contentHash);
        if (existing)
            return { added: null, duplicate: existing };
    }
    const name = library.uniqueName(document.json.name.trim() || baseNameWithoutExtension(file.name), options.reservedNames);
    options.reservedNames?.add(name);
    const named: PrefabDocument = name === document.json.name ? document : { ...document, json: { ...document.json, name } };
    const namedFile = named === document ? file : await prefabDocumentToFile(named);
    const asset = createAsset('prefab', name, namedFile, [], named === document ? contentHash : await hashFile(namedFile), prefabAssetDetails(named.json), null);
    return { added: { snapshot: { asset, files: [namedFile] }, scene: null }, duplicate: null };
}
export interface ScriptIngestResult {
    added: IngestedAsset | null;
    duplicate: LibraryAsset | null;
}
export async function ingestScriptDocument(library: AssetLibrary, document: ScriptDocument, options: {
    reservedNames?: Set<string>;
    forceNew?: boolean;
} = {}): Promise<ScriptIngestResult> {
    const file = scriptDocumentToFile(document);
    const contentHash = await hashFile(file);
    if (!options.forceNew) {
        const existing = library.findByHash(contentHash);
        if (existing)
            return { added: null, duplicate: existing };
    }
    const name = library.uniqueName(document.name.trim() || baseNameWithoutExtension(file.name), options.reservedNames);
    options.reservedNames?.add(name);
    const named = name === document.name ? document : { ...document, name };
    const namedFile = named === document ? file : scriptDocumentToFile(named);
    const thumbnailBlob = await renderScriptThumbnail(named);
    const asset = createAsset('script', name, namedFile, [], contentHash, scriptAssetDetails(named), thumbnailBlob ? { blob: thumbnailBlob, custom: false } : null);
    return { added: { snapshot: { asset, files: [namedFile] }, scene: null }, duplicate: null };
}
export async function ingestScriptReplacement(library: AssetLibrary, asset: LibraryAsset, document: ScriptDocument): Promise<AssetSnapshot | null> {
    const file = scriptDocumentToFile(document);
    const contentHash = await hashFile(file);
    const details = scriptAssetDetails(document);
    const previous = asset.details.kind === 'script' ? asset.details : null;
    const metadataChanged = !previous || previous.runContext !== details.runContext || previous.entry !== details.entry || previous.language !== details.language;
    if (contentHash === asset.contentHash && !metadataChanged)
        return null;
    const trimmed = document.name.trim();
    const name = !trimmed || trimmed === asset.name ? asset.name : library.uniqueName(trimmed);
    const thumbnail = asset.thumbnail?.custom || contentHash === asset.contentHash ? asset.thumbnail : await renderScriptThumbnail(document).then((blob) => (blob ? { blob, custom: false } : null));
    const replaced: LibraryAsset = {
        ...asset,
        name,
        primaryPath: file.name,
        files: [{ path: file.name, mimeType: mimeTypeOf(file), size: file.size }],
        format: fileExtension(file.name),
        size: file.size,
        contentHash,
        updatedAt: Date.now(),
        details,
        thumbnail,
    };
    return { asset: replaced, files: [file] };
}
export async function ingestFiles(library: AssetLibrary, files: File[], hooks: IngestHooks = {}): Promise<IngestReport> {
    const report: IngestReport = { added: [], duplicates: [], unsupported: [], failures: [], warnings: [] };
    const bundle = new FileBundle(files);
    const consumed = new Set<File>();
    const reservedNames = new Set<string>();
    const models = files.filter(isModelFile);
    const others = files.filter((file) => !isModelFile(file));
    const total = models.length + others.filter((file) => detectAssetKind(file.name) !== null).length;
    let index = 0;
    const claimName = (file: File) => {
        const name = library.uniqueName(baseNameWithoutExtension(file.name), reservedNames);
        reservedNames.add(name);
        return name;
    };
    const extractAnimations = async (file: File, scene: ImportedScene) => {
        for (const document of animationDocumentsFromScene(scene)) {
            try {
                const result = await ingestAnimationDocument(library, document, reservedNames);
                if (result.added)
                    report.added.push(result.added);
                else if (result.duplicate)
                    report.duplicates.push({ file, existing: result.duplicate });
            }
            catch (cause) {
                report.failures.push({ file, message: `${document.name}: ${errorMessage(cause)}` });
            }
        }
    };
    for (const file of models) {
        hooks.onProgress?.(file, index++, total);
        try {
            const contentHash = await hashFile(file);
            const existing = library.findByHash(contentHash);
            if (existing) {
                report.duplicates.push({ file, existing });
                continue;
            }
            const scene = hooks.parsedScenes?.get(file) ?? (await readModelFile(file, bundle));
            const companions = await collectModelCompanions(file, scene, bundle);
            for (const companion of companions)
                consumed.add(companion);
            if (isAnimationOnlyScene(scene)) {
                await extractAnimations(file, scene);
                continue;
            }
            const rendering = (await hooks.renderModel?.(scene)) ?? null;
            const stats = computeImportStats(scene);
            const details: AssetDetails = {
                kind: 'model',
                format: scene.format,
                ...stats,
                dimensions: rendering?.dimensions ?? null,
                rig: modelRigDetails(scene),
                animations: scene.animations.map((animation) => animation.name),
            };
            const primary = withPath(file, relativePath(file));
            const companionFiles = companions.map((companion) => withPath(companion, relativePath(companion)));
            const asset = createAsset('model', claimName(file), primary, companionFiles, contentHash, details, rendering ? { blob: rendering.blob, custom: false } : null);
            report.added.push({ snapshot: { asset, files: [primary, ...companionFiles] }, scene });
            await extractAnimations(file, scene);
        }
        catch (cause) {
            report.failures.push({ file, message: errorMessage(cause) });
        }
    }
    for (const file of others) {
        if (consumed.has(file))
            continue;
        const kind = detectAssetKind(file.name);
        if (!kind) {
            report.unsupported.push(file);
            continue;
        }
        hooks.onProgress?.(file, index++, total);
        try {
            if (kind === 'animation') {
                const { documents } = await readAnimations(file);
                for (const document of documents) {
                    const result = await ingestAnimationDocument(library, document, reservedNames);
                    if (result.added)
                        report.added.push(result.added);
                    else if (result.duplicate)
                        report.duplicates.push({ file, existing: result.duplicate });
                }
                continue;
            }
            if (kind === 'gui') {
                const result = await ingestGuiDocument(library, await readGuiDocument(file), { reservedNames });
                if (result.added)
                    report.added.push(result.added);
                else if (result.duplicate)
                    report.duplicates.push({ file, existing: result.duplicate });
                continue;
            }
            if (kind === 'vfx') {
                const result = await ingestVfxDocument(library, await readVfxDocument(file), { reservedNames });
                if (result.added)
                    report.added.push(result.added);
                else if (result.duplicate)
                    report.duplicates.push({ file, existing: result.duplicate });
                continue;
            }
            if (kind === 'prefab') {
                const result = await ingestPrefabDocument(library, await readPrefabDocument(file), { reservedNames });
                if (result.added)
                    report.added.push(result.added);
                else if (result.duplicate)
                    report.duplicates.push({ file, existing: result.duplicate });
                continue;
            }
            if (kind === 'script') {
                const result = await ingestScriptDocument(library, await readScriptDocument(file), { reservedNames });
                if (result.added)
                    report.added.push(result.added);
                else if (result.duplicate)
                    report.duplicates.push({ file, existing: result.duplicate });
                continue;
            }
            const contentHash = await hashFile(file);
            const existing = library.findByHash(contentHash);
            if (existing) {
                report.duplicates.push({ file, existing });
                continue;
            }
            const primary = withPath(file, relativePath(file));
            let details: AssetDetails;
            let thumbnail: AssetThumbnail | null = null;
            if (kind === 'texture') {
                const image = await decodeImage(file, mimeTypeOf(file));
                details = { kind: 'texture', width: image.width, height: image.height };
                thumbnail = { blob: await renderImageThumbnail(image), custom: false };
                if (image instanceof ImageBitmap)
                    image.close();
            }
            else if (kind === 'font') {
                details = await readFontDetails(file);
                const blob = await renderFontThumbnail(file);
                thumbnail = blob ? { blob, custom: false } : null;
                if (!blob)
                    report.warnings.push({ file, message: 'O navegador não conseguiu carregar esta fonte; ela pode não aparecer nas telas.' });
            }
            else if (kind === 'video') {
                const probed = await probeVideo(file);
                details = probed.details;
                thumbnail = probed.thumbnail ? { blob: probed.thumbnail, custom: false } : null;
                if (probed.warning)
                    report.warnings.push({ file, message: probed.warning });
            }
            else {
                const ingested = await ingestAudio(file);
                details = ingested.details;
                thumbnail = ingested.thumbnail;
                if (ingested.warning)
                    report.warnings.push({ file, message: ingested.warning });
            }
            const asset = createAsset(kind, claimName(file), primary, [], contentHash, details, thumbnail);
            report.added.push({ snapshot: { asset, files: [primary] }, scene: null });
        }
        catch (cause) {
            report.failures.push({ file, message: errorMessage(cause) });
        }
    }
    return report;
}
