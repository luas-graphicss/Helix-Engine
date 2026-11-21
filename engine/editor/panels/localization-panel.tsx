'use client';
import { useState } from 'react';
import { FileDown, FileUp } from 'lucide-react';
import { plural } from '@/engine/core/format/format-time';
import type { LocalizationIssues } from '@/engine/editor/localization/localization-issues';
import { useLocalizationIssues } from '@/engine/editor/localization/use-localization-issues';
import { exportLocalizedStrings, importLocalizedStrings } from '@/engine/editor/operations/localization/strings-exchange-operations';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { coveragePercent, projectCoverage } from '@/engine/localization/analysis/coverage';
import type { TranslationIssue } from '@/engine/localization/analysis/translation-issues';
import type { LocalizationSettings } from '@/engine/localization/settings/localization-settings';
import { IconButton } from '@/engine/ui/icon-button';
import { PanelSummaryFooter } from '@/engine/ui/panel-summary-footer';
import { PanelToolbar } from '@/engine/ui/panel-toolbar';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { ToolbarSeparator } from '@/engine/ui/toolbar-separator';
import { AssetsView } from './localization/assets/assets-view';
import { IssuesView } from './localization/issues/issues-view';
import { LocalesView } from './localization/locales/locales-view';
import { GameLocaleSelect } from './localization/shared/game-locale-select';
import { StringsView } from './localization/strings/strings-view';
const VIEWS = [
    { value: 'strings', label: 'Textos' },
    { value: 'assets', label: 'Ativos' },
    { value: 'locales', label: 'Idiomas' },
    { value: 'issues', label: 'Pendências' },
] as const;
type LocalizationView = (typeof VIEWS)[number]['value'];
type LocalizationViewBodyProps = {
    view: LocalizationView;
    settings: LocalizationSettings;
    issues: LocalizationIssues;
    focusKey: string | null;
    onFocus: (key: string | null) => void;
    onOpenIssue: (issue: TranslationIssue) => void;
};
function LocalizationViewBody({ view, settings, issues, focusKey, onFocus, onOpenIssue }: LocalizationViewBodyProps) {
    switch (view) {
        case 'strings':
            return <StringsView settings={settings} issues={issues} focusKey={focusKey} onFocus={onFocus}/>;
        case 'assets':
            return <AssetsView settings={settings}/>;
        case 'locales':
            return <LocalesView settings={settings}/>;
        case 'issues':
            return <IssuesView issues={issues} onOpen={onOpenIssue}/>;
    }
}
function summarize(settings: LocalizationSettings, issues: LocalizationIssues): Array<string | false> {
    return [
        plural(settings.strings.length, 'texto', 'textos'),
        settings.assets.length > 0 && plural(settings.assets.length, 'ativo por idioma', 'ativos por idioma'),
        plural(settings.locales.length, 'idioma', 'idiomas'),
        `${coveragePercent(projectCoverage(settings))}% traduzido`,
        issues.all.length > 0 ? plural(issues.all.length, 'pendência', 'pendências') : 'sem pendências',
    ];
}
export function LocalizationPanel() {
    const session = useSessionTopic('scene', 'playtest', 'assets');
    const [view, setView] = useState<LocalizationView>('strings');
    const [focusKey, setFocusKey] = useState<string | null>(null);
    const settings = session.scene.localization;
    const issues = useLocalizationIssues(session);
    const openIssue = (issue: TranslationIssue): void => {
        setView(issue.table);
        if (issue.table === 'strings')
            setFocusKey(issue.key);
    };
    return (<div className="flex h-full min-h-0 flex-col">
      <PanelToolbar>
        <span className="flex min-w-0 max-w-md flex-1">
          <SegmentedControl label="Seção da localização" options={VIEWS} value={view} onChange={setView}/>
        </span>
        <span className="ml-auto flex min-w-0 items-center">
          <GameLocaleSelect />
        </span>
        <ToolbarSeparator />
        <IconButton label="Importar textos de um CSV" size="sm" onClick={() => void importLocalizedStrings(session)}>
          <FileUp />
        </IconButton>
        <IconButton label="Exportar textos para CSV" size="sm" disabled={settings.strings.length === 0} onClick={() => exportLocalizedStrings(session)}>
          <FileDown />
        </IconButton>
      </PanelToolbar>
      <div className="min-h-0 flex-1">
        <LocalizationViewBody view={view} settings={settings} issues={issues} focusKey={focusKey} onFocus={setFocusKey} onOpenIssue={openIssue}/>
      </div>
      <PanelSummaryFooter parts={summarize(settings, issues)}/>
    </div>);
}
