import { Grid3x3, Mountain, SunMedium, Warehouse, Waves, type LucideProps } from 'lucide-react';
import type { ProjectTemplateId } from '@/engine/project/project-record';
const ICONS: Record<ProjectTemplateId, typeof Grid3x3> = {
    baseplate: Grid3x3,
    occlusion: Warehouse,
    terrain: Mountain,
    reflections: Waves,
    empty: SunMedium,
};
export function TemplateIcon({ template, ...props }: LucideProps & {
    template: ProjectTemplateId;
}) {
    const Icon = ICONS[template] ?? Grid3x3;
    return <Icon {...props}/>;
}
