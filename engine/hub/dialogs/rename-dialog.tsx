'use client';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { TEXT_INPUT_CLASS } from '@/engine/ui/surface-styles';
import { DEFAULT_PROJECT_NAME, MAX_PROJECT_NAME_LENGTH, type ProjectRecord } from '@/engine/project/project-record';
import { useHub } from '../hub-context';
import { HubDialogShell } from './hub-dialog-shell';
export function RenameDialog({ record, onClose }: {
    record: ProjectRecord;
    onClose(): void;
}) {
    const { actions } = useHub();
    const [name, setName] = useState(record.name);
    const [saving, setSaving] = useState(false);
    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setSaving(true);
        try {
            await actions.rename(record, name);
        }
        finally {
            setSaving(false);
            onClose();
        }
    };
    return (<HubDialogShell title="Renomear jogo" description="O nome aparece na tela inicial, no título do editor e no arquivo exportado. Em branco, volta a ser o nome padrão." onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-5">
        <input autoFocus value={name} maxLength={MAX_PROJECT_NAME_LENGTH} placeholder={DEFAULT_PROJECT_NAME} aria-label="Nome do jogo" onChange={(event) => setName(event.target.value)} onFocus={(event) => event.target.select()} className={cn(TEXT_INPUT_CLASS, 'h-9 text-sm')}/>
        <DialogFooter>
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar nome'}
          </Button>
        </DialogFooter>
      </form>
    </HubDialogShell>);
}
