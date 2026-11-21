'use client';
import { Star, Trash2 } from 'lucide-react';
import { removeGameLocale, setGameLocaleEnabled, setGameLocaleFallback } from '@/engine/editor/operations/localization/locale-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { coveragePercent, localeCoverage } from '@/engine/localization/analysis/coverage';
import { resolveFallbackChain } from '@/engine/localization/fallback/fallback-chain';
import { localeDisplayName, localeNativeName } from '@/engine/localization/locale/locale-names';
import type { LocaleEntry, LocalizationSettings } from '@/engine/localization/settings/localization-settings';
import { CheckBox } from '@/engine/ui/check-box';
import { IconButton } from '@/engine/ui/icon-button';
import { SelectField } from '@/engine/ui/select-field';
import { cn } from '@/lib/utils';
import { localeLabel } from '../localization-labels';
import { ROW_ACTION_CLASS, ROW_CLASS } from '../shared/locale-table';
const AUTOMATIC = '';
const HEADER_CLASS = 'px-2 py-1 text-left font-semibold whitespace-nowrap';
const CELL_CLASS = 'px-2 py-0.5';
const FALLBACK_HINT = 'Idioma usado quando falta uma tradução. No automático, a variante regional usa o idioma-pai e depois o de origem.';
type LocaleListProps = {
    settings: LocalizationSettings;
};
type LocaleRowProps = {
    settings: LocalizationSettings;
    locale: LocaleEntry;
};
function automaticLabel(settings: LocalizationSettings, tag: string): string {
    const locales = settings.locales.map((locale) => (locale.tag === tag ? { ...locale, fallback: null } : locale));
    const chain = resolveFallbackChain({ ...settings, locales }, tag).slice(1);
    return chain.length > 0 ? `Automático: ${chain.join(' → ')}` : 'Automático';
}
function LocaleRow({ settings, locale }: LocaleRowProps) {
    const session = useEditorSession();
    const { tag } = locale;
    const name = localeDisplayName(tag);
    const isSource = tag === settings.sourceLocale;
    const coverage = localeCoverage(settings, tag);
    const fallbackOptions = [{ value: AUTOMATIC, label: automaticLabel(settings, tag) }, ...settings.locales.filter((other) => other.tag !== tag).map((other) => ({ value: other.tag, label: localeLabel(other.tag) }))];
    return (<tr className={cn(ROW_CLASS, 'hover:bg-highlight')}>
      <td className={cn(CELL_CLASS, 'w-8')}>
        {isSource ? (<span className="flex text-primary" title="Idioma de origem: sempre faz parte do jogo">
            <Star className="size-3.5" aria-hidden/>
            <span className="sr-only">Idioma de origem</span>
          </span>) : (<CheckBox checked={locale.enabled} label={`Usar ${name} no jogo`} onChange={(enabled) => setGameLocaleEnabled(session, tag, enabled)}/>)}
      </td>
      <th scope="row" className={cn(CELL_CLASS, 'text-left font-normal', !locale.enabled && 'text-muted-foreground')}>
        <span className="text-foreground">{name}</span>
        <span lang={tag} className="ml-1.5 text-muted-foreground">{localeNativeName(tag)}</span>
      </th>
      <td className={cn(CELL_CLASS, 'font-mono text-foreground/80')}>{tag}</td>
      <td className="px-1 py-0.5">
        {isSource ? (<span className="px-1 text-muted-foreground">último fallback de todos</span>) : (<SelectField label={`Fallback de ${name}`} options={fallbackOptions} value={locale.fallback ?? AUTOMATIC} onChange={(value) => setGameLocaleFallback(session, tag, value === AUTOMATIC ? null : value)}/>)}
      </td>
      <td className={cn(CELL_CLASS, 'text-right font-mono whitespace-nowrap tabular-nums text-foreground/80')}>
        {coveragePercent(coverage)}%
        <span className="ml-1.5 text-muted-foreground">
          {coverage.translated}/{coverage.total}
        </span>
      </td>
      <td className="px-0.5">
        <IconButton label={`Remover ${name} e as traduções dele`} size="xs" disabled={isSource} className={ROW_ACTION_CLASS} onClick={() => removeGameLocale(session, tag)}>
          <Trash2 />
        </IconButton>
      </td>
    </tr>);
}
export function LocaleList({ settings }: LocaleListProps) {
    return (<table aria-label="Idiomas do jogo" className="w-full border-collapse text-2xs">
      <thead className="sticky top-0 z-10 border-b border-border bg-surface-raised text-3xs tracking-[0.08em] text-foreground/90 uppercase">
        <tr>
          <th scope="col" className={cn(HEADER_CLASS, 'w-8')}>
            <span className="sr-only">No jogo</span>
          </th>
          <th scope="col" className={HEADER_CLASS}>Idioma</th>
          <th scope="col" className={cn(HEADER_CLASS, 'w-24')}>Código</th>
          <th scope="col" title={FALLBACK_HINT} className={cn(HEADER_CLASS, 'min-w-48')}>Fallback</th>
          <th scope="col" className={cn(HEADER_CLASS, 'w-28 text-right')}>Traduzido</th>
          <th scope="col" className="w-7">
            <span className="sr-only">Ações</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {settings.locales.map((locale) => (<LocaleRow key={locale.tag} settings={settings} locale={locale}/>))}
      </tbody>
    </table>);
}
