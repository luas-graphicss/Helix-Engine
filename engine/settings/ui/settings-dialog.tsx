'use client';
import { useEffect, useMemo, useState } from 'react';
import { SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { plural } from '@/engine/core/format/format-time';
import { EditorDialogShell } from '@/engine/editor/dialogs/editor-dialog-shell';
import { SearchField } from '@/engine/ui/search-field';
import { EMPTY_NOTE_CLASS, WELL_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
import { ENGINE_SETTING_SECTIONS, type SettingGroup, type SettingId, type SettingSection } from '../engine-settings-schema';
import { customizedCountInSection, engineSettings, useEngineSettingsVersion } from '../engine-settings-store';
import { SettingPanel } from './setting-panels';
import { SettingRow } from './setting-row';
import { SettingsNav } from './settings-nav';
import { consumeRequestedSettingsSection } from './settings-navigation';
import { searchSettings, type SettingSearchMatch } from './settings-search';
interface SettingsDialogProps {
    open: boolean;
    onOpenChange(open: boolean): void;
}
function SettingList({ ids }: {
    ids: readonly SettingId[];
}) {
    return (<ul className={cn('divide-y divide-border rounded-sm', WELL_CLASS)}>
      {ids.map((id) => (<SettingRow key={id} id={id}/>))}
    </ul>);
}
function GroupView({ group, ids = group.settings, breadcrumb }: {
    group: SettingGroup;
    ids?: readonly SettingId[];
    breadcrumb?: string;
}) {
    return (<section className="flex flex-col gap-2">
      <header className="flex flex-col gap-0.5">
        {breadcrumb && <span className="font-mono text-3xs tracking-wider text-muted-foreground uppercase">{breadcrumb}</span>}
        <h3 className="text-2xs font-semibold tracking-[0.08em] text-foreground/90 uppercase">{group.title}</h3>
        {group.description && <p className="text-2xs leading-relaxed text-muted-foreground text-pretty">{group.description}</p>}
      </header>
      {group.panel && <SettingPanel id={group.panel}/>}
      {ids.length > 0 && <SettingList ids={ids}/>}
    </section>);
}
function SectionView({ section }: {
    section: SettingSection;
}) {
    return (<div className="flex flex-col gap-6 px-6 py-5">
      <header className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-foreground">{section.title}</h2>
        <p className="text-2xs leading-relaxed text-muted-foreground text-pretty">{section.description}</p>
      </header>
      {section.groups.map((group) => (<GroupView key={group.title} group={group}/>))}
    </div>);
}
function SearchResults({ query, matches }: {
    query: string;
    matches: readonly SettingSearchMatch[];
}) {
    const total = matches.reduce((sum, match) => sum + match.ids.length + (match.panel ? 1 : 0), 0);
    return (<div className="flex flex-col gap-6 px-6 py-5">
      <header className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-foreground">Resultados</h2>
        <p className="text-2xs text-muted-foreground">
          {total === 0 ? (<>Nenhuma preferência corresponde a &ldquo;{query}&rdquo;.</>) : (<>
              {plural(total, 'preferência encontrada', 'preferências encontradas')} para &ldquo;{query}&rdquo;.
            </>)}
        </p>
      </header>
      {total === 0 ? (<div className={cn('flex flex-col items-center gap-2 px-6 py-10 text-center', EMPTY_NOTE_CLASS)}>
          <SearchX className="size-5" aria-hidden/>
          <p className="max-w-72 text-2xs leading-relaxed text-pretty">Tente outra palavra: o nome do controle, o que ele faz ou a seção em que ele fica (câmera, sombras, console, física…).</p>
        </div>) : (matches.map((match) => <GroupView key={`${match.section.id}/${match.group.title}`} group={match.panel ? match.group : { ...match.group, panel: undefined }} ids={match.ids} breadcrumb={match.section.title}/>))}
    </div>);
}
export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
    useEngineSettingsVersion();
    const [sectionId, setSectionId] = useState(ENGINE_SETTING_SECTIONS[0].id);
    const [query, setQuery] = useState('');
    const searching = query.trim().length > 0;
    const matches = useMemo(() => searchSettings(query), [query]);
    const section = ENGINE_SETTING_SECTIONS.find((candidate) => candidate.id === sectionId) ?? ENGINE_SETTING_SECTIONS[0];
    const customized = engineSettings.customizedCount;
    const sectionCustomized = customizedCountInSection(section.id);
    useEffect(() => {
        if (!open)
            return;
        setQuery('');
        const requested = consumeRequestedSettingsSection();
        if (requested && ENGINE_SETTING_SECTIONS.some((candidate) => candidate.id === requested))
            setSectionId(requested);
    }, [open]);
    return (<EditorDialogShell open={open} onOpenChange={onOpenChange} title="Configuração da Helix Engine" description="Preferências do editor e dos seus jogos. Valem na hora e ficam guardadas neste navegador; o ponto âmbar marca o que você mudou." action="helix.settings" size="xl" body="fill" toolbar={<SearchField placeholder="Buscar preferência (câmera, sombras, atalhos nos menus…)" value={query} onChange={setQuery} className="max-w-md"/>} footer={<>
          <span className="font-mono text-3xs text-muted-foreground">{customized === 0 ? 'Tudo no padrão.' : plural(customized, 'preferência alterada', 'preferências alteradas')}</span>
          <div className="ml-auto flex items-center gap-2">
            <Button size="xs" variant="outline" disabled={searching || sectionCustomized === 0} onClick={() => engineSettings.resetSection(section.id)}>
              Restaurar {section.title}
            </Button>
            <Button size="xs" variant="outline" disabled={customized === 0} onClick={() => engineSettings.resetAll()}>
              Restaurar tudo
            </Button>
          </div>
        </>}>
      <SettingsNav activeId={section.id} muted={searching} onSelect={(id) => {
            setSectionId(id);
            setQuery('');
        }}/>
      <div className="min-h-0 flex-1 overflow-y-auto">{searching ? <SearchResults query={query.trim()} matches={matches}/> : <SectionView section={section}/>}</div>
    </EditorDialogShell>);
}
