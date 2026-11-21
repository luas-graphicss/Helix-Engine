import type { EditorSession } from '@/engine/editor/session/editor-session';
import { addLocale, removeLocale, setLocaleEnabled, setLocaleFallback, setSourceLocale, setStartupLocale } from '@/engine/localization/edits/locale-edits';
import { editLocalization } from './localization-edit';
export function addGameLocale(session: EditorSession, tag: string): boolean {
    return editLocalization(session, 'Adicionar idioma', (settings) => addLocale(settings, tag));
}
export function removeGameLocale(session: EditorSession, tag: string): boolean {
    return editLocalization(session, 'Remover idioma', (settings) => removeLocale(settings, tag));
}
export function setGameSourceLocale(session: EditorSession, tag: string): boolean {
    return editLocalization(session, 'Idioma de origem', (settings) => setSourceLocale(settings, tag));
}
export function setGameLocaleFallback(session: EditorSession, tag: string, fallback: string | null): boolean {
    return editLocalization(session, 'Fallback do idioma', (settings) => setLocaleFallback(settings, tag, fallback));
}
export function setGameLocaleEnabled(session: EditorSession, tag: string, enabled: boolean): boolean {
    return editLocalization(session, enabled ? 'Ativar idioma' : 'Desativar idioma', (settings) => setLocaleEnabled(settings, tag, enabled));
}
export function setGameStartupLocale(session: EditorSession, tag: string | null): boolean {
    return editLocalization(session, 'Idioma inicial', (settings) => setStartupLocale(settings, tag));
}
