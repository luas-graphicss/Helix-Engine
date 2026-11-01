'use client';
import type { KeyboardEvent, MouseEvent } from 'react';
import { Eclipse, Power, PowerOff, Spotlight } from 'lucide-react';
import { isLocalLight, LOCAL_LIGHT_SHORT_LABEL, type Light } from '@/engine/core/scene/light';
import type { LocalShadowState } from '@/engine/renderer/passes/local-shadow-pass';
import { IconButton } from '@/engine/ui/icon-button';
import { RangeInput } from '@/engine/ui/range-input';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { LIGHT_ICON } from '@/engine/editor/lights/light-icons';
import { lightCssColor, type LightEntry } from '@/engine/editor/lights/light-catalog';
import { lightCastsShadows, setLightIntensity, setLightShadows } from '@/engine/editor/operations/light-operations';
import { setEntitiesVisibility } from '@/engine/editor/operations/entity-operations';
import { cn } from '@/lib/utils';
const GLOBAL_LABEL: Record<'directional' | 'ambient', string> = { directional: 'Direcional', ambient: 'Ambiente' };
interface IntensityRange {
    min: number;
    max: number;
    scale: 'linear' | 'log';
    step?: number;
}
function intensityRange(light: Light): IntensityRange {
    if (light.type === 'directional')
        return { min: 0, max: 20, scale: 'linear', step: 0.05 };
    if (light.type === 'ambient')
        return { min: 0, max: 3, scale: 'linear', step: 0.01 };
    return { min: 0.1, max: 1000, scale: 'log' };
}
const SHADOW_DOT_CLASS: Record<LocalShadowState, string> = { rendered: 'bg-axis-y', cached: 'bg-primary', deferred: 'bg-warning' };
const SHADOW_DOT_LABEL: Record<LocalShadowState, string> = { rendered: 'renderizada neste frame', cached: 'em cache', deferred: 'adiada: orçamento esgotado' };
type LightRowProps = {
    entry: LightEntry;
    shadowState: LocalShadowState | undefined;
    solo: boolean;
};
export function LightRow({ entry, shadowState, solo }: LightRowProps) {
    const session = useEditorSession();
    const { entity, light, active } = entry;
    const Icon = LIGHT_ICON[light.type];
    const color = lightCssColor(light);
    const isSelected = session.isSelected(entity);
    const isPrimary = session.selectedId === entity.id;
    const local = isLocalLight(light);
    const shadows = lightCastsShadows(light);
    const range = intensityRange(light);
    const typeLabel = local ? LOCAL_LIGHT_SHORT_LABEL[light.type] : GLOBAL_LABEL[light.type];
    const intensityText = String(Number(light.intensity.toFixed(2)));
    const shadowLabel = light.type === 'ambient' ? 'A luz ambiente não projeta sombra' : shadows ? `Sombra ligada${shadowState ? ` · ${SHADOW_DOT_LABEL[shadowState]}` : ''}` : 'Sombra desligada (ligar entra no orçamento de faces)';
    const onClick = (event: MouseEvent<HTMLDivElement>) => {
        if (event.ctrlKey || event.metaKey)
            session.toggleSelection(entity);
        else
            session.select(entity);
    };
    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.target !== event.currentTarget)
            return;
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            session.select(entity);
        }
    };
    return (<div role="option" aria-selected={isSelected} tabIndex={0} data-entity-id={entity.id} onClick={onClick} onDoubleClick={() => {
            session.select(entity);
            session.focusEntity(entity);
        }} onContextMenu={() => {
            if (!session.isSelected(entity))
                session.select(entity);
        }} onKeyDown={onKeyDown} className={cn('group grid h-9 cursor-default grid-cols-[auto_minmax(0,1fr)_60px_auto] items-center gap-1.5 px-1.5 text-2xs select-none outline-none focus-visible:ring-1 focus-visible:ring-primary/60 focus-visible:ring-inset', isPrimary ? 'bg-primary/25' : isSelected ? 'bg-primary/12' : 'hover:bg-highlight', solo && 'shadow-[inset_2px_0_0_0_var(--primary)]')}>
      <span aria-hidden className={cn('flex size-6 shrink-0 items-center justify-center rounded-sm', !active && 'opacity-40')} style={{ backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)`, color }}>
        <Icon className="size-3.5"/>
      </span>
      <span className={cn('flex min-w-0 flex-col', !active && 'opacity-50')}>
        <span className="truncate text-foreground">{entity.name}</span>
        <span className="truncate font-mono text-3xs text-muted-foreground">
          {typeLabel} · {intensityText}
          {!active && ' · apagada'}
          {solo && ' · isolada'}
        </span>
      </span>
      <span className="flex items-center" onDoubleClick={(event) => event.stopPropagation()}>
        <RangeInput label={`Intensidade de ${entity.name}`} value={light.intensity} min={range.min} max={range.max} step={range.step} scale={range.scale} valueText={intensityText} onChange={(value) => setLightIntensity(session, entity, value)}/>
      </span>
      <span className="flex items-center">
        <IconButton label={shadowLabel} size="sm" active={shadows} disabled={light.type === 'ambient'} className="relative size-6 [&_svg]:size-3.5" onClick={(event) => {
            event.stopPropagation();
            setLightShadows(session, entity, !shadows);
        }}>
          <Eclipse />
          {shadows && shadowState && <span aria-hidden className={cn('absolute top-0.5 right-0.5 size-1.5 rounded-full', SHADOW_DOT_CLASS[shadowState])}/>}
        </IconButton>
        {local ? (<IconButton label={solo ? 'Sair do isolamento' : 'Isolar: só esta luz local ilumina o viewport'} size="sm" active={solo} className="size-6 [&_svg]:size-3.5" onClick={(event) => {
                event.stopPropagation();
                session.setSoloLight(solo ? null : entity.id);
            }}>
            <Spotlight />
          </IconButton>) : (<span className="size-6" aria-hidden/>)}
        <IconButton label={entity.visible ? 'Apagar (oculta o ator)' : 'Acender (mostra o ator)'} size="sm" className={cn('size-6 [&_svg]:size-3.5', !entity.visible && 'text-warning hover:text-warning')} onClick={(event) => {
            event.stopPropagation();
            setEntitiesVisibility(session, [entity], !entity.visible);
        }}>
          {entity.visible ? <Power /> : <PowerOff />}
        </IconButton>
      </span>
    </div>);
}
