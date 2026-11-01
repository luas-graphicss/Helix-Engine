'use client';
import { useRouter } from 'next/navigation';
import { Clock, ImageOff } from 'lucide-react';
import { DropdownMenuItem, DropdownMenuLabel, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from '@/components/ui/dropdown-menu';
import { formatRelativeTime } from '@/engine/core/format/format-time';
import { useObjectUrl } from '@/engine/hub/use-object-url';
import { useProjectRegistry } from '@/engine/hub/use-project-registry';
import type { ProjectRecord } from '@/engine/project/project-record';
import { switchToProject } from '../operations/engine-operations';
import { useEditorSession } from '../session/editor-session-context';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS, MENU_LABEL_CLASS } from './menu-styles';
const MAX_RECENT_PROJECTS = 8;
function RecentProjectThumbnail({ blob }: {
    blob: Blob | null;
}) {
    const url = useObjectUrl(blob);
    return (<span className="flex h-6 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xs border border-border bg-surface-sunken shadow-well">
      {url ? <img src={url} alt="" className="size-full object-cover"/> : <ImageOff className="size-3 text-muted-foreground/60" aria-hidden/>}
    </span>);
}
function RecentProjectItem({ record }: {
    record: ProjectRecord;
}) {
    const session = useEditorSession();
    const router = useRouter();
    return (<DropdownMenuItem className={`${MENU_ITEM_CLASS} py-1.5`} onClick={() => void switchToProject(session, router, record)}>
      <RecentProjectThumbnail blob={record.thumbnail}/>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-foreground">{record.name}</span>
        <span className="truncate font-mono text-3xs text-muted-foreground">
          {formatRelativeTime(record.openedAt)} · {record.stats.entities.toLocaleString('pt-BR')} atores
        </span>
      </span>
    </DropdownMenuItem>);
}
export function RecentProjectsSubmenu() {
    const session = useEditorSession();
    const registry = useProjectRegistry();
    const recents = registry.active.filter((record) => record.id !== session.project.id).slice(0, MAX_RECENT_PROJECTS);
    return (<DropdownMenuSub>
      <DropdownMenuSubTrigger className={MENU_ITEM_CLASS}>
        <Clock aria-hidden/>
        Recentes
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className={`${MENU_CONTENT_CLASS} max-w-72`}>
        {recents.length === 0 ? (<DropdownMenuLabel className={`${MENU_LABEL_CLASS} pl-2 normal-case tracking-normal`}>Nenhum outro jogo neste navegador.</DropdownMenuLabel>) : (recents.map((record) => <RecentProjectItem key={record.id} record={record}/>))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>);
}
