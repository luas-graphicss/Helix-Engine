'use client';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { getTriangleCount } from '@/engine/renderer/geometry/mesh-data';
import { Button } from '@/components/ui/button';
import { CheckBox } from '@/engine/ui/check-box';
import { SearchField } from '@/engine/ui/search-field';
import type { ImportDraft } from '../use-import-draft';
import { formatInteger } from './import-format';
type ImportMeshesTabProps = {
    draft: ImportDraft;
};
export function ImportMeshesTab({ draft }: ImportMeshesTabProps) {
    const { scene, options, setMeshIncluded, setAllMeshesIncluded } = draft;
    const [filter, setFilter] = useState('');
    const rows = useMemo(() => {
        const query = filter.trim().toLowerCase();
        return scene.meshes
            .map((mesh, index) => ({ mesh, index, triangles: getTriangleCount(mesh.geometry) }))
            .filter(({ mesh }) => query === '' || mesh.name.toLowerCase().includes(query));
    }, [scene, filter]);
    const included = scene.meshes.length - options.excludedMeshes.size;
    if (scene.meshes.length === 0) {
        return <p className="p-4 text-center text-2xs text-muted-foreground">O arquivo não contém malhas.</p>;
    }
    return (<div className="flex flex-col">
      <div className="sticky top-0 z-10 flex items-center gap-1.5 border-b border-border bg-surface px-2 py-1.5">
        <SearchField placeholder="Filtrar malhas" value={filter} onChange={setFilter} className="min-w-0 flex-1"/>
        <Button type="button" size="xs" variant="ghost" onClick={() => setAllMeshesIncluded(true)} disabled={included === scene.meshes.length}>
          Todas
        </Button>
        <Button type="button" size="xs" variant="ghost" onClick={() => setAllMeshesIncluded(false)} disabled={included === 0}>
          Nenhuma
        </Button>
      </div>
      <p className="px-2 py-1 font-mono text-[10px] text-muted-foreground">
        {formatInteger(included)} de {formatInteger(scene.meshes.length)} {scene.meshes.length === 1 ? 'malha incluída' : 'malhas incluídas'}
      </p>
      <ul className="flex flex-col" aria-label="Malhas do arquivo">
        {rows.map(({ mesh, index, triangles }) => {
            const isIncluded = !options.excludedMeshes.has(index);
            const materialName = mesh.material !== null ? (scene.materials[mesh.material]?.name ?? 'Padrão') : 'Padrão';
            const flags = [!mesh.hadNormals && 'normais calculadas', !mesh.hadUvs && 'sem UV'].filter(Boolean).join(' · ');
            return (<li key={index} className={cn('grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-border/60 px-2 py-1.5 transition-opacity', !isIncluded && 'opacity-50')}>
              <CheckBox checked={isIncluded} label={`Incluir ${mesh.name}`} onChange={(checked) => setMeshIncluded(index, checked)}/>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-2xs text-foreground">{mesh.name}</span>
                <span className="truncate text-[10px] text-muted-foreground">
                  {materialName}
                  {flags && ` · ${flags}`}
                </span>
              </div>
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{formatInteger(triangles)} tris</span>
            </li>);
        })}
        {rows.length === 0 && <li className="p-4 text-center text-2xs text-muted-foreground">Nenhuma malha corresponde ao filtro.</li>}
      </ul>
    </div>);
}
