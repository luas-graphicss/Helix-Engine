import type { EditorSession } from '@/engine/editor/session/editor-session';
import { addLocalizedAsset, removeLocalizedAsset, renameLocalizedAsset, setLocalizedAsset, setLocalizedAssetKind } from '@/engine/localization/edits/localized-asset-edits';
import { normalizeEntryKey } from '@/engine/localization/settings/entry-key';
import type { LocalizedAssetKind } from '@/engine/localization/settings/localization-settings';
import { editLocalization } from './localization-edit';
export function addLocalizedAssetEntry(session: EditorSession, name: string, kind: LocalizedAssetKind): string | null {
    const key = normalizeEntryKey(name);
    return key !== null && editLocalization(session, 'Adicionar ativo por idioma', (settings) => addLocalizedAsset(settings, key, kind)) ? key : null;
}
export function removeLocalizedAssetEntry(session: EditorSession, key: string): boolean {
    return editLocalization(session, 'Remover ativo por idioma', (settings) => removeLocalizedAsset(settings, key));
}
export function renameLocalizedAssetEntry(session: EditorSession, key: string, name: string): string | null {
    const renamed = normalizeEntryKey(name);
    return renamed !== null && editLocalization(session, 'Renomear ativo por idioma', (settings) => renameLocalizedAsset(settings, key, renamed)) ? renamed : null;
}
export function setLocalizedAssetEntryKind(session: EditorSession, key: string, kind: LocalizedAssetKind): boolean {
    return editLocalization(session, 'Tipo do ativo por idioma', (settings) => setLocalizedAssetKind(settings, key, kind));
}
export function assignLocalizedAsset(session: EditorSession, key: string, locale: string, assetId: string | null): boolean {
    return editLocalization(session, 'Ativo do idioma', (settings) => setLocalizedAsset(settings, key, locale, assetId));
}
