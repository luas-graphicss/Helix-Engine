'use client';
import { useEffect, useRef } from 'react';
import { LoaderCircle } from 'lucide-react';
import type { AssistantActivity, ConversationEntry } from '@/engine/editor/assistant/conversation/conversation-entry';
import { TranscriptEntry } from './transcript-entry';
const PINNED_DISTANCE_PX = 48;
type AssistantTranscriptProps = {
    entries: readonly ConversationEntry[];
    activity: AssistantActivity;
    onResolveApproval: (entryId: number, approved: boolean) => void;
};
export function AssistantTranscript({ entries, activity, onResolveApproval }: AssistantTranscriptProps) {
    const scrollerRef = useRef<HTMLDivElement>(null);
    const pinnedRef = useRef(true);
    useEffect(() => {
        const scroller = scrollerRef.current;
        if (scroller && pinnedRef.current)
            scroller.scrollTop = scroller.scrollHeight;
    }, [entries, activity]);
    const trackPinned = () => {
        const scroller = scrollerRef.current;
        if (scroller)
            pinnedRef.current = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < PINNED_DISTANCE_PX;
    };
    return (<div ref={scrollerRef} role="log" aria-label="Conversa com o assistente" onScroll={trackPinned} className="min-h-0 flex-1 overflow-y-auto p-2">
      <ol className="flex flex-col gap-2">
        {entries.map((entry) => (<li key={entry.id}>
            <TranscriptEntry entry={entry} onResolveApproval={onResolveApproval}/>
          </li>))}
      </ol>
      {activity === 'thinking' && (<p role="status" className="mt-2 flex items-center gap-1.5 text-2xs text-muted-foreground">
          <LoaderCircle aria-hidden className="size-3 motion-safe:animate-spin"/>
          Pensando…
        </p>)}
    </div>);
}
