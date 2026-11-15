'use client';
import { useState, useSyncExternalStore } from 'react';
import { Plug, SquarePen } from 'lucide-react';
import { findAssistantMode } from '@/engine/editor/assistant/modes/assistant-mode';
import { connectionProblem } from '@/engine/editor/assistant/providers/connection-settings';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { IconButton } from '@/engine/ui/icon-button';
import { PanelToolbar } from '@/engine/ui/panel-toolbar';
import { AssistantComposer } from './assistant/assistant-composer';
import { AssistantEmptyState } from './assistant/assistant-empty-state';
import { AssistantTranscript } from './assistant/assistant-transcript';
import { ConnectionForm } from './assistant/connection-form';
import { ModeSelect } from './assistant/mode-select';
import { PlanPanel } from './assistant/plan-panel';
export function AssistantPanel() {
    const { assistant } = useEditorSession();
    const { connection, conversation } = assistant;
    const settings = useSyncExternalStore(connection.subscribe, connection.getSnapshot, connection.getSnapshot);
    const { entries, activity, plan } = useSyncExternalStore(conversation.subscribe, conversation.getSnapshot, conversation.getSnapshot);
    const modeId = useSyncExternalStore(assistant.subscribeMode, assistant.getModeId, assistant.getModeId);
    const [connectionOpen, setConnectionOpen] = useState(false);
    const problem = connectionProblem(settings);
    const mode = findAssistantMode(modeId);
    return (<div className="flex h-full min-h-0 flex-col">
      <PanelToolbar className="px-2">
        <ModeSelect modeId={modeId} onChange={(next) => assistant.setMode(next)}/>
        <IconButton label="Nova conversa" size="sm" className="ml-auto" disabled={entries.length === 0} onClick={() => assistant.reset()}>
          <SquarePen />
        </IconButton>
        <IconButton label="Conexão com o modelo" size="sm" active={connectionOpen} onClick={() => setConnectionOpen((open) => !open)}>
          <Plug />
        </IconButton>
      </PanelToolbar>
      {connectionOpen && <ConnectionForm key={settings.providerId} connection={connection} settings={settings}/>}
      {entries.length === 0 ? (<AssistantEmptyState configured={problem === null} onConfigure={() => setConnectionOpen(true)}/>) : (<AssistantTranscript entries={entries} activity={activity} onResolveApproval={(entryId, approved) => assistant.resolveApproval(entryId, approved)} onAnswerQuestion={(entryId, answer) => assistant.answerQuestion(entryId, answer)}/>)}
      {plan && <PlanPanel steps={plan} onDismiss={() => assistant.dismissPlan()}/>}
      <AssistantComposer busy={activity !== 'idle'} hint={problem ?? mode.description} onSend={(text) => assistant.send(text)} onStop={() => assistant.stop()}/>
    </div>);
}
