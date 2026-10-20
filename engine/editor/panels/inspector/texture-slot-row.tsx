'use client';
import { useId, useRef } from 'react';
import { FolderOpen, Library, X } from 'lucide-react';
import { IconButton } from '@/engine/ui/icon-button';
import { PropertyRow } from '@/engine/ui/property-row';
import { TextureThumbnail } from '@/engine/ui/texture-thumbnail';
import type { Texture } from '@/engine/core/scene/texture';
type TextureSlotRowProps = {
    label: string;
    texture: Texture | null;
    library: readonly Texture[];
    onLoadFile: (file: File) => void;
    onPick: (texture: Texture) => void;
    onRemove: () => void;
};
const ACCEPTED_IMAGES = 'image/png,image/jpeg,image/webp,image/gif,image/bmp,.png,.jpg,.jpeg,.webp,.gif,.bmp';
export function TextureSlotRow({ label, texture, library, onLoadFile, onPick, onRemove }: TextureSlotRowProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const selectId = useId();
    const pickable = library.filter((candidate) => candidate !== texture);
    return (<PropertyRow label={label}>
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border bg-surface-sunken">
          {texture ? <TextureThumbnail texture={texture} resolution={48}/> : <span aria-hidden className="size-2 rounded-full bg-border-strong"/>}
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-2xs text-foreground" title={texture?.sourcePath || undefined}>
          {texture ? (<>
              {texture.name}
              <span className="text-muted-foreground">{texture.width > 0 ? ` · ${texture.width}×${texture.height}` : ' · sem imagem'}</span>
            </>) : (<span className="text-muted-foreground">Nenhuma</span>)}
        </span>
        <input ref={fileInputRef} type="file" accept={ACCEPTED_IMAGES} className="sr-only" tabIndex={-1} aria-label={`Arquivo de textura para ${label}`} onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            if (file)
                onLoadFile(file);
        }}/>
        <IconButton label={`Carregar textura de ${label}`} size="sm" className="size-5 [&_svg]:size-3" onClick={() => fileInputRef.current?.click()}>
          <FolderOpen />
        </IconButton>
        {pickable.length > 0 && (<span className="relative flex">
            <label htmlFor={selectId} className="sr-only">
              Escolher textura da biblioteca para {label}
            </label>
            <select id={selectId} value="" onChange={(event) => {
                const picked = pickable.find((candidate) => String(candidate.id) === event.currentTarget.value);
                if (picked)
                    onPick(picked);
            }} className="absolute inset-0 cursor-pointer opacity-0">
              <option value="" disabled>
                Da biblioteca…
              </option>
              {pickable.map((candidate) => (<option key={candidate.id} value={candidate.id}>
                  {candidate.name} ({candidate.width}×{candidate.height})
                </option>))}
            </select>
            <IconButton label={`Escolher textura da biblioteca para ${label}`} size="sm" className="pointer-events-none size-5 [&_svg]:size-3" tabIndex={-1}>
              <Library />
            </IconButton>
          </span>)}
        {texture && (<IconButton label={`Remover textura de ${label}`} size="sm" className="size-5 [&_svg]:size-3" onClick={onRemove}>
            <X />
          </IconButton>)}
      </div>
    </PropertyRow>);
}
