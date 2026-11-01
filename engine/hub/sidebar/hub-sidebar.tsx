'use client';
import { Archive, Boxes, FolderInput, House, Trash2, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ENGINE_VERSION_LABEL } from '@/engine/core/engine-info';
import { HelixLogo } from '@/engine/boot/helix-logo';
import { FOCUS_RING_CLASS } from '@/engine/ui/surface-styles';
import { useHub, type HubSection } from '../hub-context';
import { StorageStatus } from './storage-status';
interface NavItemProps {
    icon: LucideIcon;
    label: string;
    count?: number;
    active: boolean;
    onClick(): void;
}
function NavItem({ icon: Icon, label, count, active, onClick }: NavItemProps) {
    return (<li>
      <button type="button" aria-current={active ? 'page' : undefined} aria-label={label} title={count !== undefined && count > 0 ? `${label} (${count})` : label} onClick={onClick} className={cn('flex h-8 w-full items-center justify-center gap-2.5 rounded-sm px-0 text-xs transition-colors duration-100 outline-none md:justify-start md:px-2.5', FOCUS_RING_CLASS, active ? 'bg-surface-raised text-foreground shadow-raised' : 'text-muted-foreground hover:bg-highlight hover:text-foreground')}>
        <Icon className={cn('size-4 shrink-0', active && 'text-primary')} aria-hidden/>
        <span className="hidden min-w-0 flex-1 truncate text-left md:inline">{label}</span>
        {count !== undefined && count > 0 && <span className="hidden font-mono text-3xs text-muted-foreground tabular-nums md:inline">{count}</span>}
      </button>
    </li>);
}
const SECTIONS: ReadonlyArray<{
    id: HubSection;
    label: string;
    icon: LucideIcon;
}> = [
    { id: 'home', label: 'Início', icon: House },
    { id: 'projects', label: 'Meus jogos', icon: Boxes },
    { id: 'trash', label: 'Lixeira', icon: Trash2 },
];
export function HubSidebar() {
    const { registry, section, setSection, actions } = useHub();
    const counts: Record<HubSection, number | undefined> = { home: undefined, projects: registry.active.length, trash: registry.trashed.length };
    const canBackup = registry.status === 'ready' && registry.active.length > 0;
    return (<aside className="flex w-14 shrink-0 flex-col gap-6 overflow-y-auto border-r border-border bg-surface-sunken p-2 md:w-60 md:p-4">
      <div className="flex items-center justify-center gap-3 md:justify-start md:px-1" title={`Helix Engine ${ENGINE_VERSION_LABEL}`}>
        <HelixLogo size={30}/>
        <div className="hidden min-w-0 flex-col leading-none md:flex">
          <span className="text-xs font-semibold tracking-[0.22em] text-foreground uppercase">Helix</span>
          <span className="mt-1 truncate font-mono text-3xs text-muted-foreground">Engine {ENGINE_VERSION_LABEL}</span>
        </div>
      </div>

      <nav aria-label="Seções da tela inicial">
        <ul className="flex flex-col gap-0.5">
          {SECTIONS.map((item) => (<NavItem key={item.id} icon={item.icon} label={item.label} count={counts[item.id]} active={section === item.id} onClick={() => setSection(item.id)}/>))}
        </ul>
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        <div className="hidden md:block">
          <StorageStatus />
        </div>
        <div className="flex flex-col gap-1.5">
          <Button size="sm" variant="outline" className="justify-center px-0 md:justify-start md:px-2.5" title="Importar jogo ou backup…" onClick={() => actions.pickFilesToImport()} disabled={registry.status !== 'ready'}>
            <FolderInput data-icon="inline-start" aria-hidden/>
            <span className="hidden truncate md:inline">Importar jogo ou backup…</span>
          </Button>
          <Button size="sm" variant="ghost" className="justify-center px-0 md:justify-start md:px-2.5" title="Backup de todos os jogos" onClick={() => void actions.exportBackup()} disabled={!canBackup}>
            <Archive data-icon="inline-start" aria-hidden/>
            <span className="hidden truncate md:inline">Backup de todos os jogos</span>
          </Button>
        </div>
      </div>
    </aside>);
}
