'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CircleCheck, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { HUB_PATH } from '@/engine/hub/hub-routes';
import { exitEngine } from '../operations/engine-operations';
import { useEditorSession } from '../session/editor-session-context';
interface ExitDialogProps {
    open: boolean;
    onOpenChange(open: boolean): void;
}
type ExitPhase = 'confirm' | 'saving' | 'blocked';
export function ExitDialog({ open, onOpenChange }: ExitDialogProps) {
    const session = useEditorSession();
    const router = useRouter();
    const [phase, setPhase] = useState<ExitPhase>('confirm');
    useEffect(() => {
        if (open)
            setPhase('confirm');
    }, [open]);
    const exit = async () => {
        setPhase('saving');
        const closed = await exitEngine(session);
        if (!closed)
            setPhase('blocked');
    };
    return (<Dialog open={open} onOpenChange={(next) => {
            if (!next && phase === 'saving')
                return;
            onOpenChange(next);
        }}>
      <DialogContent showCloseButton={phase !== 'saving'} className="max-w-md gap-5">
        {phase === 'blocked' ? (<>
            <DialogHeader className="pr-6">
              <DialogTitle className="flex items-center gap-2">
                <CircleCheck className="size-4 text-success" aria-hidden/>
                Tudo salvo
              </DialogTitle>
              <DialogDescription>
                A cena, as bibliotecas e as preferências foram gravadas. O navegador só deixa um script fechar abas que ele mesmo abriu, então feche esta aba à mão
                (Ctrl+W ou Cmd+W) ou volte à tela inicial.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
                Continuar editando
              </Button>
              <Button size="sm" onClick={() => router.push(HUB_PATH)}>
                Voltar ao início
              </Button>
            </DialogFooter>
          </>) : (<>
            <DialogHeader className="pr-6">
              <DialogTitle>Sair da Helix Engine?</DialogTitle>
              <DialogDescription>
                O jogo &quot;{session.projectName}&quot;, as bibliotecas e as suas preferências são gravados antes de a aba fechar. Nada fica pendente.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button size="sm" variant="outline" disabled={phase === 'saving'} onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button size="sm" disabled={phase === 'saving'} onClick={() => void exit()}>
                <LogOut data-icon="inline-start" aria-hidden/>
                {phase === 'saving' ? 'Salvando…' : 'Salvar e sair'}
              </Button>
            </DialogFooter>
          </>)}
      </DialogContent>
    </Dialog>);
}
