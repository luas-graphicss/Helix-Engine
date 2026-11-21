import { normalizeEntryKey } from '../settings/entry-key';
import { findLocale, type LocalizationSettings, type LocalizedAssetEntry, type LocalizedAssetKind } from '../settings/localization-settings';
import { hasEntry, withEntry, withEntryValue, withRenamedEntry, withoutEntry } from './entry-edits';
function withAssets(settings: LocalizationSettings, assets: LocalizedAssetEntry[]): LocalizationSettings {
    return assets === settings.assets ? settings : { ...settings, assets };
}
export function addLocalizedAsset(settings: LocalizationSettings, name: string, kind: LocalizedAssetKind): LocalizationSettings {
    const key = normalizeEntryKey(name);
    if (key === null || hasEntry(settings.assets, key))
        return settings;
    return { ...settings, assets: [...settings.assets, { key, kind, values: {} }] };
}
export function removeLocalizedAsset(settings: LocalizationSettings, key: string): LocalizationSettings {
    return withAssets(settings, withoutEntry(settings.assets, key));
}
export function renameLocalizedAsset(settings: LocalizationSettings, key: string, name: string): LocalizationSettings {
    return withAssets(settings, withRenamedEntry(settings.assets, key, name));
}
export function setLocalizedAssetKind(settings: LocalizationSettings, key: string, kind: LocalizedAssetKind): LocalizationSettings {
    return withAssets(settings, withEntry(settings.assets, key, (entry) => (entry.kind === kind ? entry : { ...entry, kind, values: {} })));
}
export function setLocalizedAsset(settings: LocalizationSettings, key: string, locale: string, assetId: string | null): LocalizationSettings {
    return findLocale(settings, locale) ? withAssets(settings, withEntryValue(settings.assets, key, locale, assetId ?? '')) : settings;
}
