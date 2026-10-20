'use client';
import { linearRgbToCss } from '@/engine/core/color/srgb';
import type { ImportedMaterial } from '@/engine/assets/import/import-types';
import { ToggleSwitch } from '@/engine/ui/toggle-field';
import type { ImportDraft } from '../use-import-draft';
import { textureStatus } from '../use-import-draft';
import { listMaterialMaps } from './import-format';
import { StatusBadge } from './status-badge';
const ALPHA_LABEL: Record<ImportedMaterial['alphaMode'], string> = {
    opaque: 'Opaco',
    mask: 'Recorte',
    blend: 'Transparente',
};
type ImportMaterialsTabProps = {
    draft: ImportDraft;
};
export function ImportMaterialsTab({ draft }: ImportMaterialsTabProps) {
    const { scene, options, setMaterialDoubleSided } = draft;
    const usedBy = scene.materials.map(() => 0);
    scene.meshes.forEach((mesh, index) => {
        if (mesh.material !== null && !options.excludedMeshes.has(index))
            usedBy[mesh.material]++;
    });
    if (scene.materials.length === 0) {
        return <p className="p-4 text-center text-2xs text-muted-foreground">O arquivo não define materiais; as malhas receberão o material padrão.</p>;
    }
    return (<ul className="flex flex-col" aria-label="Materiais do arquivo">
      {scene.materials.map((material, index) => {
            const maps = listMaterialMaps(material);
            return (<li key={index} className="flex flex-col gap-1.5 border-b border-border/60 px-2 py-2">
            <div className="flex items-center gap-2">
              <span className="size-5 shrink-0 rounded-sm border border-border" style={{ backgroundColor: linearRgbToCss(material.baseColor), opacity: Math.max(material.opacity, 0.25) }} aria-hidden/>
              <span className="min-w-0 flex-1 truncate text-2xs text-foreground">{material.name}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{usedBy[index]} {usedBy[index] === 1 ? 'malha' : 'malhas'}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1 pl-7 font-mono text-[10px] text-muted-foreground">
              <StatusBadge>rug {material.roughness.toFixed(2)}</StatusBadge>
              <StatusBadge>met {material.metallic.toFixed(2)}</StatusBadge>
              <StatusBadge tone={material.alphaMode === 'opaque' ? 'neutral' : 'primary'}>{ALPHA_LABEL[material.alphaMode]}</StatusBadge>
              {(material.emissive[0] > 0 || material.emissive[1] > 0 || material.emissive[2] > 0) && <StatusBadge tone="primary">emissivo</StatusBadge>}
            </div>
            <label className="flex items-center justify-between gap-2 pl-7 text-[10px] text-muted-foreground">
              Dupla face
              <ToggleSwitch label={`Dupla face em ${material.name}`} on={material.doubleSided} onToggle={() => setMaterialDoubleSided(index, !material.doubleSided)}/>
            </label>
            {maps.length > 0 && (<ul className="flex flex-col gap-0.5 pl-7" aria-label={`Texturas de ${material.name}`}>
                {maps.map(({ slot, texture }) => {
                        const definition = scene.textures[texture];
                        const status = definition ? textureStatus(definition) : 'missing';
                        return (<li key={`${slot}-${texture}`} className="flex items-center gap-1.5 text-[10px]">
                      <span className="w-[6.5rem] shrink-0 truncate text-muted-foreground">{slot}</span>
                      <span className="min-w-0 flex-1 truncate font-mono text-foreground/85">{definition?.name ?? '—'}</span>
                      {status === 'missing' && <StatusBadge tone="warning">ausente</StatusBadge>}
                    </li>);
                    })}
              </ul>)}
          </li>);
        })}
    </ul>);
}
