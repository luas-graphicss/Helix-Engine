'use client';
import { cn } from '@/lib/utils';
import { chordParts } from '../key-chord';
import type { ShortcutActionId } from '../shortcut-actions';
import { useShortcutLabel } from '../shortcut-bindings';
export const KBD_CLASS = 'rounded-sm border border-border-strong bg-surface-sunken px-1.5 py-px font-mono text-3xs whitespace-nowrap text-foreground shadow-well';
type KeyChipsProps = {
    chord: string;
    className?: string;
};
export function KeyChips({ chord, className }: KeyChipsProps) {
    return (<span className={cn('inline-flex shrink-0 items-center gap-0.5', className)}>
      {chordParts(chord).map((part, index) => (<kbd key={`${index}-${part}`} className={KBD_CLASS}>
          {part}
        </kbd>))}
    </span>);
}
type ShortcutKbdProps = {
    action: ShortcutActionId;
    className?: string;
};
export function ShortcutKbd({ action, className }: ShortcutKbdProps) {
    const label = useShortcutLabel(action);
    if (!label)
        return null;
    return <kbd className={className ?? KBD_CLASS}>{label}</kbd>;
}
