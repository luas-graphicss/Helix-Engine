'use client';
import { useState } from 'react';
import { ListFilter } from 'lucide-react';
import { entryKeyProblem } from '@/engine/editor/localization/entry-key-problem';
import type { LocalizationIssues } from '@/engine/editor/localization/localization-issues';
import { useFallbackChains } from '@/engine/editor/localization/use-fallback-chains';
import { addLocalizedString } from '@/engine/editor/operations/localization/string-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import type { LocalizationSettings, StringEntry } from '@/engine/localization/settings/localization-settings';
import { IconButton } from '@/engine/ui/icon-button';
import { PanelToolbar } from '@/engine/ui/panel-toolbar';
import { SearchField } from '@/engine/ui/search-field';
import { ToolbarSeparator } from '@/engine/ui/toolbar-separator';
import { AddField } from '../shared/add-field';
import { LocaleTable } from '../shared/locale-table';
import { Pane, PaneNote } from '../shared/pane';
import { StringDetails } from './string-details';
import { StringRow } from './string-row';
const MAX_VISIBLE_ROWS = 200;
const EMPTY_NOTE = 'Nenhum texto ainda. Crie uma chave, como menu.play, e escreva o texto em cada idioma. No script, helix.localization.t devolve o texto no idioma do jogador.';
const DETAILS_NOTE = 'Clique em um texto para ver a nota, os argumentos e a prévia em cada idioma.';
type StringsViewProps = {
    settings: LocalizationSettings;
    issues: LocalizationIssues;
    focusKey: string | null;
    onFocus: (key: string | null) => void;
};
function matches(entry: StringEntry, needle: string): boolean {
    return entry.key.toLowerCase().includes(needle) || entry.note.toLowerCase().includes(needle) || Object.values(entry.values).some((text) => text.toLowerCase().includes(needle));
}
export function StringsView({ settings, issues, focusKey, onFocus }: StringsViewProps) {
    const session = useEditorSession();
    const chains = useFallbackChains(settings);
    const [query, setQuery] = useState('');
    const [pendingOnly, setPendingOnly] = useState(false);
    const needle = query.trim().toLowerCase();
    const pending = issues.pendingKeys.strings;
    const found = settings.strings.filter((entry) => (needle === '' || matches(entry, needle)) && (!pendingOnly || pending.has(entry.key)));
    const shown = found.slice(0, MAX_VISIBLE_ROWS);
    const focused = settings.strings.find((entry) => entry.key === focusKey) ?? null;
    return (<div className="flex h-full min-h-0 flex-col @2xl/panel:flex-row">
      <section className="flex min-h-24 min-w-0 flex-1 flex-col border-b border-border @2xl/panel:border-r @2xl/panel:border-b-0">
        <PanelToolbar>
          <SearchField placeholder="Buscar chave ou texto" value={query} onChange={setQuery} className="max-w-56"/>
          <IconButton label="Mostrar só textos com pendências" size="sm" active={pendingOnly} onClick={() => setPendingOnly((value) => !value)}>
            <ListFilter />
          </IconButton>
          <ToolbarSeparator />
          <AddField label="Adicionar texto" placeholder="Nova chave, como menu.play" validate={(name) => entryKeyProblem(settings.strings, name)} onAdd={(name) => onFocus(addLocalizedString(session, name))}/>
        </PanelToolbar>
        <div className="min-h-0 flex-1 overflow-auto">
          {settings.strings.length === 0 && <PaneNote>{EMPTY_NOTE}</PaneNote>}
          {settings.strings.length > 0 && found.length === 0 && <PaneNote>Nenhum texto corresponde à busca.</PaneNote>}
          {found.length > 0 && (<LocaleTable label="Textos por idioma" settings={settings}>
              {shown.map((entry) => (<StringRow key={entry.key} settings={settings} entry={entry} chains={chains} issues={issues} focused={entry.key === focusKey} onFocus={onFocus}/>))}
            </LocaleTable>)}
          {found.length > shown.length && (<PaneNote>
              Mostrando {shown.length} de {found.length} textos. Refine a busca para ver os demais.
            </PaneNote>)}
        </div>
      </section>
      <Pane title="Texto selecionado" className="min-h-24 flex-1 @2xl/panel:w-80 @2xl/panel:flex-none">
        {focused ? (<StringDetails key={focused.key} settings={settings} entry={focused} problems={issues.all.filter((issue) => issue.table === 'strings' && issue.key === focused.key)}/>) : (<PaneNote>{DETAILS_NOTE}</PaneNote>)}
      </Pane>
    </div>);
}
