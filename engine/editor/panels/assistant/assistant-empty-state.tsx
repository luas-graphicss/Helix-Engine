'use client';
import { Plug } from 'lucide-react';
import { ActionButton } from '@/engine/ui/action-button';
type AssistantEmptyStateProps = {
    configured: boolean;
    onConfigure: () => void;
};
export function AssistantEmptyState({ configured, onConfigure }: AssistantEmptyStateProps) {
    return (<div className="flex min-h-0 flex-1 flex-col items-start gap-2 overflow-y-auto px-3 py-3">
      <p className="text-2xs text-muted-foreground">{configured ? 'Peça uma mudança na cena, no código, no terreno ou na interface.' : 'Conecte um modelo para conversar.'}</p>
      {!configured && (<ActionButton icon={Plug} onClick={onConfigure}>
          Configurar conexão
        </ActionButton>)}
    </div>);
}
