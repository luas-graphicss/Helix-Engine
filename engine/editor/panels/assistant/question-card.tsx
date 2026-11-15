'use client';
import { Check, MessageCircleQuestionMark } from 'lucide-react';
import type { QuestionAnswer, QuestionEntry } from '@/engine/editor/assistant/conversation/conversation-entry';
import { cn } from '@/lib/utils';
import { QuestionOptions } from './question-options';
type QuestionCardProps = {
    entry: QuestionEntry;
    onAnswer: (entryId: number, answer: QuestionAnswer) => void;
};
export function QuestionCard({ entry, onAnswer }: QuestionCardProps) {
    const { resolution } = entry;
    return (<section aria-label="Pergunta do assistente" className={cn('flex flex-col gap-1.5 rounded-sm border bg-surface-sunken/60 p-2', resolution.status === 'awaiting' ? 'border-primary/50' : 'border-border')}>
      <p className="flex items-start gap-1.5 text-xs leading-relaxed text-foreground">
        <MessageCircleQuestionMark aria-hidden className="mt-0.5 size-3.5 shrink-0 text-primary"/>
        <span className="min-w-0 break-words whitespace-pre-wrap">{entry.question}</span>
      </p>
      {resolution.status === 'awaiting' && <QuestionOptions entry={entry} onAnswer={onAnswer}/>}
      {resolution.status === 'answered' && (<p className="flex items-start gap-1.5 text-2xs text-muted-foreground">
          <Check aria-hidden className="mt-px size-3.5 shrink-0 text-success"/>
          <span className="min-w-0 break-words whitespace-pre-wrap">
            <span className="sr-only">Sua resposta: </span>
            {resolution.answer.text}
          </span>
        </p>)}
      {resolution.status === 'cancelled' && <p className="text-2xs text-muted-foreground">Sem resposta.</p>}
    </section>);
}
