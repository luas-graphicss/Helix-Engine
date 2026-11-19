'use client';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { ActionButton } from '@/engine/ui/action-button';
export function TrustNotice({ count, onTrust }: {
    count: number;
    onTrust: () => void;
}) {
    return (<div role="alert" className="flex shrink-0 flex-col gap-2 border-b border-border bg-warning/10 p-2 text-2xs">
      <p className="flex items-start gap-1.5 leading-relaxed text-pretty">
        <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden/>
        <span>
          {count === 1 ? 'Este projeto traz 1 extensão.' : `Este projeto traz ${count} extensões.`} Elas rodam código no editor assim que o projeto abre. Ative só se confiar em quem as escreveu.
        </span>
      </p>
      <ActionButton icon={ShieldCheck} variant="primary" onClick={onTrust}>
        Ativar extensões
      </ActionButton>
    </div>);
}
