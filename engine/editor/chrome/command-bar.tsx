'use client';
import { useRef, useState } from 'react';
import { ChevronRight, History, Trash2, X } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { LanguageTag } from '@/engine/editor/code/ui/language-tag';
import { useCodeActions, useCodeSelector } from '@/engine/editor/code/ui/use-code-editor';
import { editorDialogs } from '@/engine/editor/dialogs/editor-dialogs';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS, MENU_LABEL_CLASS } from '@/engine/editor/menus/menu-styles';
import { runCommand } from '@/engine/editor/operations/script-operations';
import { shallowEqual, useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { COMMAND_BAR_INPUT_ID } from '@/engine/editor/shortcuts/focus-targets';
import { useShortcutHint } from '@/engine/editor/shortcuts/shortcut-bindings';
import { scriptLanguage } from '@/engine/scripting/script-languages';
import { IconButton } from '@/engine/ui/icon-button';
import { cn } from '@/lib/utils';
export function CommandBar() {
    const session = useSessionTopic('scene');
    const code = useCodeActions();
    const { draft, history } = useCodeSelector((current) => ({ draft: current.commandDraft, history: current.commandHistory }), shallowEqual);
    const hint = useShortcutHint();
    const inputRef = useRef<HTMLInputElement>(null);
    const [historyIndex, setHistoryIndex] = useState<number | null>(null);
    const { baseLanguage } = session.scene.scripting;
    const language = baseLanguage ? scriptLanguage(baseLanguage) : null;
    const submit = () => {
        const text = draft;
        if (!text.trim())
            return;
        runCommand(session, text);
        setHistoryIndex(null);
    };
    const recall = (direction: -1 | 1) => {
        if (history.length === 0)
            return;
        const next = historyIndex === null ? (direction < 0 ? history.length - 1 : null) : historyIndex + direction;
        if (next === null || next >= history.length) {
            setHistoryIndex(null);
            code.setCommandDraft('');
            return;
        }
        const index = Math.max(0, next);
        setHistoryIndex(index);
        code.setCommandDraft(history[index].text);
    };
    return (<div className="flex h-7 shrink-0 items-center gap-1.5 border-t border-border bg-surface px-1.5" role="group" aria-label="Barra de comando">
      <button type="button" title={language ? `Comandos em ${language.label} (linguagem base do jogo)` : 'Sem linguagem base: escolha uma para a barra interpretar comandos'} onClick={() => editorDialogs.open('baseLanguage')} className="flex h-5 shrink-0 items-center gap-1 rounded-sm px-1 text-muted-foreground transition-colors hover:bg-highlight">
        <ChevronRight className="size-3.5 text-primary" aria-hidden/>
        {language ? <LanguageTag language={language.id} silent/> : <span className="font-mono text-3xs text-warning">sem linguagem</span>}
      </button>
      <input ref={inputRef} id={COMMAND_BAR_INPUT_ID} value={draft} placeholder={language ? `Linha de ${language.label} para executar na cena · help para os comandos da engine` : 'help · scripts · lang · clear'} aria-label="Comando" spellCheck={false} autoComplete="off" onChange={(event) => {
            code.setCommandDraft(event.currentTarget.value);
            setHistoryIndex(null);
        }} onKeyDown={(event) => {
            if (event.nativeEvent.isComposing || event.keyCode === 229)
                return;
            if (event.key === 'Enter') {
                event.preventDefault();
                submit();
            }
            else if (event.key === 'ArrowUp') {
                event.preventDefault();
                recall(-1);
            }
            else if (event.key === 'ArrowDown') {
                event.preventDefault();
                recall(1);
            }
            else if (event.key === 'Escape') {
                event.currentTarget.blur();
            }
        }} className={cn('h-5 min-w-0 flex-1 bg-transparent font-mono text-2xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none')}/>
      <DropdownMenu>
        <DropdownMenuTrigger render={<IconButton label="Histórico de comandos" size="sm" disabled={history.length === 0} className="data-[popup-open]:bg-highlight"/>}>
          <History />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" sideOffset={4} className={`${MENU_CONTENT_CLASS} max-h-80 w-96 overflow-y-auto`}>
          <DropdownMenuGroup>
            <DropdownMenuLabel className={MENU_LABEL_CLASS}>Comandos recentes</DropdownMenuLabel>
            {[...history].reverse().map((entry) => (<DropdownMenuItem key={entry.id} className={`${MENU_ITEM_CLASS} font-mono`} onClick={() => {
                code.setCommandDraft(entry.text);
                inputRef.current?.focus();
            }}>
                {entry.language && <LanguageTag language={entry.language} silent/>}
                <span className="truncate">{entry.text}</span>
              </DropdownMenuItem>))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem className={MENU_ITEM_CLASS} variant="destructive" onClick={() => code.clearCommandHistory()}>
              <Trash2 aria-hidden/>
              Limpar o histórico
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <IconButton label={hint('Ocultar a barra de comando', 'code.toggleCommandBar')} size="sm" onClick={() => code.setCommandBarVisible(false)}>
        <X />
      </IconButton>
    </div>);
}
