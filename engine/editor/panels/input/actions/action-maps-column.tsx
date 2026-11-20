'use client';
import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { addInputMap, removeInputMap, renameInputMap } from '@/engine/editor/operations/input/input-action-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import type { InputActionMap } from '@/engine/input/actions/input-asset';
import { IconButton } from '@/engine/ui/icon-button';
import { Column, ColumnNote } from '../shared/column';
import { ListRow } from '../shared/list-row';
import { NameField } from '../shared/name-field';
type ActionMapsColumnProps = {
    maps: readonly InputActionMap[];
    selectedId: string | null;
    onSelect: (mapId: string) => void;
};
export function ActionMapsColumn({ maps, selectedId, onSelect }: ActionMapsColumnProps) {
    const session = useEditorSession();
    const [renamingId, setRenamingId] = useState<string | null>(null);
    return (<Column title="Mapas" className="max-h-36 shrink-0 @2xl/panel:max-h-none @2xl/panel:w-44" actions={<IconButton label="Adicionar mapa de ações" size="xs" onClick={() => onSelect(addInputMap(session))}>
          <Plus />
        </IconButton>}>
      {maps.length === 0 && <ColumnNote>Nenhum mapa de ações.</ColumnNote>}
      {maps.map((map) => map.id === renamingId ? (<NameField key={map.id} name={map.name} label={`Novo nome de ${map.name}`} onCommit={(name) => renameInputMap(session, map.id, name)} onDone={() => setRenamingId(null)}/>) : (<ListRow key={map.id} selected={map.id === selectedId} title={map.name} onSelect={() => onSelect(map.id)} actions={<>
                <IconButton label={`Renomear ${map.name}`} size="xs" onClick={() => setRenamingId(map.id)}>
                  <Pencil />
                </IconButton>
                <IconButton label={`Excluir ${map.name}`} size="xs" className="hover:text-destructive" onClick={() => removeInputMap(session, map.id)}>
                  <Trash2 />
                </IconButton>
              </>}>
            <span className="min-w-0 flex-1 truncate">{map.name}</span>
            <span className="shrink-0 font-mono text-3xs text-muted-foreground/70">{map.actions.length}</span>
          </ListRow>))}
    </Column>);
}
