'use client';
import { Trash2 } from 'lucide-react';
import { issueCellId, type LocalizationIssues } from '@/engine/editor/localization/localization-issues';
import type { FallbackChains } from '@/engine/editor/localization/use-fallback-chains';
import { removeLocalizedString, renameLocalizedString } from '@/engine/editor/operations/localization/string-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import type { TranslationIssue } from '@/engine/localization/analysis/translation-issues';
import type { LocalizationSettings, StringEntry } from '@/engine/localization/settings/localization-settings';
import { IconButton } from '@/engine/ui/icon-button';
import { cn } from '@/lib/utils';
import { EntryKeyField } from '../shared/entry-key-field';
import { CELL_CLASS, ROW_ACTION_CLASS, ROW_CLASS } from '../shared/locale-table';
import { TranslationField } from './translation-field';
const NO_ISSUES: readonly TranslationIssue[] = [];
const NO_CHAIN: readonly string[] = [];
type StringRowProps = {
    settings: LocalizationSettings;
    entry: StringEntry;
    chains: FallbackChains;
    issues: LocalizationIssues;
    focused: boolean;
    onFocus: (key: string) => void;
};
export function StringRow({ settings, entry, chains, issues, focused, onFocus }: StringRowProps) {
    const session = useEditorSession();
    return (<tr onFocus={() => onFocus(entry.key)} className={cn(ROW_CLASS, focused ? 'bg-primary/10' : 'hover:bg-highlight')}>
      <th scope="row" className={CELL_CLASS}>
        <EntryKeyField entryKey={entry.key} onRename={(name) => renameLocalizedString(session, entry.key, name)} onRenamed={onFocus}/>
      </th>
      {settings.locales.map(({ tag }) => (<td key={tag} className={CELL_CLASS}>
          <TranslationField entry={entry} locale={tag} chain={chains.get(tag) ?? NO_CHAIN} problems={issues.byCell.get(issueCellId('strings', entry.key, tag)) ?? NO_ISSUES}/>
        </td>))}
      <td className="px-0.5">
        <IconButton label={`Excluir ${entry.key}`} size="xs" className={ROW_ACTION_CLASS} onClick={() => removeLocalizedString(session, entry.key)}>
          <Trash2 />
        </IconButton>
      </td>
    </tr>);
}
