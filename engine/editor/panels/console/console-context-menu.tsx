'use client';
import { ClipboardCopy, ClipboardList, Copy, FileCode2, TextSelect, Trash2, TriangleAlert } from 'lucide-react';
import { ContextMenuContent, ContextMenuGroup, ContextMenuItem, ContextMenuLabel, ContextMenuSeparator, ContextMenuShortcut } from '@/components/ui/context-menu';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS, MENU_LABEL_CLASS, MENU_SHORTCUT_CLASS } from '@/engine/editor/menus/menu-styles';
import type { LogEntry } from '@/engine/editor/session/editor-log';
import { formatLogEntries, formatLogEntry, isNoteworthy } from '@/engine/editor/session/log-text';
type ConsoleContextMenuContentProps = {
    entry: LogEntry | null;
    entries: readonly LogEntry[];
    onCopy(text: string, what: string): void;
    onSelectAll(): void;
    onOpenLocation(entry: LogEntry): void;
    onClear(): void;
};
function plural(count: number, singular: string, pluralForm: string): string {
    return `${count} ${count === 1 ? singular : pluralForm}`;
}
export function ConsoleContextMenuContent({ entry, entries, onCopy, onSelectAll, onOpenLocation, onClear }: ConsoleContextMenuContentProps) {
    const noteworthy = entries.filter(isNoteworthy);
    const empty = entries.length === 0;
    return (<ContextMenuContent className={`${MENU_CONTENT_CLASS} w-72`}>
      {entry && (<>
          <ContextMenuGroup>
            <ContextMenuLabel className={`${MENU_LABEL_CLASS} truncate normal-case tracking-normal`}>{entry.message}</ContextMenuLabel>
            <ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => onCopy(formatLogEntry(entry, { details: false }), 'Mensagem')}>
              <Copy aria-hidden/>
              Copiar mensagem
            </ContextMenuItem>
            {entry.details && (<ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => onCopy(formatLogEntry(entry), 'Mensagem com detalhes')}>
                <ClipboardList aria-hidden/>
                Copiar com detalhes
              </ContextMenuItem>)}
            {entry.location && (<ContextMenuItem className={MENU_ITEM_CLASS} onClick={() => onOpenLocation(entry)}>
                <FileCode2 aria-hidden/>
                Abrir {entry.location.file}:{entry.location.line}
              </ContextMenuItem>)}
          </ContextMenuGroup>
          <ContextMenuSeparator />
        </>)}
      <ContextMenuGroup>
        <ContextMenuItem className={MENU_ITEM_CLASS} disabled={empty} onClick={() => onCopy(formatLogEntries(entries), 'Console')}>
          <ClipboardCopy aria-hidden/>
          Copiar tudo
          <ContextMenuShortcut className={MENU_SHORTCUT_CLASS}>{plural(entries.length, 'mensagem', 'mensagens')}</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem className={MENU_ITEM_CLASS} disabled={noteworthy.length === 0} onClick={() => onCopy(formatLogEntries(noteworthy), 'Avisos e erros')}>
          <TriangleAlert aria-hidden/>
          Copiar só avisos e erros
          <ContextMenuShortcut className={MENU_SHORTCUT_CLASS}>{noteworthy.length}</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem className={MENU_ITEM_CLASS} disabled={empty} onClick={onSelectAll}>
          <TextSelect aria-hidden/>
          Selecionar tudo
          <ContextMenuShortcut className={MENU_SHORTCUT_CLASS}>Ctrl+A</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuGroup>
      <ContextMenuSeparator />
      <ContextMenuGroup>
        <ContextMenuItem className={MENU_ITEM_CLASS} variant="destructive" disabled={empty} onClick={onClear}>
          <Trash2 aria-hidden/>
          Limpar console
        </ContextMenuItem>
      </ContextMenuGroup>
    </ContextMenuContent>);
}
