'use client';
import { useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { defaultSample, previewTranslation, sampleArguments } from '@/engine/editor/localization/translation-preview';
import { localeDisplayName } from '@/engine/localization/locale/locale-names';
import { localeDirection } from '@/engine/localization/locale/locale-tag';
import type { ArgumentKind, MessageArgument } from '@/engine/localization/message/message-arguments';
import type { MessageArguments } from '@/engine/localization/message/message-formatter';
import type { LocalizationSettings, StringEntry } from '@/engine/localization/settings/localization-settings';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { FieldInput } from '@/engine/ui/field-input';
import { PropertyRow } from '@/engine/ui/property-row';
import { SelectField } from '@/engine/ui/select-field';
import { cn } from '@/lib/utils';
import { ARGUMENT_KIND_LABEL } from '../localization-labels';
const PREVIEW_HINT = 'Como o texto sai em cada idioma com os valores de teste';
const NUMERIC_KINDS: ReadonlySet<ArgumentKind> = new Set<ArgumentKind>(['number', 'plural']);
type SampleFieldProps = {
    argument: MessageArgument;
    value: string;
    onChange: (value: string) => void;
};
type PreviewRowProps = {
    settings: LocalizationSettings;
    entry: StringEntry;
    locale: string;
    values: MessageArguments;
};
type TranslationPreviewSectionProps = {
    settings: LocalizationSettings;
    entry: StringEntry;
    args: readonly MessageArgument[];
};
function SampleField({ argument, value, onChange }: SampleFieldProps) {
    const label = `Valor de teste de ${argument.name}`;
    if (argument.kind === 'select')
        return <SelectField label={label} options={argument.choices.map((choice) => ({ value: choice, label: choice }))} value={value} onChange={onChange}/>;
    return <FieldInput value={value} aria-label={label} inputMode={NUMERIC_KINDS.has(argument.kind) ? 'decimal' : 'text'} onChange={(event) => onChange(event.currentTarget.value)}/>;
}
function PreviewRow({ settings, entry, locale, values }: PreviewRowProps) {
    const preview = previewTranslation(settings, entry, locale, values);
    const shownLocale = preview.shownLocale ?? locale;
    return (<PropertyRow label={locale} hint={localeDisplayName(locale)}>
      <span lang={shownLocale} dir={localeDirection(shownLocale)} className={cn('min-w-0 flex-1 py-0.5 text-2xs text-pretty break-words', preview.text === null ? 'text-muted-foreground' : 'text-foreground')}>
        {preview.text ?? 'sem texto'}
      </span>
      {preview.shownLocale !== null && preview.shownLocale !== locale && (<span className="shrink-0 font-mono text-3xs text-muted-foreground" title={`Sem tradução em ${locale}: o jogo usa o texto de ${preview.shownLocale}.`}>
          ↳ {preview.shownLocale}
        </span>)}
      {preview.problem !== null && (<span className="flex shrink-0 text-warning" title={preview.problem}>
          <TriangleAlert className="size-3" aria-hidden/>
          <span className="sr-only">{preview.problem}</span>
        </span>)}
    </PropertyRow>);
}
export function TranslationPreviewSection({ settings, entry, args }: TranslationPreviewSectionProps) {
    const [typed, setTyped] = useState<Record<string, string>>({});
    const values = sampleArguments(args, typed);
    return (<CollapsibleSection title="Prévia" hint={PREVIEW_HINT}>
      {args.map((argument) => (<PropertyRow key={argument.name} label={argument.name} hint={ARGUMENT_KIND_LABEL[argument.kind]}>
          <SampleField argument={argument} value={typed[argument.name] ?? defaultSample(argument)} onChange={(value) => setTyped((current) => ({ ...current, [argument.name]: value }))}/>
        </PropertyRow>))}
      {settings.locales.map(({ tag }) => (<PreviewRow key={tag} settings={settings} entry={entry} locale={tag} values={values}/>))}
    </CollapsibleSection>);
}
