import { findActionById, findBinding } from '@/engine/input/actions/asset-queries';
import type { InputAsset } from '@/engine/input/actions/input-asset';
import { Column, ColumnNote } from '../shared/column';
import { ActionProperties } from './action-properties';
import { BindingProperties } from './binding-properties';
import type { InputSelection } from './input-selection';
type PropertiesColumnProps = {
    asset: InputAsset;
    selection: InputSelection;
    newBindingSchemes: readonly string[];
    onSelect: (selection: InputSelection) => void;
};
function PropertiesBody({ asset, selection, newBindingSchemes, onSelect }: PropertiesColumnProps) {
    const located = selection?.kind === 'action' ? findActionById(asset, selection.actionId) : null;
    const bound = selection?.kind === 'binding' ? findBinding(asset, selection.bindingId) : null;
    if (located)
        return <ActionProperties map={located.map} action={located.action} schemes={newBindingSchemes} onSelect={onSelect}/>;
    if (bound && selection?.kind === 'binding')
        return <BindingProperties asset={asset} action={bound.action} binding={bound.binding} part={selection.part}/>;
    return <ColumnNote>Selecione uma ação ou um vínculo.</ColumnNote>;
}
export function PropertiesColumn(props: PropertiesColumnProps) {
    return (<Column title="Propriedades" className="min-h-24 flex-1 @2xl/panel:w-72 @2xl/panel:flex-none @2xl/panel:border-r-0">
      <PropertiesBody {...props}/>
    </Column>);
}
