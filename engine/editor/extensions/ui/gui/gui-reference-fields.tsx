'use client';
import { Crosshair, X } from 'lucide-react';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { FieldInput } from '@/engine/ui/field-input';
import { IconButton } from '@/engine/ui/icon-button';
import { PropertyRow } from '@/engine/ui/property-row';
import { SelectField } from '@/engine/ui/select-field';
import type { GuiActorNode, GuiAssetNode } from '../../gui/gui-node';
const NO_ASSET = '';
export function GuiActorField({ node, onChange }: {
    node: GuiActorNode;
    onChange: (actorId: number | null) => void;
}) {
    const session = useSessionTopic('selection', 'scene');
    const actor = node.value === null ? null : session.findById(node.value);
    const selected = session.selectedEntity;
    return (<PropertyRow label={node.label}>
      <FieldInput readOnly value={actor?.name ?? 'Nenhum'} aria-label={node.label} className={actor ? undefined : 'text-muted-foreground'}/>
      <IconButton label={selected ? `Usar ${selected.name}` : 'Selecione um ator na cena para usá-lo aqui'} size="xs" disabled={node.disabled || !selected} onClick={() => selected && onChange(selected.id)}>
        <Crosshair />
      </IconButton>
      <IconButton label={`Limpar ${node.label}`} size="xs" disabled={node.disabled || node.value === null} onClick={() => onChange(null)}>
        <X />
      </IconButton>
    </PropertyRow>);
}
export function GuiAssetField({ node, onChange }: {
    node: GuiAssetNode;
    onChange: (assetId: string | null) => void;
}) {
    const session = useSessionTopic('assets');
    const assets = node.assetKind ? session.library.byKind(node.assetKind) : session.library.all;
    const options = [{ value: NO_ASSET, label: 'Nenhum' }, ...assets.map((asset) => ({ value: asset.id, label: asset.name }))];
    return (<PropertyRow label={node.label}>
      <SelectField label={node.label} options={options} value={node.value ?? NO_ASSET} disabled={node.disabled} onChange={(value) => onChange(value === NO_ASSET ? null : value)}/>
    </PropertyRow>);
}
