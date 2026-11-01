'use client';
import { useEffect, useRef, useState } from 'react';
import { FOCUS_RING_CLASS, TEXT_INPUT_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
import type { CodeViewHandle } from '../editor/code-view-handle';
import { useCodeActions } from './use-code-editor';
export function CodeGotoLine({ handle, line }: {
    handle: CodeViewHandle;
    line: number;
}) {
    const code = useCodeActions();
    const inputRef = useRef<HTMLInputElement>(null);
    const [value, setValue] = useState(String(line));
    const total = handle.lineCount();
    useEffect(() => {
        const input = inputRef.current;
        if (!input)
            return;
        input.focus();
        input.select();
    }, []);
    const parsed = /^\s*(\d+)(?:\s*[:,]\s*(\d+))?\s*$/.exec(value);
    const target = parsed ? Math.min(Math.max(1, Number(parsed[1])), total) : null;
    const column = parsed?.[2] ? Math.max(1, Number(parsed[2])) : undefined;
    const go = () => {
        if (target === null)
            return;
        handle.gotoLine(target, column);
        code.closeGotoLine();
    };
    return (<div className="absolute top-2 right-3 z-10 flex items-center gap-2 rounded-sm border border-border-strong bg-surface-overlay px-2 py-1 shadow-overlay" role="dialog" aria-label="Ir para a linha">
      <label htmlFor="code-goto-line" className="text-2xs whitespace-nowrap text-muted-foreground">
        Ir para a linha
      </label>
      <input id="code-goto-line" ref={inputRef} value={value} inputMode="numeric" placeholder={`1–${total}`} aria-invalid={value.trim() !== '' && target === null ? true : undefined} onChange={(event) => setValue(event.currentTarget.value)} onKeyDown={(event) => {
            if (event.nativeEvent.isComposing || event.keyCode === 229)
                return;
            if (event.key === 'Enter') {
                event.preventDefault();
                go();
            }
            else if (event.key === 'Escape') {
                event.preventDefault();
                code.closeGotoLine();
                handle.focus();
            }
        }} onBlur={() => code.closeGotoLine()} className={cn(TEXT_INPUT_CLASS, FOCUS_RING_CLASS, 'h-6 w-24 font-mono text-2xs tabular-nums')}/>
      <span className="font-mono text-3xs tabular-nums text-muted-foreground">de {total}</span>
    </div>);
}
