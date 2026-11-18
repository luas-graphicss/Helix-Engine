import { readPreference, writePreference } from '@/engine/core/storage/preferences';
const PREFERENCE_KEY = 'extension-trusted-projects';
const MAX_TRUSTED_PROJECTS = 500;
function readProjectIds(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}
export async function isProjectTrusted(projectId: string): Promise<boolean> {
    return readProjectIds(await readPreference<unknown>(PREFERENCE_KEY)).includes(projectId);
}
export async function trustProject(projectId: string): Promise<void> {
    const others = readProjectIds(await readPreference<unknown>(PREFERENCE_KEY)).filter((id) => id !== projectId);
    await writePreference(PREFERENCE_KEY, [...others, projectId].slice(-MAX_TRUSTED_PROJECTS));
}
