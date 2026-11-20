'use client';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Ear } from 'lucide-react';
import { ActionButton } from '@/engine/ui/action-button';
import { OVERLAY_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
type ListenOverlayProps = {
    onCancel: () => void;
};
export function ListenOverlay({ onCancel }: ListenOverlayProps) {
    const cancelButton = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        const previous = document.activeElement;
        cancelButton.current?.focus();
        return () => {
            if (previous instanceof HTMLElement)
                previous.focus();
        };
    }, []);
    return createPortal(<div role="dialog" aria-modal="true" aria-label="Escutando um controle" className="fixed inset-0 z-50 flex items-center justify-center bg-background/70" onPointerDown={(event) => event.preventDefault()} onContextMenu={(event) => event.preventDefault()}>
      <div className={cn('flex flex-col items-center gap-3 rounded-sm border border-border px-6 py-5', OVERLAY_CLASS)}>
        <Ear className="size-5 text-primary" aria-hidden/>
        <p className="text-xs font-medium text-foreground">Acione o controle que quer vincular</p>
        <p className="text-2xs text-muted-foreground">Esc cancela</p>
        <ActionButton ref={cancelButton} onClick={onCancel}>
          Cancelar
        </ActionButton>
      </div>
    </div>, document.body);
}
