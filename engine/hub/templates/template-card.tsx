'use client';
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CARD_CLASS } from '@/engine/ui/surface-styles';
import type { ProjectTemplate } from '@/engine/project/templates/project-templates';
import { useHub } from '../hub-context';
import { TemplatePreview } from './template-preview';
export function TemplateCard({ template }: {
    template: ProjectTemplate;
}) {
    const { actions, registry } = useHub();
    const [creating, setCreating] = useState(false);
    const disabled = registry.status !== 'ready' || creating;
    const create = async () => {
        setCreating(true);
        try {
            await actions.createProject(template.id);
        }
        finally {
            setCreating(false);
        }
    };
    return (<article className={cn('group flex flex-col overflow-hidden transition-colors duration-150 hover:border-border-strong', CARD_CLASS)}>
      <div className="relative aspect-video border-b border-border">
        <TemplatePreview template={template} className="absolute inset-0"/>
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-surface to-transparent"/>
        <h3 className="absolute bottom-3 left-4 text-base font-semibold tracking-tight text-foreground">{template.name}</h3>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4">
        <p className="text-xs leading-relaxed text-muted-foreground text-pretty">{template.description}</p>
        <ul className="flex flex-wrap gap-1.5" aria-label="O que o template traz">
          {template.highlights.map((highlight) => (<li key={highlight} className="rounded-xs border border-border bg-surface-sunken px-1.5 py-0.5 font-mono text-3xs text-muted-foreground shadow-well">
              {highlight}
            </li>))}
        </ul>
        <Button size="sm" className="mt-auto w-full justify-between" disabled={disabled} onClick={create}>
          {creating ? 'Criando…' : 'Criar jogo'}
          <ArrowRight data-icon="inline-end" aria-hidden/>
        </Button>
      </div>
    </article>);
}
