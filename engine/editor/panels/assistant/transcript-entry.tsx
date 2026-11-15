'use client';
import { CircleAlert, Info } from 'lucide-react';
import type { ConversationEntry, QuestionAnswer } from '@/engine/editor/assistant/conversation/conversation-entry';
import { WELL_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
import { AssistantMarkdown } from './assistant-markdown';
import { QuestionCard } from './question-card';
import { ReasoningBlock } from './reasoning-block';
import { ToolCallRow } from './tool-call-row';
type TranscriptEntryProps = {
    entry: ConversationEntry;
    onResolveApproval: (entryId: number, approved: boolean) => void;
    onAnswerQuestion: (entryId: number, answer: QuestionAnswer) => void;
};
export function TranscriptEntry({ entry, onResolveApproval, onAnswerQuestion }: TranscriptEntryProps) {
    switch (entry.kind) {
        case 'user':
            return (<p className={cn('rounded-sm px-2 py-1.5 text-xs leading-relaxed break-words whitespace-pre-wrap text-foreground', WELL_CLASS)}>
          <span className="sr-only">Você: </span>
          {entry.text}
        </p>);
        case 'assistant':
            return (<div>
          <span className="sr-only">Assistente: </span>
          <AssistantMarkdown text={entry.text}/>
        </div>);
        case 'reasoning':
            return <ReasoningBlock entry={entry}/>;
        case 'question':
            return <QuestionCard entry={entry} onAnswer={onAnswerQuestion}/>;
        case 'tool':
            return <ToolCallRow entry={entry} onResolve={onResolveApproval}/>;
        case 'notice': {
            const failed = entry.tone === 'error';
            const Icon = failed ? CircleAlert : Info;
            return (<p role={failed ? 'alert' : undefined} className={cn('flex items-start gap-1.5 text-2xs break-words', failed ? 'text-destructive' : 'text-muted-foreground')}>
          <Icon aria-hidden className="mt-px size-3.5 shrink-0"/>
          {entry.text}
        </p>);
        }
    }
}
