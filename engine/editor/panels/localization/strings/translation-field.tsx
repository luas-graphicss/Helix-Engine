'use client';
import { translateLocalizedString } from '@/engine/editor/operations/localization/string-operations';
import { blurOnEnter } from '@/engine/editor/panels/input/shared/blur-on-enter';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import type { TranslationIssue } from '@/engine/localization/analysis/translation-issues';
import { pickLocalizedValue } from '@/engine/localization/fallback/fallback-chain';
import { localeDisplayName } from '@/engine/localization/locale/locale-names';
import { localeDirection } from '@/engine/localization/locale/locale-tag';
import type { StringEntry } from '@/engine/localization/settings/localization-settings';
import { FieldInput } from '@/engine/ui/field-input';
import { cn } from '@/lib/utils';
type TranslationFieldProps = {
    entry: StringEntry;
    locale: string;
    chain: readonly string[];
    problems: readonly TranslationIssue[];
};
function borderClass(problems: readonly TranslationIssue[]): string | false {
    if (problems.some((issue) => issue.kind === 'syntax'))
        return 'border-destructive/70';
    return problems.length > 0 && 'border-warning/70';
}
export function TranslationField({ entry, locale, chain, problems }: TranslationFieldProps) {
    const session = useEditorSession();
    const text = entry.values[locale] ?? '';
    const inherited = text === '' ? pickLocalizedValue(entry.values, chain) : null;
    const blocking = problems.filter((issue) => issue.kind !== 'missing');
    const inheritedHint = inherited ? `Sem tradução: o jogo usa o texto de ${inherited.locale}.` : undefined;
    const hint = blocking.length > 0 ? blocking.map((issue) => issue.detail).join(' · ') : inheritedHint;
    return (<FieldInput key={text} defaultValue={text} lang={locale} dir={localeDirection(locale)} spellCheck={false} placeholder={inherited ? `↳ ${inherited.value}` : ''} title={hint} aria-label={`${entry.key} em ${localeDisplayName(locale)}`} aria-invalid={blocking.length > 0 || undefined} className={cn(borderClass(blocking))} onKeyDown={blurOnEnter} onBlur={(event) => {
            translateLocalizedString(session, entry.key, locale, event.currentTarget.value);
        }}/>);
}
