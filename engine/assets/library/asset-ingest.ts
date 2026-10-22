import { FileBundle, isDataUri } from '@/engine/assets/import/file-bundle';
import { importModelFile, isModelFile } from '@/engine/assets/import/import-registry';
import { baseNameWithoutExtension, computeImportStats, fileExtension, type ImportedScene } from '@/engine/assets/import/import-types';
import { decodeImage, mimeTypeFromFileName } from '@/engine/assets/image-decoder';
import type { AnimationDocument } from '@/engine/core/animation/animation-document';
import { animationDocumentsFromScene } from '@/engine/core/animation/animation-from-imported';
import { animationDocumentToFile, readAnimations } from '@/engine/core/animation/animation-io';
import { animationAssetDetails, isAnimationOnlyScene, modelRigDetails } from './animation-asset';
import { detectAssetKind } from './asset-kinds';
import type { AssetLibrary } from './asset-library';
import type { AssetDetails, AssetFileEntry, AssetKind, AssetSnapshot, AssetThumbnail, LibraryAsset } from './asset-types';
import { renderAnimationThumbnail } from './thumbnails/animation-thumbnail';
import { renderImageThumbnail } from './thumbnails/image-thumbnail';
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
}
const AUDIO_PROBE_TIMEOUT_MS = 4000;
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
function probeAudioDuration(file: File): Promise<number | null> {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const audio = new Audio();
        let settled = false;
        const finish = (value: number | null) => {
            if (settled)
                return;
            settled = true;
            URL.revokeObjectURL(url);
            audio.removeAttribute('src');
            resolve(value);
        };
        audio.preload = 'metadata';
        audio.onloadedmetadata = () => finish(Number.isFinite(audio.duration) ? audio.duration : null);
        audio.onerror = () => finish(null);
        setTimeout(() => finish(null), AUDIO_PROBE_TIMEOUT_MS);
        audio.src = url;
    });
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
export async function ingestFiles(library: AssetLibrary, files: File[], hooks: IngestHooks = {}): Promise<IngestReport> {
    const report: IngestReport = { added: [], duplicates: [], unsupported: [], failures: [] };
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
            const scene = hooks.parsedScenes?.get(file) ?? (await importModelFile(file, bundle));
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
            else {
                details = { kind: 'audio', durationSeconds: await probeAudioDuration(file) };
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
