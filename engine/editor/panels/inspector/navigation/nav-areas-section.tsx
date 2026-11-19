'use client';
import type { KeyboardEvent } from 'react';
import type { Vec3 } from '@/engine/core/math/vec3';
import { NAV_AREA_COLORS } from '@/engine/editor/navigation/nav-mesh-lines';
import { setNavAreaCost, setNavAreaName } from '@/engine/editor/operations/navigation/nav-area-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { isBuiltInArea, NOT_WALKABLE_AREA } from '@/engine/navigation/areas/nav-areas';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { FieldInput } from '@/engine/ui/field-input';
import { ScalarField } from '../number-fields';
import { NAV_HINT_CLASS } from './nav-field-styles';
const CHANNEL_MAX = 255;
const COST_COLUMN_CLASS = 'flex w-14 shrink-0';
function swatchColor(color: Vec3): string {
    return `rgb(${Math.round(color[0] * CHANNEL_MAX)} ${Math.round(color[1] * CHANNEL_MAX)} ${Math.round(color[2] * CHANNEL_MAX)})`;
}
function blurOnEnter(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229)
        event.currentTarget.blur();
}
export function NavAreasSection() {
    const session = useEditorSession();
    const { areas } = session.scene.navigation;
    return (<CollapsibleSection title="Áreas navegáveis" hint="Valem para a cena inteira" defaultOpen={false}>
      <p className={NAV_HINT_CLASS}>
        Cada área tem um custo: quanto maior, mais o pathfinding evita passar por ela. As três primeiras são da engine; as outras podem ser renomeadas.
      </p>
      {areas.map((area, index) => (<div key={index} className="flex min-h-row items-center gap-1.5 px-2">
          <span aria-hidden className="size-2.5 shrink-0 rounded-xs" style={{ backgroundColor: swatchColor(NAV_AREA_COLORS[index]) }}/>
          <FieldInput key={`${index}-${area.name}`} defaultValue={area.name} readOnly={isBuiltInArea(index)} aria-label={`Nome da área ${index + 1}`} onKeyDown={blurOnEnter} onBlur={(event) => {
                setNavAreaName(session, index, event.currentTarget.value);
                event.currentTarget.value = areas[index].name;
            }}/>
          <div className={COST_COLUMN_CLASS}>
            {index === NOT_WALKABLE_AREA ? <FieldInput readOnly value="—" aria-label={`${area.name} não tem custo: nenhum agente passa`}/> : <ScalarField label={`Custo da área ${area.name}`} value={area.cost} onCommit={(value) => setNavAreaCost(session, index, value)}/>}
          </div>
        </div>))}
    </CollapsibleSection>);
}
