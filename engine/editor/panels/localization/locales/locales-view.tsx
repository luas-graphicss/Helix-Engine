import type { LocalizationSettings } from '@/engine/localization/settings/localization-settings';
import { LocaleList } from './locale-list';
import { ProjectLocalesSection } from './project-locales-section';
type LocalesViewProps = {
    settings: LocalizationSettings;
};
export function LocalesView({ settings }: LocalesViewProps) {
    return (<div className="grid h-full auto-rows-min grid-cols-1 overflow-auto @3xl/panel:grid-cols-[18rem_minmax(0,1fr)] @3xl/panel:auto-rows-fr">
      <div className="min-w-0 border-b border-border @3xl/panel:border-r @3xl/panel:border-b-0">
        <ProjectLocalesSection settings={settings}/>
      </div>
      <div className="min-w-0 overflow-auto">
        <LocaleList settings={settings}/>
      </div>
    </div>);
}
