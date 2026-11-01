'use client';
import { PROJECT_TEMPLATES } from '@/engine/project/templates/project-templates';
import { TemplateCard } from './template-card';
export function TemplateGallery() {
    return (<div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {PROJECT_TEMPLATES.map((template) => (<TemplateCard key={template.id} template={template}/>))}
    </div>);
}
