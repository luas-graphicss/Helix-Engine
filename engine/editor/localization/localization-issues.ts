import { findAssetIssues, findStringIssues, type LocalizationTable, type TranslationIssue, type TranslationIssueKind } from '@/engine/localization/analysis/translation-issues';
import type { LocalizationSettings } from '@/engine/localization/settings/localization-settings';
export interface LocalizationIssues {
    readonly all: readonly TranslationIssue[];
    readonly byCell: ReadonlyMap<string, readonly TranslationIssue[]>;
    readonly pendingKeys: Readonly<Record<LocalizationTable, ReadonlySet<string>>>;
}
const SEVERITY_ORDER: readonly TranslationIssueKind[] = ['syntax', 'arguments', 'plural', 'asset', 'missing'];
const CELL_SEPARATOR = '\n';
export function issueCellId(table: LocalizationTable, key: string, locale: string): string {
    return [table, locale, key].join(CELL_SEPARATOR);
}
export function collectLocalizationIssues(settings: LocalizationSettings, isKnownAsset: (assetId: string) => boolean): LocalizationIssues {
    const all = [...findStringIssues(settings), ...findAssetIssues(settings, isKnownAsset)].sort((first, second) => SEVERITY_ORDER.indexOf(first.kind) - SEVERITY_ORDER.indexOf(second.kind));
    const byCell = new Map<string, TranslationIssue[]>();
    const pendingKeys = { strings: new Set<string>(), assets: new Set<string>() };
    for (const issue of all) {
        const cell = issueCellId(issue.table, issue.key, issue.locale);
        const known = byCell.get(cell);
        if (known)
            known.push(issue);
        else
            byCell.set(cell, [issue]);
        pendingKeys[issue.table].add(issue.key);
    }
    return { all, byCell, pendingKeys };
}
