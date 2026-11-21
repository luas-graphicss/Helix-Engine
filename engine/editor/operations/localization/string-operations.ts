import type { EditorSession } from '@/engine/editor/session/editor-session';
import { addString, removeString, renameString, setStringNote, setTranslation } from '@/engine/localization/edits/string-edits';
import { normalizeEntryKey } from '@/engine/localization/settings/entry-key';
import { editLocalization } from './localization-edit';
export function addLocalizedString(session: EditorSession, name: string): string | null {
    const key = normalizeEntryKey(name);
    return key !== null && editLocalization(session, 'Adicionar texto', (settings) => addString(settings, key)) ? key : null;
}
export function removeLocalizedString(session: EditorSession, key: string): boolean {
    return editLocalization(session, 'Remover texto', (settings) => removeString(settings, key));
}
export function renameLocalizedString(session: EditorSession, key: string, name: string): string | null {
    const renamed = normalizeEntryKey(name);
    return renamed !== null && editLocalization(session, 'Renomear texto', (settings) => renameString(settings, key, renamed)) ? renamed : null;
}
export function setLocalizedStringNote(session: EditorSession, key: string, note: string): boolean {
    return editLocalization(session, 'Nota do texto', (settings) => setStringNote(settings, key, note.trim()));
}
export function translateLocalizedString(session: EditorSession, key: string, locale: string, text: string): boolean {
    return editLocalization(session, 'Editar tradução', (settings) => setTranslation(settings, key, locale, text));
}
