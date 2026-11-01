'use client';
import { FlaskConical, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LanguageTag } from '@/engine/editor/code/ui/language-tag';
import type { BaseLanguageChangePlan } from '@/engine/editor/operations/script-operations';
import { scriptLanguage } from '@/engine/scripting/script-languages';
import { WELL_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
import { editorDialogs } from './editor-dialogs';
interface LanguageChangeDialogProps {
    plan: BaseLanguageChangePlan | null;
    onConfirm(): void;
    onCancel(): void;
}
const MAX_LISTED = 6;
export function LanguageChangeDialog({ plan, onConfirm, onCancel }: LanguageChangeDialogProps) {
    const to = plan ? scriptLanguage(plan.to) : null;
    const from = plan?.from ? scriptLanguage(plan.from) : null;
    const affected = plan?.affected ?? [];
    const listed = affected.slice(0, MAX_LISTED);
    const rest = affected.length - listed.length;
    return (<Dialog open={plan !== null} onOpenChange={(open) => {
            if (!open)
                onCancel();
        }}>
      <DialogContent className="max-w-md gap-4">
        <DialogHeader className="pr-6">
          <DialogTitle className="flex items-center gap-2">
            <TriangleAlert className="size-4 text-warning" aria-hidden/>
            {to ? `Trocar a linguagem do jogo para ${to.label}?` : 'Trocar a linguagem do jogo?'}
          </DialogTitle>
          <DialogDescription>
            {affected.length === 1 ? 'Um script' : `${affected.length} scripts`} {from ? `em ${from.label}` : 'noutra linguagem'} {affected.length === 1 ? 'deixa' : 'deixam'} de compilar e de rodar com a troca. Nada é
            apagado: {affected.length === 1 ? 'ele volta' : 'eles voltam'} a funcionar assim que a linguagem {from ? `voltar a ${from.label}` : 'voltar'}.
          </DialogDescription>
        </DialogHeader>

        <ul className={cn('flex max-h-48 flex-col divide-y divide-border/60 overflow-y-auto rounded-sm', WELL_CLASS)} aria-label="Scripts afetados">
          {listed.map((asset) => (<li key={asset.id} className="flex items-center gap-2 px-3 py-1.5 text-2xs">
              {asset.details.kind === 'script' && <LanguageTag language={asset.details.language} silent/>}
              <span className="min-w-0 flex-1 truncate text-foreground">{asset.name}</span>
              {asset.details.kind === 'script' && <span className="shrink-0 font-mono text-3xs text-muted-foreground">{asset.details.lines} {asset.details.lines === 1 ? 'linha' : 'linhas'}</span>}
            </li>))}
          {rest > 0 && <li className="px-3 py-1.5 font-mono text-3xs text-muted-foreground">e mais {rest}</li>}
        </ul>

        <p className="flex items-start gap-2 text-2xs leading-relaxed text-pretty text-muted-foreground">
          <FlaskConical className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden/>
          <span>
            Para ter scripts em mais de uma linguagem no mesmo jogo, ligue <strong className="font-medium text-foreground">Mesclagem de linguagens</strong> em{' '}
            <button type="button" className="text-primary hover:underline" onClick={() => editorDialogs.open('beta')}>
              Funcionalidades beta
            </button>
            .
          </span>
        </p>

        <DialogFooter>
          <Button size="sm" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button size="sm" onClick={onConfirm}>
            {to ? `Trocar para ${to.label}` : 'Trocar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>);
}
