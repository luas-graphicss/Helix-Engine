'use client';
import type { LibraryAsset } from '@/engine/assets/library/asset-types';
import { assignLocalizedAsset } from '@/engine/editor/operations/localization/localized-asset-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { pickLocalizedValue } from '@/engine/localization/fallback/fallback-chain';
import { localeDisplayName } from '@/engine/localization/locale/locale-names';
import type { LocalizedAssetEntry } from '@/engine/localization/settings/localization-settings';
import { SelectField } from '@/engine/ui/select-field';
const NONE = '';
const NONE_LABEL = '— nenhum —';
const REMOVED_LABEL = 'Ativo removido da biblioteca';
type LocalizedAssetFieldProps = {
    entry: LocalizedAssetEntry;
    locale: string;
    chain: readonly string[];
    candidates: readonly LibraryAsset[];
};
function inheritedLabel(entry: LocalizedAssetEntry, chain: readonly string[], candidates: readonly LibraryAsset[]): string {
    const inherited = pickLocalizedValue(entry.values, chain);
    const asset = inherited ? candidates.find((candidate) => candidate.id === inherited.value) : undefined;
    return inherited && asset ? `↳ ${asset.name} (${inherited.locale})` : NONE_LABEL;
}
export function LocalizedAssetField({ entry, locale, chain, candidates }: LocalizedAssetFieldProps) {
    const session = useEditorSession();
    const assetId = entry.values[locale] ?? NONE;
    const removed = assetId !== NONE && !candidates.some((candidate) => candidate.id === assetId);
    const options = [
        { value: NONE, label: assetId === NONE ? inheritedLabel(entry, chain, candidates) : NONE_LABEL },
        ...(removed ? [{ value: assetId, label: REMOVED_LABEL }] : []),
        ...candidates.map((candidate) => ({ value: candidate.id, label: candidate.name })),
    ];
    return <SelectField label={`${entry.key} em ${localeDisplayName(locale)}`} options={options} value={assetId} onChange={(value) => assignLocalizedAsset(session, entry.key, locale, value === NONE ? null : value)}/>;
}
