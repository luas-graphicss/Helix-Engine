import type { ProjectRecord } from '@/engine/project/project-record';
function normalize(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}
export function filterProjects(records: readonly ProjectRecord[], search: string): ProjectRecord[] {
    const needle = normalize(search);
    if (!needle)
        return [...records];
    return records.filter((record) => normalize(record.name).includes(needle));
}
