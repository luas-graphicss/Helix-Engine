'use client';
import { Fragment } from 'react';
import { Plus } from 'lucide-react';
import { addInputAction } from '@/engine/editor/operations/input/input-action-operations';
import { addInputBinding } from '@/engine/editor/operations/input/input-binding-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import type { InputActionMap, InputAsset } from '@/engine/input/actions/input-asset';
import { IconButton } from '@/engine/ui/icon-button';
import { SelectField } from '@/engine/ui/select-field';
import { ACTION_TYPE_LABEL } from '../input-labels';
import { Column, ColumnNote } from '../shared/column';
import { ListRow } from '../shared/list-row';
import { BindingRows } from './binding-rows';
import type { InputSelection } from './input-selection';
export const EVERY_SCHEME = '';
type ActionsColumnProps = {
    asset: InputAsset;
    map: InputActionMap | null;
    scheme: string;
    onSchemeChange: (schemeId: string) => void;
    selection: InputSelection;
    onSelect: (selection: InputSelection) => void;
};
export function ActionsColumn({ asset, map, scheme, onSchemeChange, selection, onSelect }: ActionsColumnProps) {
    const session = useEditorSession();
    const schemeOptions = [{ value: EVERY_SCHEME, label: 'Todos os esquemas' }, ...asset.schemes.map(({ id, name }) => ({ value: id, label: name }))];
    const newBindingSchemes = scheme === EVERY_SCHEME ? [] : [scheme];
    return (<Column title={map ? `Ações de ${map.name}` : 'Ações'} className="min-h-24 flex-1" actions={<>
          <span className="flex w-36">
            <SelectField label="Esquema exibido" options={schemeOptions} value={scheme} onChange={onSchemeChange}/>
          </span>
          <IconButton label="Adicionar ação" size="xs" disabled={!map} onClick={() => {
                if (map)
                    onSelect({ kind: 'action', actionId: addInputAction(session, map.id) });
            }}>
            <Plus />
          </IconButton>
        </>}>
      {!map && <ColumnNote>Crie um mapa de ações para começar.</ColumnNote>}
      {map?.actions.length === 0 && <ColumnNote>Este mapa ainda não tem ações.</ColumnNote>}
      {map?.actions.map((action) => (<Fragment key={action.id}>
          <ListRow selected={selection?.kind === 'action' && selection.actionId === action.id} title={`${map.name}/${action.name}`} onSelect={() => onSelect({ kind: 'action', actionId: action.id })} actions={<IconButton label={`Adicionar vínculo a ${action.name}`} size="xs" onClick={() => onSelect({ kind: 'binding', bindingId: addInputBinding(session, action.id, newBindingSchemes), part: null })}>
                <Plus />
              </IconButton>}>
            <span className="min-w-0 flex-1 truncate font-medium">{action.name}</span>
            <span className="shrink-0 font-mono text-3xs text-muted-foreground/70">{ACTION_TYPE_LABEL[action.type]}</span>
          </ListRow>
          {action.bindings.filter((binding) => scheme === EVERY_SCHEME || binding.schemes.length === 0 || binding.schemes.includes(scheme)).map((binding) => (<BindingRows key={binding.id} asset={asset} binding={binding} selection={selection} onSelect={onSelect}/>))}
        </Fragment>))}
    </Column>);
}
