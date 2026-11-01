'use client';
import { Crosshair, Eclipse, Replace, Spotlight, Video, WandSparkles } from 'lucide-react';
import { ContextMenuCheckboxItem, ContextMenuGroup, ContextMenuItem, ContextMenuSeparator, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, } from '@/components/ui/context-menu';
import type { Entity } from '@/engine/core/scene/entity';
import { isLocalLight, LOCAL_LIGHT_LABEL, LOCAL_LIGHT_SHORT_LABEL, LOCAL_LIGHT_TYPES, type Light } from '@/engine/core/scene/light';
import { LIGHT_PRESETS } from '@/engine/core/scene/light-presets';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { LIGHT_ICON } from '@/engine/editor/lights/light-icons';
import { applyLightPreset, lightCastsShadows, setLightsShadows, setLocalLightType } from '@/engine/editor/operations/light-operations';
import { aimLightAtCameraTarget, isAimableLight, placeLightAtCamera } from '@/engine/editor/operations/light-placement-operations';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS } from './menu-styles';
interface LightEntity extends Entity {
    readonly light: Light;
}
function hasLight(entity: Entity): entity is LightEntity {
    return entity.light !== null;
}
type LightContextActionsProps = {
    selection: readonly Entity[];
};
export function LightContextActions({ selection }: LightContextActionsProps) {
    const session = useSessionTopic('view');
    const lights = selection.filter(hasLight);
    if (lights.length === 0)
        return null;
    const shadowable = lights.filter((entity) => entity.light.type !== 'ambient');
    const allShadowed = shadowable.length > 0 && shadowable.every((entity) => lightCastsShadows(entity.light));
    const single = lights.length === 1 ? lights[0] : null;
    const singleLocal = single && isLocalLight(single.light) ? single : null;
    const soloId = session.render.soloLightId;
    const isolated = singleLocal !== null && soloId === singleLocal.id;
    return (<>
      <ContextMenuGroup>
        {shadowable.length > 0 && (<ContextMenuCheckboxItem className={MENU_ITEM_CLASS} checked={allShadowed} onCheckedChange={(checked) => setLightsShadows(session, shadowable, checked)}>
            <Eclipse aria-hidden/>
            Projetar sombra{lights.length > 1 ? ` (${shadowable.length} luzes)` : ''}
          </ContextMenuCheckboxItem>)}
        {single && isAimableLight(single.light) && (<ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => aimLightAtCameraTarget(session, single)}>
            <Crosshair aria-hidden/>
            Apontar para o alvo da câmera
          </ContextMenuItem>)}
        {single && single.light.type !== 'ambient' && (<ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => placeLightAtCamera(session, single)}>
            <Video aria-hidden/>
            Posicionar na câmera
          </ContextMenuItem>)}
        {singleLocal && (<ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => session.setSoloLight(isolated ? null : singleLocal.id)}>
            <Spotlight aria-hidden/>
            {isolated ? 'Sair do isolamento' : 'Isolar luz (só ela ilumina)'}
          </ContextMenuItem>)}
      </ContextMenuGroup>
      {singleLocal && (<ContextMenuGroup>
          <ContextMenuSub>
            <ContextMenuSubTrigger className={MENU_ITEM_CLASS}>
              <Replace aria-hidden/>
              Converter em
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className={MENU_CONTENT_CLASS}>
              {LOCAL_LIGHT_TYPES.map((type) => {
                const Icon = LIGHT_ICON[type];
                return (<ContextMenuItem key={type} className={MENU_ITEM_CLASS} disabled={type === singleLocal.light.type} onClick={() => setLocalLightType(session, singleLocal, type)}>
                    <Icon aria-hidden/>
                    {LOCAL_LIGHT_LABEL[type]}
                  </ContextMenuItem>);
            })}
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSub>
            <ContextMenuSubTrigger className={MENU_ITEM_CLASS}>
              <WandSparkles aria-hidden/>
              Aplicar preset
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className={`${MENU_CONTENT_CLASS} w-60`}>
              {LIGHT_PRESETS.map((preset) => {
                const Icon = LIGHT_ICON[preset.type];
                return (<ContextMenuItem key={preset.id} className={MENU_ITEM_CLASS} onClick={() => applyLightPreset(session, singleLocal, preset.id)}>
                    <Icon aria-hidden/>
                    <span className="flex min-w-0 flex-1 items-baseline justify-between gap-2">
                      <span className="truncate">{preset.label}</span>
                      <span className="shrink-0 text-3xs text-muted-foreground">{LOCAL_LIGHT_SHORT_LABEL[preset.type]}</span>
                    </span>
                  </ContextMenuItem>);
            })}
            </ContextMenuSubContent>
          </ContextMenuSub>
        </ContextMenuGroup>)}
      <ContextMenuSeparator />
    </>);
}
