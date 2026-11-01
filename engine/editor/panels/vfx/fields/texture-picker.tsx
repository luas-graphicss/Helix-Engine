'use client';
import { useEffect, useRef } from 'react';
import { ImagePlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VfxBuiltinTextureId, VfxTextureRef } from '@/engine/vfx/document/vfx-document';
import { paintBuiltinVfxTexture, VFX_BUILTIN_TEXTURES } from '@/engine/vfx/textures/vfx-texture-catalog';
import { importLibraryAssetOfKind } from '@/engine/editor/operations/asset-library-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { ImageBlobThumbnail } from '@/engine/ui/image-blob-thumbnail';
const SPRITE_PREVIEW_SIZE = 32;
function BuiltinSprite({ id }: {
    id: VfxBuiltinTextureId;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        if (!canvas || !context)
            return;
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(paintBuiltinVfxTexture(id, SPRITE_PREVIEW_SIZE * 2), 0, 0, canvas.width, canvas.height);
    }, [id]);
    return <canvas ref={canvasRef} width={SPRITE_PREVIEW_SIZE} height={SPRITE_PREVIEW_SIZE} className="size-full" aria-hidden/>;
}
type TexturePickerProps = {
    value: VfxTextureRef;
    onChange: (texture: VfxTextureRef) => void;
};
export function TexturePicker({ value, onChange }: TexturePickerProps) {
    const session = useEditorSession();
    const textures = session.library.byKind('texture');
    const importTexture = async () => {
        const asset = await importLibraryAssetOfKind(session, 'texture');
        if (asset)
            onChange({ kind: 'asset', assetId: asset.id });
    };
    const tileClass = (selected: boolean) => cn('group flex flex-col items-center gap-0.5 rounded-sm border p-1 transition-colors focus-visible:outline-1 focus-visible:outline-offset-[-1px] focus-visible:outline-primary', selected ? 'border-primary bg-primary/15' : 'border-transparent hover:border-border hover:bg-highlight');
    return (<div className="flex flex-col gap-1.5 px-2 py-0.5">
      <span className="text-3xs font-medium tracking-wider text-muted-foreground uppercase">Sprites embutidos</span>
      <div role="radiogroup" aria-label="Sprite embutido" className="grid grid-cols-[repeat(auto-fill,minmax(3.25rem,1fr))] gap-0.5">
        {VFX_BUILTIN_TEXTURES.map((sprite) => {
            const selected = value.kind === 'builtin' && value.id === sprite.id;
            return (<button key={sprite.id} type="button" role="radio" aria-checked={selected} title={sprite.description} onClick={() => onChange({ kind: 'builtin', id: sprite.id })} className={tileClass(selected)}>
              <span className="size-8 overflow-hidden rounded-xs bg-foreground/10">
                <BuiltinSprite id={sprite.id}/>
              </span>
              <span className="w-full truncate text-center text-3xs text-foreground/80">{sprite.label}</span>
            </button>);
        })}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-3xs font-medium tracking-wider text-muted-foreground uppercase">Texturas da biblioteca</span>
        <button type="button" onClick={() => void importTexture()} className="flex h-5 shrink-0 items-center gap-1 rounded-sm px-1 text-3xs text-muted-foreground transition-colors hover:bg-highlight hover:text-foreground">
          <ImagePlus className="size-3" aria-hidden/>
          Importar…
        </button>
      </div>
      {textures.length === 0 ? (<p className="text-3xs leading-relaxed text-pretty text-muted-foreground">Nenhuma textura na biblioteca.</p>) : (<div role="radiogroup" aria-label="Textura da biblioteca" className="grid grid-cols-[repeat(auto-fill,minmax(3.25rem,1fr))] gap-0.5">
          {textures.map((asset) => {
                const selected = value.kind === 'asset' && value.assetId === asset.id;
                return (<button key={asset.id} type="button" role="radio" aria-checked={selected} title={asset.name} onClick={() => onChange({ kind: 'asset', assetId: asset.id })} className={tileClass(selected)}>
                <span className="size-8 overflow-hidden rounded-xs bg-foreground/10">
                  <ImageBlobThumbnail blob={asset.thumbnail?.blob ?? null} alt=""/>
                </span>
                <span className="w-full truncate text-center text-3xs text-foreground/80">{asset.name}</span>
              </button>);
            })}
        </div>)}
    </div>);
}
