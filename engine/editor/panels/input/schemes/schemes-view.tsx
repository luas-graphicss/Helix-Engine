'use client';
import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { addInputScheme, removeInputScheme, renameInputScheme } from '@/engine/editor/operations/input/input-scheme-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import type { InputAsset } from '@/engine/input/actions/input-asset';
import { IconButton } from '@/engine/ui/icon-button';
import { Column, ColumnNote } from '../shared/column';
import { ListRow } from '../shared/list-row';
import { NameField } from '../shared/name-field';
import { SchemeDevices } from './scheme-devices';
function bindingCount(asset: InputAsset, schemeId: string): number {
    let total = 0;
    for (const map of asset.maps)
        for (const action of map.actions)
            total += action.bindings.filter((binding) => binding.schemes.includes(schemeId)).length;
    return total;
}
export function SchemesView() {
    const session = useEditorSession();
    const asset = session.scene.input;
    const [schemeId, setSchemeId] = useState<string | null>(null);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const scheme = asset.schemes.find((candidate) => candidate.id === schemeId) ?? asset.schemes[0] ?? null;
    return (<div className="flex h-full min-h-0 flex-col @2xl/panel:flex-row">
      <Column title="Esquemas de controle" className="max-h-40 shrink-0 @2xl/panel:max-h-none @2xl/panel:w-64" actions={<IconButton label="Adicionar esquema de controle" size="xs" onClick={() => setSchemeId(addInputScheme(session))}>
            <Plus />
          </IconButton>}>
        {asset.schemes.length === 0 && <ColumnNote>Nenhum esquema: todos os vínculos valem para qualquer dispositivo.</ColumnNote>}
        {asset.schemes.map((candidate) => candidate.id === renamingId ? (<NameField key={candidate.id} name={candidate.name} label={`Novo nome de ${candidate.name}`} onCommit={(name) => renameInputScheme(session, candidate.id, name)} onDone={() => setRenamingId(null)}/>) : (<ListRow key={candidate.id} selected={candidate.id === scheme?.id} title={candidate.name} onSelect={() => setSchemeId(candidate.id)} actions={<>
                  <IconButton label={`Renomear ${candidate.name}`} size="xs" onClick={() => setRenamingId(candidate.id)}>
                    <Pencil />
                  </IconButton>
                  <IconButton label={`Excluir ${candidate.name} e os vínculos só dele`} size="xs" className="hover:text-destructive" onClick={() => removeInputScheme(session, candidate.id)}>
                    <Trash2 />
                  </IconButton>
                </>}>
              <span className="min-w-0 flex-1 truncate">{candidate.name}</span>
              <span className="shrink-0 font-mono text-3xs text-muted-foreground/70">{bindingCount(asset, candidate.id)} vínc.</span>
            </ListRow>))}
      </Column>
      <Column title={scheme ? `Dispositivos de ${scheme.name}` : 'Dispositivos'} className="min-h-24 flex-1 @2xl/panel:border-r-0">
        {scheme ? <SchemeDevices asset={asset} scheme={scheme}/> : <ColumnNote>Crie um esquema para listar os dispositivos dele.</ColumnNote>}
      </Column>
    </div>);
}
