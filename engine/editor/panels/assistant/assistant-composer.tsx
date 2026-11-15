'use client';
import { useId, useState, type KeyboardEvent } from 'react';
import { ArrowUp, Square } from 'lucide-react';
import { IconButton } from '@/engine/ui/icon-button';
import { WELL_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
const IME_COMPOSITION_KEY_CODE = 229;
type AssistantComposerProps = {
    busy: boolean;
    hint: string;
    onSend: (text: string) => void;
    onStop: () => void;
};
export function AssistantComposer({ busy, hint, onSend, onStop }: AssistantComposerProps) {
    const [draft, setDraft] = useState('');
    const fieldId = useId();
    const canSend = !busy && draft.trim() !== '';
    const send = () => {
        if (!canSend)
            return;
        onSend(draft);
        setDraft('');
    };
    const sendOnEnter = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing || event.keyCode === IME_COMPOSITION_KEY_CODE)
            return;
        event.preventDefault();
        send();
    };
    return (<form className="flex shrink-0 flex-col gap-1 border-t border-border p-2" onSubmit={(event) => {
            event.preventDefault();
            send();
        }}>
      <div className={cn('flex items-end gap-1 rounded-sm p-1 transition-colors duration-100 focus-within:border-primary/80', WELL_CLASS)}>
        <label htmlFor={fieldId} className="sr-only">
          Mensagem para o assistente
        </label>
        <textarea id={fieldId} rows={2} value={draft} placeholder="Peça uma mudança ou faça uma pergunta" onChange={(event) => setDraft(event.currentTarget.value)} onKeyDown={sendOnEnter} className="field-sizing-content max-h-40 min-h-9 min-w-0 flex-1 resize-none bg-transparent px-1 py-0.5 text-xs leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/60"/>
        {busy ? (<IconButton label="Parar resposta" onClick={onStop}>
            <Square />
          </IconButton>) : (<IconButton type="submit" label="Enviar mensagem" disabled={!canSend} className="text-primary">
            <ArrowUp />
          </IconButton>)}
      </div>
      <p className="text-3xs text-pretty text-muted-foreground">{hint}</p>
    </form>);
}
