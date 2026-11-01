import type { EntityKind } from '@/engine/core/scene/entity';
import type { EntityJson, SceneResourcesDocument, SceneResourcesJson } from '../scene-document/scene-document';
export const PREFAB_EXTENSION = 'hxprefab';
export const PREFAB_MIME_TYPE = 'application/vnd.helix.prefab+zip';
export const PREFAB_DOCUMENT_FORMAT = 'helix-prefab';
export const PREFAB_DOCUMENT_VERSION = 1;
export interface PrefabJson extends SceneResourcesJson {
    format: typeof PREFAB_DOCUMENT_FORMAT;
    version: number;
    sceneVersion: number;
    savedAt: number;
    name: string;
    root: EntityJson;
    stats: {
        entities: number;
        triangles: number;
        rootKind: EntityKind;
    };
}
export interface PrefabDocument extends SceneResourcesDocument {
    json: PrefabJson;
}
export function isPrefabJson(value: unknown): value is PrefabJson {
    if (typeof value !== 'object' || value === null)
        return false;
    const json = value as Partial<PrefabJson>;
    return json.format === PREFAB_DOCUMENT_FORMAT && typeof json.version === 'number' && typeof json.root === 'object' && json.root !== null;
}
export function prefabFileName(name: string): string {
    const safe = name.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ') || 'Prefab';
    return `${safe}.${PREFAB_EXTENSION}`;
}
