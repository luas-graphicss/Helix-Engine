'use client';
import { useMemo } from 'react';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { collectLocalizationIssues, type LocalizationIssues } from './localization-issues';
export function useLocalizationIssues(session: EditorSession): LocalizationIssues {
    const { library } = session;
    const { sourceLocale, locales, strings, assets } = session.scene.localization;
    const librarySize = library.size;
    return useMemo(() => collectLocalizationIssues({ sourceLocale, startupLocale: null, locales, strings, assets }, (assetId) => librarySize > 0 && library.get(assetId) !== null), [sourceLocale, locales, strings, assets, library, librarySize]);
}
