import JSZip from 'jszip';
import { PROJECT_STORES, ProjectDatabase } from '@/engine/core/storage/project-database';
import { isTypedArray, typedArrayKind, createTypedArray, type TypedArrayKind } from './scene-document/plain-data';
import { isSceneJson, type SceneDocument, type SceneJson } from './scene-document/scene-document';
import { createProjectStats, PROJECT_FORMAT_VERSION, type ProjectRecord, type ProjectStats, type ProjectTemplateId } from './project-record';
import type { ProjectRegistry } from './project-registry';
import { SceneStore } from './scene-store';
import { PROJECT_TEMPLATES } from './templates/project-templates';
export const PROJECT_FILE_EXTENSION = '.helix';
export const PROJECT_FILE_MIME = 'application/x-helix-project';
const PROJECT_FILE_FORMAT = 'helix-project';
export type ProjectFileProgress = (label: string, fraction: number) => void;
interface ProjectManifest {
    format: typeof PROJECT_FILE_FORMAT;
    version: number;
    engine: string;
    exportedAt: number;
    project: {
        id: string;
        name: string;
        template: ProjectTemplateId;
        createdAt: number;
        updatedAt: number;
        stats: ProjectStats;
    };
}
const PACKED_STORES = [PROJECT_STORES.materials, PROJECT_STORES.assets, PROJECT_STORES.assetFiles] as const;
const STORED_AS_IS = /^(image\/|video\/|audio\/|model\/gltf-binary|application\/zip)/;
type BlobPlaceholder = {
    '@blob': string;
    type: string;
};
type ArrayPlaceholder = {
    '@array': TypedArrayKind;
    values: number[];
};
function errorMessage(cause: unknown): string {
    return cause instanceof Error ? cause.message : String(cause);
}
function fileOptions(blob: Blob): JSZip.JSZipFileOptions {
    return STORED_AS_IS.test(blob.type) ? { compression: 'STORE' } : { compression: 'DEFLATE' };
}
function packValue(value: unknown, zip: JSZip, dir: string, counter: {
    next: number;
}): unknown {
    if (value === null || typeof value !== 'object')
        return value === undefined ? null : value;
    if (value instanceof Blob) {
        const path = `${dir}/${counter.next++}.bin`;
        zip.file(path, value, fileOptions(value));
        return { '@blob': path, type: value.type } satisfies BlobPlaceholder;
    }
    if (isTypedArray(value))
        return { '@array': typedArrayKind(value), values: Array.from(value as ArrayLike<number>) } satisfies ArrayPlaceholder;
    if (Array.isArray(value))
        return value.map((item) => packValue(item, zip, dir, counter));
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
        if (item === undefined || typeof item === 'function')
            continue;
        result[key] = packValue(item, zip, dir, counter);
    }
    return result;
}
async function unpackValue(value: unknown, zip: JSZip): Promise<unknown> {
    if (value === null || typeof value !== 'object')
        return value;
    if (Array.isArray(value))
        return Promise.all(value.map((item) => unpackValue(item, zip)));
    const record = value as Record<string, unknown>;
    if (typeof record['@blob'] === 'string') {
        const entry = zip.file(record['@blob']);
        if (!entry)
            throw new Error(`O arquivo "${record['@blob']}" está faltando no pacote.`);
        return new Blob([await entry.async('arraybuffer')], { type: typeof record.type === 'string' ? record.type : '' });
    }
    if (typeof record['@array'] === 'string' && Array.isArray(record.values)) {
        return createTypedArray(record['@array'] as TypedArrayKind, record.values as number[]);
    }
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(record))
        result[key] = await unpackValue(item, zip);
    return result;
}
export async function exportProjectFile(record: ProjectRecord, onProgress: ProjectFileProgress = () => { }): Promise<Blob> {
    const database = new ProjectDatabase(record.databaseName);
    const zip = new JSZip();
    try {
        onProgress('Lendo a cena', 0.1);
        const document = await new SceneStore(database).loadCurrent();
        if (document) {
            zip.file('scene/scene.json', JSON.stringify(document.json), { compression: 'DEFLATE' });
            zip.file('scene/scene.bin', document.binary, { compression: 'DEFLATE' });
            document.images.forEach((image, index) => zip.file(`scene/images/${index}.png`, image, { compression: 'STORE' }));
        }
        let step = 0;
        for (const store of PACKED_STORES) {
            onProgress(`Empacotando ${store}`, 0.3 + 0.5 * (step++ / PACKED_STORES.length));
            const records = await database.getAll<unknown>(store);
            records.forEach((item, index) => {
                const packed = packValue(item, zip, `${store}/${index}`, { next: 0 });
                zip.file(`${store}/${index}.json`, JSON.stringify(packed), { compression: 'DEFLATE' });
            });
        }
        if (record.thumbnail)
            zip.file('thumbnail.jpg', record.thumbnail, { compression: 'STORE' });
        const manifest: ProjectManifest = {
            format: PROJECT_FILE_FORMAT,
            version: PROJECT_FORMAT_VERSION,
            engine: 'Helix Engine',
            exportedAt: Date.now(),
            project: { id: record.id, name: record.name, template: record.template, createdAt: record.createdAt, updatedAt: record.updatedAt, stats: record.stats },
        };
        zip.file('manifest.json', JSON.stringify(manifest, null, 2));
        onProgress('Comprimindo', 0.85);
        const blob = await zip.generateAsync({ type: 'blob', mimeType: PROJECT_FILE_MIME, compression: 'DEFLATE', compressionOptions: { level: 6 } });
        onProgress('Pronto', 1);
        return blob;
    }
    finally {
        await database.close();
    }
}
function parseManifest(text: string): ProjectManifest {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    }
    catch {
        throw new Error('O manifesto do pacote não é um JSON válido.');
    }
    const manifest = parsed as Partial<ProjectManifest>;
    if (manifest.format !== PROJECT_FILE_FORMAT || typeof manifest.version !== 'number' || !manifest.project) {
        throw new Error('Este arquivo não é um projeto da Helix Engine.');
    }
    if (manifest.version > PROJECT_FORMAT_VERSION) {
        throw new Error(`Este projeto foi exportado por uma versão mais nova da engine (formato ${manifest.version}).`);
    }
    return manifest as ProjectManifest;
}
async function readSceneDocument(zip: JSZip): Promise<SceneDocument | null> {
    const jsonEntry = zip.file('scene/scene.json');
    const binaryEntry = zip.file('scene/scene.bin');
    if (!jsonEntry || !binaryEntry)
        return null;
    const json: unknown = JSON.parse(await jsonEntry.async('string'));
    if (!isSceneJson(json))
        throw new Error('A cena do pacote está num formato irreconhecível.');
    const binary = await binaryEntry.async('arraybuffer');
    const images: Blob[] = [];
    for (let index = 0;; index++) {
        const entry = zip.file(`scene/images/${index}.png`);
        if (!entry)
            break;
        images.push(new Blob([await entry.async('arraybuffer')], { type: 'image/png' }));
    }
    return { json: json as SceneJson, binary, images };
}
export async function importProjectFile(file: File, registry: ProjectRegistry, onProgress: ProjectFileProgress = () => { }): Promise<ProjectRecord> {
    onProgress('Abrindo o pacote', 0.05);
    let zip: JSZip;
    try {
        zip = await JSZip.loadAsync(file);
    }
    catch (cause) {
        throw new Error(`Não foi possível abrir "${file.name}" como pacote: ${errorMessage(cause)}`);
    }
    const manifestEntry = zip.file('manifest.json');
    if (!manifestEntry)
        throw new Error('Este arquivo não é um projeto da Helix Engine (sem manifesto).');
    const manifest = parseManifest(await manifestEntry.async('string'));
    const template = PROJECT_TEMPLATES.some((candidate) => candidate.id === manifest.project.template) ? manifest.project.template : 'baseplate';
    const record = await registry.create(template, manifest.project.name);
    const database = new ProjectDatabase(record.databaseName);
    try {
        let step = 0;
        for (const store of PACKED_STORES) {
            onProgress(`Restaurando ${store}`, 0.15 + 0.5 * (step++ / PACKED_STORES.length));
            const entries = zip.file(new RegExp(`^${store}/\\d+\\.json$`));
            const items: unknown[] = [];
            for (const entry of entries)
                items.push(await unpackValue(JSON.parse(await entry.async('string')), zip));
            if (items.length === 0)
                continue;
            await database.withTransaction(store, 'readwrite', (transaction) => {
                const target = transaction.objectStore(store);
                for (const item of items)
                    target.put(item);
            });
        }
        onProgress('Restaurando a cena', 0.75);
        const document = await readSceneDocument(zip);
        if (document)
            await new SceneStore(database).saveCurrent(document);
        const thumbnailEntry = zip.file('thumbnail.jpg');
        const thumbnail = thumbnailEntry ? new Blob([await thumbnailEntry.async('arraybuffer')], { type: 'image/jpeg' }) : null;
        await registry.touchSaved(record.id, { stats: { ...createProjectStats(), ...manifest.project.stats }, thumbnail });
        onProgress('Pronto', 1);
        return registry.get(record.id) ?? record;
    }
    catch (cause) {
        await database.close();
        await registry.purge(record.id).catch(() => undefined);
        throw new Error(`A importação de "${file.name}" falhou: ${errorMessage(cause)}`);
    }
    finally {
        await database.close();
    }
}
