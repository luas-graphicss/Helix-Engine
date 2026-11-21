import type { AssetKind } from '@/engine/assets/library/asset-types';
export const LOCALIZED_ASSET_KINDS = ['texture', 'audio', 'video', 'font', 'model', 'animation', 'gui', 'vfx', 'prefab'] as const satisfies readonly AssetKind[];
export type LocalizedAssetKind = (typeof LOCALIZED_ASSET_KINDS)[number];
export const DEFAULT_SOURCE_LOCALE = 'en';
export const DEFAULT_LOCALIZED_ASSET_KIND: LocalizedAssetKind = 'texture';
export interface LocaleEntry {
    tag: string;
    fallback: string | null;
    enabled: boolean;
}
export interface LocalizedEntry {
    key: string;
    values: Record<string, string>;
}
export interface StringEntry extends LocalizedEntry {
    note: string;
}
export interface LocalizedAssetEntry extends LocalizedEntry {
    kind: LocalizedAssetKind;
}
export interface LocalizationSettings {
    sourceLocale: string;
    startupLocale: string | null;
    locales: LocaleEntry[];
    strings: StringEntry[];
    assets: LocalizedAssetEntry[];
}
export function createLocaleEntry(tag: string): LocaleEntry {
    return { tag, fallback: null, enabled: true };
}
export function createLocalizationSettings(): LocalizationSettings {
    return { sourceLocale: DEFAULT_SOURCE_LOCALE, startupLocale: null, locales: [createLocaleEntry(DEFAULT_SOURCE_LOCALE)], strings: [], assets: [] };
}
export function isLocalizedAssetKind(value: unknown): value is LocalizedAssetKind {
    return typeof value === 'string' && (LOCALIZED_ASSET_KINDS as readonly string[]).includes(value);
}
export function findLocale(settings: LocalizationSettings, tag: string): LocaleEntry | undefined {
    return settings.locales.find((locale) => locale.tag === tag);
}
export function enabledLocaleTags(settings: LocalizationSettings): string[] {
    return settings.locales.filter((locale) => locale.enabled).map((locale) => locale.tag);
}
export function hasLocalizedValue(entry: LocalizedEntry, locale: string): boolean {
    return Object.hasOwn(entry.values, locale);
}
