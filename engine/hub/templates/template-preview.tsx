'use client';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { ProjectTemplate } from '@/engine/project/templates/project-templates';
import { TemplateIcon } from './template-icon';
import { templateThumbnailUrl } from './template-thumbnail';
interface TemplatePreviewProps {
    template: ProjectTemplate;
    className?: string;
}
type ImageState = 'loading' | 'ready' | 'failed';
export function TemplatePreview({ template, className }: TemplatePreviewProps) {
    const [state, setState] = useState<ImageState>('loading');
    return (<div className={cn('relative overflow-hidden bg-surface-sunken', className)}>
      {state !== 'failed' && (<img src={templateThumbnailUrl(template.id)} alt={`Pré-visualização do template ${template.name}`} draggable={false} decoding="async" onLoad={() => setState('ready')} onError={() => setState('failed')} className={cn('absolute inset-0 size-full object-cover transition-[opacity,transform] duration-500 ease-out group-hover:scale-[1.04]', state === 'ready' ? 'opacity-100' : 'opacity-0')}/>)}
      {state !== 'ready' && (<div className="boot-grid absolute inset-0 flex items-center justify-center" aria-hidden>
          <TemplateIcon template={template.id} className={cn('size-7 text-muted-foreground/50', state === 'loading' && 'animate-pulse')}/>
        </div>)}
    </div>);
}
