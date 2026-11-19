'use client';
import type { Entity } from '@/engine/core/scene/entity';
import { removeNavModifier, setNavModifierArea, setNavModifierMode, setNavModifierVector } from '@/engine/editor/operations/navigation/nav-modifier-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import type { NavModifierMode, NavModifierSettings } from '@/engine/navigation/modifier/nav-modifier-settings';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { PropertyRow } from '@/engine/ui/property-row';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { NavAreaSelect } from './nav-area-select';
import { NAV_HINT_CLASS } from './nav-field-styles';
import { NavRemoveButton } from './nav-remove-button';
import { NavVectorRow } from './nav-vector-row';
const MODE_OPTIONS: ReadonlyArray<{
    value: NavModifierMode;
    label: string;
}> = [
    { value: 'area', label: 'Área' },
    { value: 'ignore', label: 'Ignorar' },
    { value: 'volume', label: 'Volume' },
];
const MODE_HINT: Record<NavModifierMode, string> = {
    area: 'A geometria deste ator e dos filhos entra no NavMesh com a área escolhida.',
    ignore: 'A geometria deste ator e dos filhos fica fora do NavMesh.',
    volume: 'Tudo o que o NavMesh gerar dentro da caixa recebe a área escolhida.',
};
export function NavModifierSection({ entity, settings }: {
    entity: Entity;
    settings: NavModifierSettings;
}) {
    const session = useEditorSession();
    return (<CollapsibleSection title="NavMesh Modifier" trailing={<NavRemoveButton label="Remover NavMesh Modifier" onRemove={() => removeNavModifier(session, entity)}/>}>
      <PropertyRow label="Modo">
        <SegmentedControl label="Modo do modificador" options={MODE_OPTIONS} value={settings.mode} onChange={(mode) => setNavModifierMode(session, entity, mode)}/>
      </PropertyRow>
      <p className={NAV_HINT_CLASS}>{MODE_HINT[settings.mode]} Vale na próxima geração do NavMesh.</p>
      {settings.mode !== 'ignore' && (<PropertyRow label="Área">
          <NavAreaSelect label="Área do modificador" value={settings.area} onChange={(area) => setNavModifierArea(session, entity, area)}/>
        </PropertyRow>)}
      {settings.mode === 'volume' && (<>
          <NavVectorRow label="Tamanho" name="Tamanho do volume de área" values={settings.size} onCommit={(axis, value) => setNavModifierVector(session, entity, 'size', axis, value)}/>
          <NavVectorRow label="Centro" name="Centro do volume de área" values={settings.center} onCommit={(axis, value) => setNavModifierVector(session, entity, 'center', axis, value)}/>
        </>)}
    </CollapsibleSection>);
}
