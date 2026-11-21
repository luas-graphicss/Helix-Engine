'use client';
import { localeCodeProblem } from '@/engine/editor/localization/locale-code-problem';
import { addGameLocale, setGameSourceLocale, setGameStartupLocale } from '@/engine/editor/operations/localization/locale-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { COMMON_LOCALE_TAGS } from '@/engine/localization/locale/locale-catalog';
import { findLocale, type LocalizationSettings } from '@/engine/localization/settings/localization-settings';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { PropertyRow } from '@/engine/ui/property-row';
import { SelectField } from '@/engine/ui/select-field';
import { localeLabel } from '../localization-labels';
import { AddField } from '../shared/add-field';
const DEVICE_LOCALE = '';
const NO_CHOICE = '';
const SOURCE_HINT = 'Idioma em que os textos são escritos primeiro. É a referência dos argumentos e o último fallback de todos os idiomas.';
const STARTUP_HINT = 'Com "Idioma do aparelho", o jogo abre no idioma ativo mais próximo do sistema do jogador e, sem nenhum parecido, no de origem.';
const CODE_HINT = 'Código BCP 47 de um idioma fora da lista, como es-AR ou zh-Hant';
type ProjectLocalesSectionProps = {
    settings: LocalizationSettings;
};
export function ProjectLocalesSection({ settings }: ProjectLocalesSectionProps) {
    const session = useEditorSession();
    const projectOptions = settings.locales.map(({ tag }) => ({ value: tag, label: localeLabel(tag) }));
    const startupOptions = [{ value: DEVICE_LOCALE, label: 'Idioma do aparelho' }, ...settings.locales.filter((locale) => locale.enabled).map(({ tag }) => ({ value: tag, label: localeLabel(tag) }))];
    const catalogOptions = [{ value: NO_CHOICE, label: 'Escolher idioma…' }, ...COMMON_LOCALE_TAGS.filter((tag) => !findLocale(settings, tag)).map((tag) => ({ value: tag, label: localeLabel(tag) }))];
    return (<>
      <CollapsibleSection title="Jogo">
        <PropertyRow label="Origem" hint={SOURCE_HINT}>
          <SelectField label="Idioma de origem" options={projectOptions} value={settings.sourceLocale} onChange={(tag) => setGameSourceLocale(session, tag)}/>
        </PropertyRow>
        <PropertyRow label="Ao abrir" hint={STARTUP_HINT}>
          <SelectField label="Idioma em que o jogo abre" options={startupOptions} value={settings.startupLocale ?? DEVICE_LOCALE} onChange={(tag) => setGameStartupLocale(session, tag === DEVICE_LOCALE ? null : tag)}/>
        </PropertyRow>
      </CollapsibleSection>
      <CollapsibleSection title="Adicionar idioma">
        <PropertyRow label="Da lista">
          <SelectField label="Adicionar idioma da lista" options={catalogOptions} value={NO_CHOICE} onChange={(tag) => {
            if (tag !== NO_CHOICE)
                addGameLocale(session, tag);
        }}/>
        </PropertyRow>
        <PropertyRow label="Por código" hint={CODE_HINT}>
          <AddField stacked label="Adicionar idioma pelo código" placeholder="es-AR" validate={(code) => localeCodeProblem(settings, code)} onAdd={(code) => {
            addGameLocale(session, code);
        }}/>
        </PropertyRow>
      </CollapsibleSection>
    </>);
}
