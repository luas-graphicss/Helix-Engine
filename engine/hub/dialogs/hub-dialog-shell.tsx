'use client';
import type { ReactNode } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
interface HubDialogShellProps {
    title: string;
    description?: ReactNode;
    children?: ReactNode;
    footer?: ReactNode;
    dismissible?: boolean;
    className?: string;
    onClose(): void;
}
export function HubDialogShell({ title, description, children, footer, dismissible = true, className, onClose }: HubDialogShellProps) {
    return (<Dialog open onOpenChange={(open) => {
            if (!open && dismissible)
                onClose();
        }}>
      <DialogContent showCloseButton={dismissible} className={cn('max-w-md gap-5', className)}>
        <DialogHeader className="pr-6">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>);
}
