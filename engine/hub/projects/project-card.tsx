'use client';
import { Ellipsis } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu';
import { DropdownMenu, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { CARD_CLASS } from '@/engine/ui/surface-styles';
import type { ProjectRecord } from '@/engine/project/project-record';
import { formatRelativeTime, plural } from '@/engine/core/format/format-time';
import { useHub } from '../hub-context';
import { ProjectContextContent, ProjectDropdownContent } from './project-menu';
import { ProjectThumbnail } from './project-thumbnail';
export function ProjectCard({ record }: {
    record: ProjectRecord;
}) {
    const { actions } = useHub();
    const meta = [formatRelativeTime(record.openedAt), plural(record.stats.entities, 'ator', 'atores')];
    if (record.stats.assets > 0)
        meta.push(plural(record.stats.assets, 'ativo', 'ativos'));
    return (<ContextMenu>
      <ContextMenuTrigger render={<article className={cn('group relative flex flex-col overflow-hidden transition-colors duration-150 focus-within:border-primary/60 hover:border-border-strong', CARD_CLASS)}/>}>
        <button type="button" className="flex flex-col text-left outline-none" onClick={() => actions.openProject(record)} onPointerEnter={() => actions.prefetchEditor(record)} onFocus={() => actions.prefetchEditor(record)} aria-label={`Abrir ${record.name}`}>
          <ProjectThumbnail record={record} className="border-b border-border"/>
          <span className="flex flex-col gap-1 p-3 pr-10">
            <span className="truncate text-xs font-medium text-foreground">{record.name}</span>
            <span className="truncate font-mono text-3xs text-muted-foreground">{meta.join(' · ')}</span>
          </span>
        </button>

        <div className="absolute right-2 bottom-2.5">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" aria-label={`Ações de ${record.name}`}/>}>
              <Ellipsis aria-hidden/>
            </DropdownMenuTrigger>
            <ProjectDropdownContent record={record}/>
          </DropdownMenu>
        </div>
      </ContextMenuTrigger>
      <ProjectContextContent record={record}/>
    </ContextMenu>);
}
