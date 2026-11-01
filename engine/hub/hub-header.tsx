'use client';
import { FolderInput, Plus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS } from '@/engine/editor/menus/menu-styles';
import { TEXT_INPUT_CLASS } from '@/engine/ui/surface-styles';
import { PROJECT_TEMPLATES } from '@/engine/project/templates/project-templates';
import { useHub, type HubSection } from './hub-context';
import { TemplateIcon } from './templates/template-icon';
const TITLES: Record<HubSection, string> = { home: 'Início', projects: 'Meus jogos', trash: 'Lixeira' };
export function HubHeader() {
    const { registry, section, setSection, search, setSearch, actions } = useHub();
    const ready = registry.status === 'ready';
    const count = section === 'projects' ? registry.active.length : section === 'trash' ? registry.trashed.length : null;
    return (<header className="relative flex min-h-12 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-surface bg-linear-to-b from-bevel to-transparent px-4 py-2 shadow-bevel md:px-6">
      <h1 className="flex shrink-0 items-baseline gap-2 text-sm font-semibold whitespace-nowrap text-foreground">
        {TITLES[section]}
        {count !== null && count > 0 && <span className="font-mono text-3xs font-normal text-muted-foreground tabular-nums">{count}</span>}
      </h1>

      <div className="relative ml-auto min-w-0 flex-1 basis-40 sm:max-w-xs">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden/>
        <input type="text" role="searchbox" value={search} onChange={(event) => {
            const value = event.target.value;
            setSearch(value);
            if (value && section === 'home')
                setSection('projects');
        }} placeholder="Buscar jogo pelo nome" aria-label="Buscar jogo pelo nome" disabled={!ready} className={cn(TEXT_INPUT_CLASS, 'h-7 pr-8 pl-8 text-2xs')}/>
        {search && (<button type="button" aria-label="Limpar busca" onClick={() => setSearch('')} className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-xs p-1 text-muted-foreground transition-colors hover:bg-highlight hover:text-foreground">
            <X className="size-3.5" aria-hidden/>
          </button>)}
      </div>

      <Button size="sm" variant="outline" className="shrink-0" onClick={() => actions.pickFilesToImport()} disabled={!ready}>
        <FolderInput data-icon="inline-start" aria-hidden/>
        Importar
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger render={<Button size="sm" className="shrink-0" disabled={!ready}/>}>
          <Plus data-icon="inline-start" aria-hidden/>
          Novo jogo
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className={MENU_CONTENT_CLASS}>
          {PROJECT_TEMPLATES.map((template) => (<DropdownMenuItem key={template.id} className={MENU_ITEM_CLASS} onClick={() => void actions.createProject(template.id)}>
              <TemplateIcon template={template.id} aria-hidden/>
              {template.name}
            </DropdownMenuItem>))}
        </DropdownMenuContent>
      </DropdownMenu>
    </header>);
}
