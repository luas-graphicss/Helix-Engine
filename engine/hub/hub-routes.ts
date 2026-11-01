export const HUB_PATH = '/editor';
export function editorPath(projectId: string): string {
    return `${HUB_PATH}/${encodeURIComponent(projectId)}`;
}
