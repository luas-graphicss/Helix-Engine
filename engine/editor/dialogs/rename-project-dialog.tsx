'use client';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { TEXT_INPUT_CLASS } from '@/engine/ui/surface-styles';
import { DEFAULT_PROJECT_NAME, MAX_PROJECT_NAME_LENGTH } from '@/engine/project/project-record';
import { useEditorSession } from '../session/editor-session-context';
interface RenameProjectDialogProps {
    open: boolean;
    onOpenChange(open: boolean): void;
}
export function RenameProjectDialog({ open, onOpenChange }: RenameProjectDialogProps) {
    return (<Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-5">
        <DialogHeader className="pr-6">
          <DialogTitle>Renomear jogo</DialogTitle>
          <DialogDescription>O nome aparece na tela inicial, no título da aba e no arquivo exportado. Em branco, volta a ser o nome padrão.</DialogDescription>
        </DialogHeader>
        <RenameForm onDone={() => onOpenChange(false)}/>
      </DialogContent>
    </Dialog>);
}
function RenameForm({ onDone }: {
    onDone(): void;
}) {
    const session = useEditorSession();
    const [name, setName] = useState(session.projectName);
    const submit = (event: FormEvent) => {
        event.preventDefault();
        session.renameProject(name);
        onDone();
    };
    return (<form onSubmit={submit} className="flex flex-col gap-5">
      <input autoFocus value={name} maxLength={MAX_PROJECT_NAME_LENGTH} placeholder={DEFAULT_PROJECT_NAME} aria-label="Nome do jogo" onChange={(event) => setName(event.target.value)} onFocus={(event) => event.target.select()} className={cn(TEXT_INPUT_CLASS, 'h-9 text-sm')}/>
      <DialogFooter>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" size="sm">
          Salvar nome
        </Button>
      </DialogFooter>
    </form>);
}
