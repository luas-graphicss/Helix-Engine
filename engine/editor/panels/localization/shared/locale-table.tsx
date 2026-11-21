import type { ReactNode } from 'react';
import { localeDisplayName } from '@/engine/localization/locale/locale-names';
import type { LocaleEntry, LocalizationSettings } from '@/engine/localization/settings/localization-settings';
import { cn } from '@/lib/utils';
export const ROW_CLASS = 'group border-b border-border/60';
export const CELL_CLASS = 'px-1 py-0.5 font-normal';
export const ROW_ACTION_CLASS = 'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 hover:text-destructive';
const HEADER_CLASS = 'px-2 py-1 text-left font-semibold whitespace-nowrap';
const PLAIN_CASE_CLASS = 'tracking-normal normal-case';
type LocaleHeaderProps = {
    locale: LocaleEntry;
    isSource: boolean;
};
type LocaleTableProps = {
    label: string;
    settings: LocalizationSettings;
    extraColumn?: string;
    children: ReactNode;
};
function describeLocale({ tag, enabled }: LocaleEntry, isSource: boolean): string {
    const parts = [localeDisplayName(tag)];
    if (isSource)
        parts.push('idioma de origem');
    if (!enabled)
        parts.push('fora do jogo');
    return parts.join(' · ');
}
function LocaleHeader({ locale, isSource }: LocaleHeaderProps) {
    return (<th scope="col" title={describeLocale(locale, isSource)} className={cn(HEADER_CLASS, 'min-w-44', !locale.enabled && 'text-muted-foreground')}>
      <span className={PLAIN_CASE_CLASS}>{localeDisplayName(locale.tag)}</span>
      <span className={cn(PLAIN_CASE_CLASS, 'ml-1.5 font-mono font-normal text-muted-foreground')}>{locale.tag}</span>
      {isSource && <span className="ml-1.5 text-primary">origem</span>}
      {!locale.enabled && <span className="ml-1.5">inativo</span>}
    </th>);
}
export function LocaleTable({ label, settings, extraColumn, children }: LocaleTableProps) {
    return (<table aria-label={label} className="w-full border-collapse text-2xs">
      <thead className="sticky top-0 z-10 border-b border-border bg-surface-raised text-3xs tracking-[0.08em] text-foreground/90 uppercase">
        <tr>
          <th scope="col" className={cn(HEADER_CLASS, 'min-w-48')}>Chave</th>
          {extraColumn && (<th scope="col" className={cn(HEADER_CLASS, 'w-28 min-w-28')}>
              {extraColumn}
            </th>)}
          {settings.locales.map((locale) => (<LocaleHeader key={locale.tag} locale={locale} isSource={locale.tag === settings.sourceLocale}/>))}
          <th scope="col" className="w-7">
            <span className="sr-only">Ações</span>
          </th>
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>);
}
