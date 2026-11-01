import type { ProjectTemplateId } from '@/engine/project/project-record';
export function templateThumbnailUrl(id: ProjectTemplateId): string {
    return `/templates/${id}.webp`;
}
