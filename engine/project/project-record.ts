import { projectDatabaseName } from '@/engine/core/storage/project-database';
export const DEFAULT_PROJECT_NAME = 'Jogo sem título';
export const MAX_PROJECT_NAME_LENGTH = 80;
export const PROJECT_FORMAT_VERSION = 1;
export type ProjectTemplateId = 'baseplate' | 'occlusion' | 'terrain' | 'reflections' | 'empty';
export interface ProjectStats {
    entities: number;
    assets: number;
    materials: number;
}
export interface ProjectRecord {
    id: string;
    name: string;
    template: ProjectTemplateId;
    databaseName: string;
    createdAt: number;
    updatedAt: number;
    openedAt: number;
    deletedAt: number | null;
    thumbnail: Blob | null;
    stats: ProjectStats;
}
export function generateProjectId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
        return crypto.randomUUID();
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
export function createProjectStats(): ProjectStats {
    return { entities: 0, assets: 0, materials: 0 };
}
export function createProjectRecord(template: ProjectTemplateId, name: string = DEFAULT_PROJECT_NAME): ProjectRecord {
    const id = generateProjectId();
    const now = Date.now();
    return {
        id,
        name: normalizeProjectName(name),
        template,
        databaseName: projectDatabaseName(id),
        createdAt: now,
        updatedAt: now,
        openedAt: now,
        deletedAt: null,
        thumbnail: null,
        stats: createProjectStats(),
    };
}
export function normalizeProjectName(name: string): string {
    const trimmed = name.replace(/\s+/g, ' ').trim().slice(0, MAX_PROJECT_NAME_LENGTH);
    return trimmed || DEFAULT_PROJECT_NAME;
}
export function projectFileName(record: ProjectRecord): string {
    const slug = record.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();
    return `${slug || 'jogo'}.helix`;
}
