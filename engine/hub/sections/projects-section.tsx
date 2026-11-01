'use client';
import { useHub } from '../hub-context';
import { ProjectGrid } from '../projects/project-grid';
import { filterProjects } from '../search/filter-projects';
export function ProjectsSection() {
    const { registry, search } = useHub();
    const records = filterProjects(registry.active, search);
    return (<div className="flex flex-col gap-4 p-6">
      <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground text-pretty">
        Guardados neste navegador, com cenas, materiais e ativos. Para levar um jogo a outro navegador ou guardar uma cópia fora daqui, exporte o arquivo <code className="font-mono">.helix</code>{' '}
        pelo menu do jogo.
      </p>
      <ProjectGrid records={records} total={registry.active.length}/>
    </div>);
}
