'use client';
import type { ReactNode } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { ShortcutActionId } from '@/engine/editor/shortcuts/shortcut-actions';
import { useShortcutChords } from '@/engine/editor/shortcuts/shortcut-bindings';
import { KeyChips } from '@/engine/editor/shortcuts/ui/key-chips';
export type EditorDialogSize = 'md' | 'lg' | 'xl';
const SIZE_CLASS: Record<EditorDialogSize, string> = {
    md: 'sm:max-w-md',
    lg: 'sm:max-w-2xl',
    xl: 'sm:max-w-5xl',
};
interface EditorDialogShellProps {
    open: boolean;
    onOpenChange(open: boolean): void;
    title: string;
    description?: ReactNode;
    action?: ShortcutActionId;
    size?: EditorDialogSize;
    toolbar?: ReactNode;
    footer?: ReactNode;
    body?: 'scroll' | 'fill';
    dismissible?: boolean;
    children: ReactNode;
}
function HeaderShortcut({ action }: {
    action: ShortcutActionId;
}) {
    const chords = useShortcutChords(action);
    if (chords.length === 0)
        return null;
    return <KeyChips chord={chords[0]} className="ml-auto"/>;
}
export function EditorDialogShell({ open, onOpenChange, title, description, action, size = 'lg', toolbar, footer, body = 'scroll', dismissible = true, children }: EditorDialogShellProps) {
    return (<Dialog open={open} onOpenChange={(next) => {
            if (!next && !dismissible)
                return;
            onOpenChange(next);
        }}>
      <DialogContent showCloseButton={dismissible} className={cn('flex w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden rounded-sm border-border-strong bg-surface p-0 text-foreground', body === 'fill' ? 'h-[min(46rem,calc(100dvh-2rem))]' : 'max-h-[calc(100dvh-2rem)]', SIZE_CLASS[size])}>
        <DialogHeader className="shrink-0 gap-1 border-b border-border bg-surface px-5 pt-4 pb-3">
          <div className="flex items-center gap-3 pr-7">
            <DialogTitle className="text-sm">{title}</DialogTitle>
            {action && <HeaderShortcut action={action}/>}
          </div>
          {description && <DialogDescription>{description}</DialogDescription>}
          {toolbar && <div className="flex items-center gap-2 pt-2">{toolbar}</div>}
        </DialogHeader>
        <div className={cn('min-h-0 flex-1', body === 'fill' ? 'flex' : 'overflow-y-auto')}>{children}</div>
        {footer && (<div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border bg-surface-sunken px-4 py-2.5 shadow-[inset_0_1px_0_0_var(--bevel)]">
            {footer}
          </div>)}
      </DialogContent>
    </Dialog>);
}
