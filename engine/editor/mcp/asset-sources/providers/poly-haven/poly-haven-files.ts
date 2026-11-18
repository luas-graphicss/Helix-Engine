import type { MaterialTextureSlot } from '@/engine/core/scene/material';
import type { JsonRecord } from '@/engine/mcp/protocol/json-shape';
import type { AssetVariant, RemoteFile } from '../../catalog/asset-source';
import { baseNameOfPath, lastPathSegment } from '../../transport/file-naming';
import { httpsUrlAt, numberAt, recordAt, recordAtPath } from '../../transport/json-reading';
export type PolyHavenKind = 'model' | 'texture' | 'hdri';
interface TextureMap {
    readonly key: string;
    readonly slots: readonly MaterialTextureSlot[];
}
interface FileEntry {
    readonly url: URL;
    readonly bytes: number | null;
    readonly include: JsonRecord | null;
}
const HDRI_GROUP = 'hdri';
const FORMATS: Record<PolyHavenKind, readonly string[]> = { model: ['gltf', 'fbx'], texture: ['jpg', 'png'], hdri: ['hdr'] };
const QUALITIES: Record<PolyHavenKind, readonly string[]> = { model: ['2k', '1k', '4k', '8k'], texture: ['2k', '1k', '4k', '8k'], hdri: ['2k', '1k', '4k'] };
const TEXTURE_MAPS: readonly TextureMap[] = [
    { key: 'Diffuse', slots: ['baseColorMap'] },
    { key: 'nor_gl', slots: ['normalMap'] },
    { key: 'arm', slots: ['metallicRoughnessMap', 'occlusionMap'] },
];
function fileEntryAt(parent: JsonRecord | null, key: string): FileEntry | null {
    const record = parent ? recordAt(parent, key) : null;
    const url = record ? httpsUrlAt(record, 'url') : null;
    return record && url ? { url, bytes: numberAt(record, 'size'), include: recordAt(record, 'include') } : null;
}
function toRemoteFile(entry: FileEntry, name: string, slots: readonly MaterialTextureSlot[] = []): RemoteFile {
    return { url: entry.url, name, bytes: entry.bytes, slots };
}
function modelFiles(files: JsonRecord, format: string, quality: string): RemoteFile[] {
    const main = fileEntryAt(recordAtPath(files, format, quality), format);
    if (!main)
        return [];
    const { include } = main;
    const companions = Object.keys(include ?? {}).flatMap((path) => {
        const entry = fileEntryAt(include, path);
        return entry ? [toRemoteFile(entry, baseNameOfPath(path))] : [];
    });
    return [toRemoteFile(main, lastPathSegment(main.url)), ...companions];
}
function textureFiles(files: JsonRecord, format: string, quality: string): RemoteFile[] {
    const maps = TEXTURE_MAPS.flatMap(({ key, slots }) => {
        const entry = fileEntryAt(recordAtPath(files, key, quality), format);
        return entry ? [toRemoteFile(entry, lastPathSegment(entry.url), slots)] : [];
    });
    return maps.some((map) => map.slots.includes('baseColorMap')) ? maps : [];
}
function panoramaFiles(files: JsonRecord, format: string, quality: string): RemoteFile[] {
    const entry = fileEntryAt(recordAtPath(files, HDRI_GROUP, quality), format);
    return entry ? [toRemoteFile(entry, lastPathSegment(entry.url))] : [];
}
function totalBytes(files: readonly RemoteFile[]): number | null {
    let total = 0;
    for (const { bytes } of files) {
        if (bytes === null)
            return null;
        total += bytes;
    }
    return total;
}
export function resolvePolyHavenFiles(kind: PolyHavenKind, files: JsonRecord, format: string, quality: string): RemoteFile[] {
    switch (kind) {
        case 'model':
            return modelFiles(files, format, quality);
        case 'texture':
            return textureFiles(files, format, quality);
        case 'hdri':
            return panoramaFiles(files, format, quality);
    }
}
export function listPolyHavenVariants(kind: PolyHavenKind, files: JsonRecord): AssetVariant[] {
    return FORMATS[kind].flatMap((format) => QUALITIES[kind].flatMap((quality) => {
        const resolved = resolvePolyHavenFiles(kind, files, format, quality);
        return resolved.length > 0 ? [{ format, quality, bytes: totalBytes(resolved) }] : [];
    }));
}
