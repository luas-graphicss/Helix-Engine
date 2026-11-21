'use client';
import { useState } from 'react';
import { entryKeyProblem } from '@/engine/editor/localization/entry-key-problem';
import { useFallbackChains } from '@/engine/editor/localization/use-fallback-chains';
import { addLocalizedAssetEntry } from '@/engine/editor/operations/localization/localized-asset-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { DEFAULT_LOCALIZED_ASSET_KIND, type LocalizationSettings, type LocalizedAssetKind } from '@/engine/localization/settings/localization-settings';
import { PanelToolbar } from '@/engine/ui/panel-toolbar';
import { SelectField } from '@/engine/ui/select-field';
import { ASSET_KIND_OPTIONS } from '../localization-labels';
import { AddField } from '../shared/add-field';
import { LocaleTable } from '../shared/locale-table';
import { PaneNote } from '../shared/pane';
import { AssetRow } from './asset-row';
const EMPTY_NOTE = 'Nenhum ativo muda com o idioma ainda. Crie uma chave, como ui.logo, e escolha a textura, o áudio ou a fonte de cada idioma. No script, helix.localization.asset devolve o ativo do idioma do jogador.';
type AssetsViewProps = {
    settings: LocalizationSettings;
};
export function AssetsView({ settings }: AssetsViewProps) {
    const session = useEditorSession();
    const chains = useFallbackChains(settings);
    const [kind, setKind] = useState<LocalizedAssetKind>(DEFAULT_LOCALIZED_ASSET_KIND);
    return (<div className="flex h-full min-h-0 flex-col">
      <PanelToolbar>
        <span className="flex w-28 shrink-0">
          <SelectField label="Tipo do novo ativo por idioma" options={ASSET_KIND_OPTIONS} value={kind} onChange={setKind}/>
        </span>
        <span className="flex min-w-0 max-w-md flex-1">
          <AddField label="Adicionar ativo por idioma" placeholder="Nova chave, como ui.logo" validate={(name) => entryKeyProblem(settings.assets, name)} onAdd={(name) => {
            addLocalizedAssetEntry(session, name, kind);
        }}/>
        </span>
      </PanelToolbar>
      <div className="min-h-0 flex-1 overflow-auto">
        {settings.assets.length === 0 ? (<PaneNote>{EMPTY_NOTE}</PaneNote>) : (<LocaleTable label="Ativos por idioma" settings={settings} extraColumn="Tipo">
            {settings.assets.map((entry) => (<AssetRow key={entry.key} settings={settings} entry={entry} chains={chains}/>))}
          </LocaleTable>)}
      </div>
    </div>);
}
