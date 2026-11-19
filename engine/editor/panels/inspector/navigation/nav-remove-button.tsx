'use client';
import { Trash2 } from 'lucide-react';
import { IconButton } from '@/engine/ui/icon-button';
export function NavRemoveButton({ label, onRemove }: {
    label: string;
    onRemove: () => void;
}) {
    return (<IconButton label={label} size="xs" className="hover:text-destructive" onClick={onRemove}>
      <Trash2 />
    </IconButton>);
}
