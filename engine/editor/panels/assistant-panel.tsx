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
import { McpBridgeForm } from './assistant/mcp/mcp-bridge-form';
import { McpToolbarButton } from './assistant/mcp/mcp-toolbar-button';
import { ModeSelect } from './assistant/mode-select';
import { PlanPanel } from './assistant/plan-panel';
type OpenSection = 'connection' | 'mcp';
export function AssistantPanel() {
    const { assistant, mcp } = useEditorSession();
    const { connection, conversation } = assistant;
    const settings = useSyncExternalStore(connection.subscribe, connection.getSnapshot, connection.getSnapshot);
    const { entries, activity, plan } = useSyncExternalStore(conversation.subscribe, conversation.getSnapshot, conversation.getSnapshot);
    const modeId = useSyncExternalStore(assistant.subscribeMode, assistant.getModeId, assistant.getModeId);
    const [openSection, setOpenSection] = useState<OpenSection | null>(null);
    const toggleSection = (section: OpenSection) => setOpenSection((current) => (current === section ? null : section));
    const problem = connectionProblem(settings);
    const mode = findAssistantMode(modeId);
    return (<div className="flex h-full min-h-0 flex-col">
      <PanelToolbar className="px-2">
        <ModeSelect modeId={modeId} onChange={(next) => assistant.setMode(next)}/>
        <IconButton label="Nova conversa" size="sm" className="ml-auto" disabled={entries.length === 0} onClick={() => assistant.reset()}>
          <SquarePen />
        </IconButton>
        <IconButton label="Conexão com o modelo" size="sm" active={openSection === 'connection'} onClick={() => toggleSection('connection')}>
          <Plug />
        </IconButton>
        <McpToolbarButton bridge={mcp} open={openSection === 'mcp'} onToggle={() => toggleSection('mcp')}/>
      </PanelToolbar>
      {openSection === 'connection' && <ConnectionForm key={settings.providerId} connection={connection} settings={settings}/>}
      {openSection === 'mcp' && <McpBridgeForm bridge={mcp}/>}
      {entries.length === 0 ? (<AssistantEmptyState configured={problem === null} onConfigure={() => setOpenSection('connection')}/>) : (<AssistantTranscript entries={entries} activity={activity} onResolveApproval={(entryId, approved) => assistant.resolveApproval(entryId, approved)} onAnswerQuestion={(entryId, answer) => assistant.answerQuestion(entryId, answer)}/>)}
      {plan && <PlanPanel steps={plan} running={activity !== 'idle'} onDismiss={() => assistant.dismissPlan()}/>}
      <AssistantComposer busy={activity !== 'idle'} hint={problem ?? mode.description} onSend={(text) => assistant.send(text)} onStop={() => assistant.stop()}/>
    </div>);
}
