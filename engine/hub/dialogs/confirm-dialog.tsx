'use client';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { HubDialogShell } from './hub-dialog-shell';
interface ConfirmDialogProps {
    title: string;
    description: ReactNode;
    confirmLabel: string;
    onConfirm(): Promise<void> | void;
    onClose(): void;
}
export function ConfirmDialog({ title, description, confirmLabel, onConfirm, onClose }: ConfirmDialogProps) {
    const [busy, setBusy] = useState(false);
    const confirm = async () => {
        setBusy(true);
        try {
            await onConfirm();
        }
        finally {
            setBusy(false);
            onClose();
        }
    };
    return (<HubDialogShell title={title} description={description} dismissible={!busy} onClose={onClose} footer={<>
          <Button autoFocus size="sm" variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button size="sm" variant="destructive" onClick={() => void confirm()} disabled={busy}>
            {busy ? 'Excluindo…' : confirmLabel}
          </Button>
        </>}/>);
}
