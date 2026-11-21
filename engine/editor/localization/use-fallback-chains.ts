'use client';
import { useMemo } from 'react';
import { resolveFallbackChain } from '@/engine/localization/fallback/fallback-chain';
import type { LocalizationSettings } from '@/engine/localization/settings/localization-settings';
export type FallbackChains = ReadonlyMap<string, readonly string[]>;
export function useFallbackChains(settings: LocalizationSettings): FallbackChains {
    const { sourceLocale, locales } = settings;
    return useMemo(() => new Map(locales.map(({ tag }) => [tag, resolveFallbackChain({ sourceLocale, startupLocale: null, locales, strings: [], assets: [] }, tag)])), [sourceLocale, locales]);
}
