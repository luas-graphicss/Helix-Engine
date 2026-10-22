'use client';
import { LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { linearRgbToCss } from '@/engine/core/color/srgb';
import { TextureImageThumbnail } from '@/engine/ui/texture-image-thumbnail';
import { MATERIAL_MAP_KINDS, resolveMap, type MaterialDocument } from '@/engine/materials/material-document';
export function materialMapCount(document: MaterialDocument): number {
    return MATERIAL_MAP_KINDS.filter(({ kind }) => resolveMap(document, kind) !== null).length;
}
export function materialCaption(document: MaterialDocument): string {
    const albedo = resolveMap(document, 'albedo');
    const maps = materialMapCount(document);
    if (maps === 0)
        return 'Só parâmetros';
    const size = albedo ? ` · ${albedo.width}×${albedo.height}` : '';
    return `${maps} ${maps === 1 ? 'mapa' : 'mapas'}${size}`;
}
type MaterialSwatchProps = {
    document: MaterialDocument;
    className?: string;
    resolution?: number;
};
export function MaterialSwatch({ document, className, resolution = 64 }: MaterialSwatchProps) {
    const albedo = resolveMap(document, 'albedo');
    const color = document.averageColor ?? document.material.baseColor;
    return (<span className={cn('relative block shrink-0 overflow-hidden rounded-sm border border-border-strong', className)} style={{ backgroundColor: linearRgbToCss(color) }}>
      {albedo && <TextureImageThumbnail image={albedo} resolution={resolution}/>}
      {document.generating && (<span className="absolute inset-0 flex items-center justify-center bg-background/50">
          <LoaderCircle className="size-3 animate-spin text-foreground" aria-hidden/>
        </span>)}
    </span>);
}
