'use client';
import { useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Plus } from 'lucide-react';
import { IconButton } from '@/engine/ui/icon-button';
import { FOCUS_RING_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
import { chordFromEvent, isModifierOnly, serializeChord } from '../key-chord';
interface ChordRecorderProps {
    actionLabel: string;
    onRecord(chord: string): void;
}
function heldModifiers(event: KeyboardEvent): string {
    const parts: string[] = [];
    if (event.ctrlKey || event.metaKey)
        parts.push('Ctrl');
    if (event.shiftKey)
        parts.push('Shift');
    if (event.altKey)
        parts.push('Alt');
    return parts.join('+');
}
function isPlainEscape(event: KeyboardEvent): boolean {
    return event.key === 'Escape' && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
}
export function ChordRecorder({ actionLabel, onRecord }: ChordRecorderProps) {
    const [recording, setRecording] = useState(false);
    const [held, setHeld] = useState('');
    const stop = () => {
        setRecording(false);
        setHeld('');
    };
    const onKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
        if (!recording)
            return;
        event.preventDefault();
        event.stopPropagation();
        const native = event.nativeEvent;
        if (isModifierOnly(native)) {
            setHeld(heldModifiers(native));
            return;
        }
        if (isPlainEscape(native)) {
            stop();
            return;
        }
        onRecord(serializeChord(chordFromEvent(native)));
        stop();
    };
    const onKeyUp = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
        if (!recording)
            return;
        event.stopPropagation();
        setHeld(heldModifiers(event.nativeEvent));
    };
    if (!recording) {
        return (<IconButton size="xs" label={`Adicionar atalho para ${actionLabel}`} onClick={() => setRecording(true)}>
        <Plus />
      </IconButton>);
    }
    return (<button type="button" autoFocus aria-live="polite" aria-label={`Gravando atalho para ${actionLabel}. Pressione a combinação; Esc cancela.`} onKeyDown={onKeyDown} onKeyUp={onKeyUp} onBlur={stop} onClick={stop} className={cn('flex h-5 shrink-0 items-center gap-1 rounded-sm border border-primary/70 bg-primary/10 px-1.5 font-mono text-3xs text-primary shadow-[0_0_0_1px_var(--primary)_inset] motion-safe:animate-pulse', FOCUS_RING_CLASS)}>
      {held ? `${held}+…` : 'Pressione as teclas…'}
    </button>);
}
