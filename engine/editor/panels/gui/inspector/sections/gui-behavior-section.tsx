'use client';
import type { GuiNode } from '@/engine/gui/document/gui-document';
import { setGuiFlag, type GuiFlagKey } from '@/engine/editor/operations/gui-property-operations';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { PropertyRow } from '@/engine/ui/property-row';
import { ToggleField } from '@/engine/ui/toggle-field';
import { useGuiEdit } from '../use-gui-edit';
const FLAGS: ReadonlyArray<{
    key: GuiFlagKey;
    label: string;
}> = [
    { key: 'visible', label: 'Visível' },
    { key: 'interactable', label: 'Recebe cliques' },
    { key: 'clipsContent', label: 'Recortar conteúdo' },
    { key: 'locked', label: 'Bloqueado no editor' },
];
export function GuiBehaviorSection({ node }: {
    node: GuiNode;
}) {
    const { session } = useGuiEdit();
    return (<CollapsibleSection title="Comportamento" defaultOpen={false}>
      {FLAGS.map((flag) => (<ToggleField key={flag.key} label={flag.label} on={node[flag.key]} onToggle={() => setGuiFlag(session, flag.key, !node[flag.key])}/>))}
      <PropertyRow label="Identificador">
        <span className="truncate font-mono text-3xs text-muted-foreground" title={node.id}>
          {node.id}
        </span>
      </PropertyRow>
    </CollapsibleSection>);
}
