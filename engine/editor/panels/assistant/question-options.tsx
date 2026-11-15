'use client';
import { useId, useState, type FormEvent, type KeyboardEvent } from 'react';
import { CornerDownLeft } from 'lucide-react';
import type { QuestionAnswer, QuestionEntry } from '@/engine/editor/assistant/conversation/conversation-entry';
import { ActionButton } from '@/engine/ui/action-button';
import { GHOST_ACTION_CLASS, TEXT_INPUT_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
const ANSWER_MAX_LENGTH = 2000;
const IME_COMPOSITION_KEY_CODE = 229;
const OPTION_CLASS = cn(GHOST_ACTION_CLASS, 'flex w-full min-w-0 flex-col gap-0.5 px-2 py-1.5 text-left');
type QuestionOptionsProps = {
    entry: QuestionEntry;
    onAnswer: (entryId: number, answer: QuestionAnswer) => void;
};
export function QuestionOptions({ entry, onAnswer }: QuestionOptionsProps) {
    const [customOpen, setCustomOpen] = useState(false);
    const [customAnswer, setCustomAnswer] = useState('');
    const fieldId = useId();
    const submitCustomAnswer = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (customAnswer.trim())
            onAnswer(entry.id, { text: customAnswer, custom: true });
    };
    const keepComposing = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === IME_COMPOSITION_KEY_CODE))
            event.preventDefault();
    };
    return (<div className="flex flex-col gap-1">
      <ul className="flex flex-col gap-1">
        {entry.options.map((option, index) => (<li key={`${index}-${option.label}`}>
            <button type="button" className={OPTION_CLASS} onClick={() => onAnswer(entry.id, { text: option.label, custom: false })}>
              <span className="text-2xs font-medium break-words text-foreground">{option.label}</span>
              {option.description && <span className="text-3xs break-words text-muted-foreground">{option.description}</span>}
            </button>
          </li>))}
        <li>
          <button type="button" aria-expanded={customOpen} className={OPTION_CLASS} onClick={() => setCustomOpen((open) => !open)}>
            <span className="text-2xs font-medium text-foreground">Outro</span>
            <span className="text-3xs text-muted-foreground">Escreva a sua resposta</span>
          </button>
        </li>
      </ul>
      {customOpen && (<form className="flex items-center gap-1" onSubmit={submitCustomAnswer}>
          <label htmlFor={fieldId} className="sr-only">
            Sua resposta
          </label>
          <input id={fieldId} autoFocus value={customAnswer} maxLength={ANSWER_MAX_LENGTH} placeholder="Sua resposta" autoComplete="off" onChange={(event) => setCustomAnswer(event.currentTarget.value)} onKeyDown={keepComposing} className={cn(TEXT_INPUT_CLASS, 'h-6 px-2 text-2xs')}/>
          <ActionButton type="submit" variant="primary" icon={CornerDownLeft} disabled={!customAnswer.trim()} className="flex-none">
            Responder
          </ActionButton>
        </form>)}
    </div>);
}
