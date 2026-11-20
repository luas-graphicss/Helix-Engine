import type { InputAsset, InputBinding } from '@/engine/input/actions/input-asset';
import { COMPOSITE_LABEL, partLabel } from '../input-labels';
import { ControlChip } from '../shared/control-chip';
import { ListRow } from '../shared/list-row';
import type { InputSelection } from './input-selection';
type BindingRowsProps = {
    asset: InputAsset;
    binding: InputBinding;
    selection: InputSelection;
    onSelect: (selection: InputSelection) => void;
};
function schemeSummary(asset: InputAsset, binding: InputBinding): string {
    if (binding.schemes.length === 0)
        return 'Todos';
    return asset.schemes.filter((scheme) => binding.schemes.includes(scheme.id)).map((scheme) => scheme.name).join(', ');
}
export function BindingRows({ asset, binding, selection, onSelect }: BindingRowsProps) {
    const isSelected = (part: string | null) => selection?.kind === 'binding' && selection.bindingId === binding.id && selection.part === part;
    const select = (part: string | null) => onSelect({ kind: 'binding', bindingId: binding.id, part });
    const schemes = <span className="ml-auto max-w-[40%] shrink-0 truncate text-3xs text-muted-foreground/70">{schemeSummary(asset, binding)}</span>;
    if (binding.composite === null)
        return (<ListRow indent={1} selected={isSelected(null)} title="Vínculo de controle" onSelect={() => select(null)}>
        <ControlChip path={binding.path} customLayouts={asset.customDevices}/>
        {schemes}
      </ListRow>);
    const compositeLabel = COMPOSITE_LABEL[binding.composite];
    return (<>
      <ListRow indent={1} selected={isSelected(null)} title={compositeLabel} onSelect={() => select(null)}>
        <span className="min-w-0 truncate text-muted-foreground">{compositeLabel}</span>
        {schemes}
      </ListRow>
      {binding.parts.map((part) => (<ListRow key={part.name} indent={2} selected={isSelected(part.name)} title={`${compositeLabel} · ${partLabel(part.name)}`} onSelect={() => select(part.name)}>
          <span className="w-14 shrink-0 truncate text-muted-foreground">{partLabel(part.name)}</span>
          <ControlChip path={part.path} customLayouts={asset.customDevices}/>
        </ListRow>))}
    </>);
}
