'use client';
import { useRef, useState } from 'react';
import { Eclipse, Grid3x3, Image as ImageIcon, LoaderCircle, Locate } from 'lucide-react';
import { IconButton } from '@/engine/ui/icon-button';
import { ToolbarSeparator } from '@/engine/ui/toolbar-separator';
import { formatInteger, formatMeters } from '../dialog/import-format';
import type { ImportPreviewModel } from './import-preview-model';
import { useImportPreviewRenderer } from './use-import-preview-renderer';
import { usePreviewOrbitInput } from './use-preview-orbit-input';
type ImportPreviewProps = {
    model: ImportPreviewModel;
    texturesVisible: boolean;
    onTexturesVisibleChange: (visible: boolean) => void;
    building: boolean;
    dimensions: readonly [
        number,
        number,
        number
    ] | null;
    triangles: number;
};
export function ImportPreview({ model, texturesVisible, onTexturesVisibleChange, building, dimensions, triangles }: ImportPreviewProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [grid, setGrid] = useState(true);
    const [shadows, setShadows] = useState(true);
    const { error } = useImportPreviewRenderer(canvasRef, model, { grid, shadows });
    usePreviewOrbitInput(canvasRef, model.orbit);
    return (<div className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-surface-sunken">
      <canvas ref={canvasRef} tabIndex={0} aria-label="Pré-visualização do modelo. Arraste para orbitar, Shift+arraste para panoramizar, scroll para aproximar." className="block size-full touch-none outline-none focus-visible:ring-1 focus-visible:ring-primary/60 focus-visible:ring-inset"/>

      {error && (<div className="absolute inset-0 flex items-center justify-center p-6 text-center text-2xs text-muted-foreground">{error}</div>)}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-1.5">
        <div className="pointer-events-auto flex items-center gap-0.5 rounded-sm border border-border bg-surface-sunken/85 p-0.5 backdrop-blur-sm">
          <IconButton label={texturesVisible ? 'Ocultar texturas' : 'Mostrar texturas'} size="sm" active={texturesVisible} onClick={() => onTexturesVisibleChange(!texturesVisible)}>
            <ImageIcon />
          </IconButton>
          <IconButton label="Alternar grade" size="sm" active={grid} onClick={() => setGrid((value) => !value)}>
            <Grid3x3 />
          </IconButton>
          <IconButton label="Alternar sombras" size="sm" active={shadows} onClick={() => setShadows((value) => !value)}>
            <Eclipse />
          </IconButton>
          <ToolbarSeparator />
          <IconButton label="Enquadrar modelo" size="sm" onClick={() => model.frame()}>
            <Locate />
          </IconButton>
        </div>
        {building && (<span className="pointer-events-auto flex items-center gap-1.5 rounded-sm border border-border bg-surface-sunken/85 px-2 py-1 font-mono text-2xs text-muted-foreground backdrop-blur-sm">
            <LoaderCircle className="size-3 animate-spin" aria-hidden/>
            Atualizando…
          </span>)}
      </div>

      <div className="pointer-events-none absolute bottom-2 left-2 flex flex-col gap-0.5 rounded-sm border border-border bg-surface-sunken/85 px-2 py-1.5 font-mono text-2xs text-muted-foreground backdrop-blur-sm">
        <span>
          Dimensões{' '}
          <span className="text-foreground">{dimensions ? `${formatMeters(dimensions[0])} × ${formatMeters(dimensions[1])} × ${formatMeters(dimensions[2])}` : '—'}</span>
        </span>
        <span>
          Triângulos <span className="text-foreground">{formatInteger(triangles)}</span>
        </span>
      </div>
    </div>);
}
