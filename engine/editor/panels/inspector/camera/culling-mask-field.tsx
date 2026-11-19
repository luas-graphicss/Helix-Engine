'use client';
import { ALL_RENDER_LAYERS, maskIncludesLayer, namedRenderLayers, renderLayerName, type RenderLayerSettings } from '@/engine/camera/layers/render-layers';
import { cn } from '@/lib/utils';
import { CAMERA_HINT_CLASS } from './camera-field-styles';
const QUICK_ACTION_CLASS = 'rounded-xs px-1 font-mono text-3xs text-muted-foreground outline-none hover:text-foreground focus-visible:shadow-focus';
function summarize(mask: number, layers: readonly number[]): string {
    const included = layers.filter((layer) => maskIncludesLayer(mask, layer)).length;
    if (included === layers.length)
        return 'tudo';
    if (included === 0)
        return 'nada';
    return `${included} de ${layers.length}`;
}
export function CullingMaskField({ mask, layers, onToggle, onSet }: {
    mask: number;
    layers: RenderLayerSettings;
    onToggle: (layer: number) => void;
    onSet: (mask: number) => void;
}) {
    const named = namedRenderLayers(layers);
    return (<fieldset className="min-w-0 px-2 pt-1">
      <legend className="sr-only">Máscara de corte</legend>
      <div className="flex items-center gap-1 pb-1">
        <span className="text-2xs text-muted-foreground">Máscara de corte</span>
        <span className="font-mono text-3xs text-foreground/80">{summarize(mask, named)}</span>
        <span className="ml-auto flex items-center">
          <button type="button" className={QUICK_ACTION_CLASS} onClick={() => onSet(ALL_RENDER_LAYERS)}>
            Todas
          </button>
          <button type="button" className={QUICK_ACTION_CLASS} onClick={() => onSet(0)}>
            Nenhuma
          </button>
        </span>
      </div>
      <div className="flex flex-wrap gap-1 pb-1">
        {named.map((layer) => {
            const included = maskIncludesLayer(mask, layer);
            return (<button key={layer} type="button" aria-pressed={included} onClick={() => onToggle(layer)} className={cn('h-control rounded-sm px-2 font-mono text-2xs outline-none transition-colors duration-100 focus-visible:shadow-focus', included ? 'bg-primary text-primary-foreground' : 'bg-surface-sunken text-muted-foreground shadow-well hover:text-foreground')}>
              {renderLayerName(layers, layer)}
            </button>);
        })}
      </div>
      <p className={cn(CAMERA_HINT_CLASS, 'px-0')}>
        A câmera só desenha atores das camadas marcadas; os demais continuam projetando sombra. A camada de cada ator fica em Renderização.
      </p>
    </fieldset>);
}
