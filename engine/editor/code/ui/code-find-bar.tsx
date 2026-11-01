'use client';
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { CaseSensitive, ChevronDown, ChevronUp, ListChecks, Regex, Replace, ReplaceAll, WholeWord, X } from 'lucide-react';
import { shallowEqual } from '@/engine/editor/session/editor-session-context';
import { IconButton } from '@/engine/ui/icon-button';
import { FOCUS_RING_CLASS, TEXT_INPUT_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
import { useCodeActions, useCodeSelector } from './use-code-editor';
const TOGGLE_CLASS = 'flex size-5 shrink-0 items-center justify-center rounded-xs text-muted-foreground transition-colors hover:bg-highlight hover:text-foreground aria-pressed:bg-primary/15 aria-pressed:text-primary [&_svg]:size-3.5';
function FindToggle({ label, pressed, onToggle, children }: {
    label: string;
    pressed: boolean;
    onToggle: () => void;
    children: ReactNode;
}) {
    return (<button type="button" title={label} aria-label={label} aria-pressed={pressed} onClick={onToggle} className={cn(TOGGLE_CLASS, FOCUS_RING_CLASS)}>
      {children}
    </button>);
}
function isValidRegex(pattern: string): boolean {
    try {
        new RegExp(pattern);
        return true;
    }
    catch {
        return false;
    }
}
export function CodeFindBar({ assetId }: {
    assetId: string;
}) {
    const code = useCodeActions();
    const { find, view } = useCodeSelector((current) => ({ find: current.find, view: current.view }), shallowEqual);
    const inputRef = useRef<HTMLInputElement>(null);
    const invalidRegex = find.regex && find.query.length > 0 && !isValidRegex(find.query);
    const { total, current } = find;
    const hasMatches = total > 0 && !invalidRegex;
    useEffect(() => {
        const input = inputRef.current;
        if (!input)
            return;
        input.focus();
        input.select();
    }, [assetId]);
    const onQueryKey = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.nativeEvent.isComposing || event.keyCode === 229)
            return;
        if (event.key === 'Enter') {
            event.preventDefault();
            if (event.altKey)
                view?.selectAllMatches();
            else if (event.shiftKey)
                view?.findPrevious();
            else
                view?.findNext();
        }
        else if (event.key === 'Escape') {
            event.preventDefault();
            code.closeFind();
            view?.focus();
        }
    };
    const onReplacementKey = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.nativeEvent.isComposing || event.keyCode === 229)
            return;
        if (event.key === 'Enter') {
            event.preventDefault();
            if (event.ctrlKey || event.metaKey)
                view?.replaceAll();
            else
                view?.replaceNext();
        }
        else if (event.key === 'Escape') {
            event.preventDefault();
            code.closeFind();
            view?.focus();
        }
    };
    const inputClass = cn(TEXT_INPUT_CLASS, 'h-6 min-w-0 flex-1 font-mono text-2xs');
    const summary = invalidRegex ? 'expressão inválida' : find.query ? (current >= 0 ? `${current + 1} de ${total}` : `${total} ${total === 1 ? 'ocorrência' : 'ocorrências'}`) : '';
    return (<div className="flex shrink-0 flex-col gap-1 border-b border-border bg-surface px-2 py-1" role="search" aria-label="Buscar no script">
      <div className="flex items-center gap-1">
        <IconButton label={find.replace ? 'Esconder a substituição' : 'Mostrar a substituição'} size="xs" onClick={() => code.updateFind({ replace: !find.replace })}>
          {find.replace ? <ChevronUp /> : <ChevronDown />}
        </IconButton>
        <input ref={inputRef} value={find.query} placeholder="Buscar" aria-label="Texto a buscar" aria-invalid={invalidRegex || undefined} spellCheck={false} onChange={(event) => code.updateFind({ query: event.currentTarget.value })} onKeyDown={onQueryKey} className={cn(inputClass, invalidRegex && 'border-destructive/70')}/>
        <span className={cn('min-w-16 shrink-0 text-right font-mono text-3xs tabular-nums whitespace-nowrap', total === 0 && find.query ? 'text-warning' : 'text-muted-foreground')} aria-live="polite">
          {summary}
        </span>
        <FindToggle label="Diferenciar maiúsculas" pressed={find.matchCase} onToggle={() => code.updateFind({ matchCase: !find.matchCase })}>
          <CaseSensitive />
        </FindToggle>
        <FindToggle label="Palavra inteira" pressed={find.wholeWord} onToggle={() => code.updateFind({ wholeWord: !find.wholeWord })}>
          <WholeWord />
        </FindToggle>
        <FindToggle label="Expressão regular" pressed={find.regex} onToggle={() => code.updateFind({ regex: !find.regex })}>
          <Regex />
        </FindToggle>
        <span className="mx-0.5 h-4 w-px bg-border-strong" aria-hidden/>
        <IconButton label="Ocorrência anterior (Shift Enter)" size="xs" disabled={!hasMatches} onClick={() => view?.findPrevious()}>
          <ChevronUp />
        </IconButton>
        <IconButton label="Próxima ocorrência (Enter)" size="xs" disabled={!hasMatches} onClick={() => view?.findNext()}>
          <ChevronDown />
        </IconButton>
        <IconButton label="Selecionar todas as ocorrências (Alt Enter)" size="xs" disabled={!hasMatches} onClick={() => view?.selectAllMatches()}>
          <ListChecks />
        </IconButton>
        <IconButton label="Fechar a busca (Esc)" size="xs" onClick={() => {
            code.closeFind();
            view?.focus();
        }}>
          <X />
        </IconButton>
      </div>
      {find.replace && (<div className="flex items-center gap-1 pl-6">
          <input value={find.replacement} placeholder={find.regex ? 'Substituir por ($1, $& …)' : 'Substituir por'} aria-label="Texto de substituição" spellCheck={false} onChange={(event) => code.updateFind({ replacement: event.currentTarget.value })} onKeyDown={onReplacementKey} className={inputClass}/>
          <IconButton label="Substituir a ocorrência atual (Enter)" size="xs" disabled={!hasMatches} onClick={() => view?.replaceNext()}>
            <Replace />
          </IconButton>
          <IconButton label={`Substituir todas (Ctrl Enter)${hasMatches ? ` · ${total}` : ''}`} size="xs" disabled={!hasMatches} onClick={() => view?.replaceAll()}>
            <ReplaceAll />
          </IconButton>
        </div>)}
    </div>);
}
