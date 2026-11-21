'use client';
import { Trash2 } from 'lucide-react';
import type { FallbackChains } from '@/engine/editor/localization/use-fallback-chains';
import { removeLocalizedAssetEntry, renameLocalizedAssetEntry, setLocalizedAssetEntryKind } from '@/engine/editor/operations/localization/localized-asset-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import type { LocalizationSettings, LocalizedAssetEntry } from '@/engine/localization/settings/localization-settings';
import { IconButton } from '@/engine/ui/icon-button';
import { SelectField } from '@/engine/ui/select-field';
import { cn } from '@/lib/utils';
import { ASSET_KIND_OPTIONS } from '../localization-labels';
import { EntryKeyField } from '../shared/entry-key-field';
import { CELL_CLASS, ROW_ACTION_CLASS, ROW_CLASS } from '../shared/locale-table';
import { LocalizedAssetField } from './localized-asset-field';
const NO_CHAIN: readonly string[] = [];
type AssetRowProps = {
    settings: LocalizationSettings;
    entry: LocalizedAssetEntry;
    chains: FallbackChains;
};
export function AssetRow({ settings, entry, chains }: AssetRowProps) {
    const session = useEditorSession();
    const candidates = session.library.byKind(entry.kind);
    return (<tr className={cn(ROW_CLASS, 'hover:bg-highlight')}>
      <th scope="row" className={CELL_CLASS}>
        <EntryKeyField entryKey={entry.key} onRename={(name) => renameLocalizedAssetEntry(session, entry.key, name)}/>
      </th>
      <td className={CELL_CLASS}>
        <SelectField label={`Tipo de ${entry.key}`} options={ASSET_KIND_OPTIONS} value={entry.kind} onChange={(kind) => setLocalizedAssetEntryKind(session, entry.key, kind)}/>
      </td>
      {settings.locales.map(({ tag }) => (<td key={tag} className={CELL_CLASS}>
          <LocalizedAssetField entry={entry} locale={tag} chain={chains.get(tag) ?? NO_CHAIN} candidates={candidates}/>
        </td>))}
      <td className="px-0.5">
        <IconButton label={`Excluir ${entry.key}`} size="xs" className={ROW_ACTION_CLASS} onClick={() => removeLocalizedAssetEntry(session, entry.key)}>
          <Trash2 />
        </IconButton>
      </td>
    </tr>);
}
