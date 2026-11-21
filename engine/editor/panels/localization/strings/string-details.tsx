'use client';
import { Trash2 } from 'lucide-react';
import { translationCall } from '@/engine/editor/localization/script-call';
import { previewArguments } from '@/engine/editor/localization/translation-preview';
import { removeLocalizedString, setLocalizedStringNote } from '@/engine/editor/operations/localization/string-operations';
import { blurOnEnter } from '@/engine/editor/panels/input/shared/blur-on-enter';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import type { TranslationIssue } from '@/engine/localization/analysis/translation-issues';
import type { LocalizationSettings, StringEntry } from '@/engine/localization/settings/localization-settings';
import { ActionButton, ActionRow } from '@/engine/ui/action-button';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { FieldInput } from '@/engine/ui/field-input';
import { PropertyRow } from '@/engine/ui/property-row';
import { ISSUE_KIND_LABEL } from '../localization-labels';
import { TranslationPreviewSection } from './translation-preview-section';
const NOTE_HINT = 'Contexto para quem traduz: onde o texto aparece, o tom e o limite de tamanho. Vai junto no CSV.';
const CALL_HINT = 'Chamada que devolve este texto no idioma do jogador';
type StringDetailsProps = {
    settings: LocalizationSettings;
    entry: StringEntry;
    problems: readonly TranslationIssue[];
};
export function StringDetails({ settings, entry, problems }: StringDetailsProps) {
    const session = useEditorSession();
    const args = previewArguments(settings, entry);
    return (<>
      <CollapsibleSection title="Texto">
        <PropertyRow label="Nota" hint={NOTE_HINT}>
          <FieldInput key={entry.note} defaultValue={entry.note} placeholder="Contexto para a tradução" aria-label={`Nota de ${entry.key}`} onKeyDown={blurOnEnter} onBlur={(event) => {
            setLocalizedStringNote(session, entry.key, event.currentTarget.value);
        }}/>
        </PropertyRow>
        <PropertyRow label="No script" hint={CALL_HINT}>
          <FieldInput readOnly value={translationCall(entry.key, args)} aria-label="Chamada do texto nos scripts" onFocus={(event) => event.currentTarget.select()}/>
        </PropertyRow>
      </CollapsibleSection>
      <TranslationPreviewSection settings={settings} entry={entry} args={args}/>
      {problems.length > 0 && (<CollapsibleSection title="Pendências">
          <ul className="flex flex-col gap-0.5 px-2 text-2xs text-muted-foreground">
            {problems.map((issue, index) => (<li key={index} className="text-pretty">
                <span className="font-mono text-foreground/80">{issue.locale}</span> · {ISSUE_KIND_LABEL[issue.kind]}: {issue.detail}
              </li>))}
          </ul>
        </CollapsibleSection>)}
      <ActionRow>
        <ActionButton icon={Trash2} variant="danger" onClick={() => removeLocalizedString(session, entry.key)}>
          Excluir texto
        </ActionButton>
      </ActionRow>
    </>);
}
