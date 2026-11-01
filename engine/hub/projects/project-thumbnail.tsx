'use client';
import { cn } from '@/lib/utils';
import type { ProjectRecord } from '@/engine/project/project-record';
import { getProjectTemplate } from '@/engine/project/templates/project-templates';
import { TemplateIcon } from '../templates/template-icon';
import { useObjectUrl } from '../use-object-url';
export function ProjectThumbnail({ record, className }: {
    record: ProjectRecord;
    className?: string;
}) {
    const url = useObjectUrl(record.thumbnail);
    const template = getProjectTemplate(record.template);
    return (<div className={cn('relative aspect-video w-full overflow-hidden bg-surface-sunken', className)}>
      {url ? (<img src={url} alt="" className="size-full object-cover" draggable={false}/>) : (<div className="boot-grid flex size-full items-center justify-center" aria-hidden>
          <TemplateIcon template={record.template} className="size-6 text-muted-foreground/50"/>
        </div>)}
      <span className="absolute bottom-2 left-2 rounded-xs border border-border/70 bg-background/80 px-1.5 py-px font-mono text-3xs text-muted-foreground backdrop-blur-sm">{template.name}</span>
    </div>);
}
