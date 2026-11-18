'use client';
import { useSyncExternalStore } from 'react';
import { findAssistantMode } from '@/engine/editor/assistant/modes/assistant-mode';
import { MCP_ACCESS_MODE_IDS } from '@/engine/editor/mcp/execution/access-policy';
import type { McpBridge } from '@/engine/editor/mcp/mcp-bridge';
import { agentUrlOf, workerUrlProblem } from '@/engine/editor/mcp/settings/bridge-settings';
import { PropertyRow } from '@/engine/ui/property-row';
import { SelectField } from '@/engine/ui/select-field';
import { ToggleField } from '@/engine/ui/toggle-field';
import { AgentCallList } from './agent-call-list';
import { AgentUrlRow } from './agent-url-row';
import { AssetSourceList } from './asset-sources/asset-source-list';
import { BridgeStatusLine } from './bridge-status-line';
import { CommittedField } from './committed-field';
import { KitDownloadLink } from './kit-download-link';
const ACCESS_OPTIONS = MCP_ACCESS_MODE_IDS.map((id) => ({ value: id, label: findAssistantMode(id).label }));
type McpBridgeFormProps = {
    bridge: McpBridge;
};
export function McpBridgeForm({ bridge }: McpBridgeFormProps) {
    const { settings: store, activity } = bridge;
    const settings = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    const status = useSyncExternalStore(bridge.subscribeStatus, bridge.getStatus, bridge.getStatus);
    const calls = useSyncExternalStore(activity.subscribe, activity.getSnapshot, activity.getSnapshot);
    return (<section aria-label="Conexão MCP para agentes externos" className="flex max-h-[70%] shrink-0 flex-col gap-0.5 overflow-y-auto border-b border-border bg-surface-sunken/40 py-1.5">
      <ToggleField label="Conexão MCP" hint="Liga o editor ao seu Worker para agentes externos usarem as ferramentas da engine." on={settings.enabled} onToggle={() => store.update({ enabled: !settings.enabled })}/>
      <PropertyRow label="URL do Worker" hint="Endereço que o npx wrangler deploy mostrou ao publicar o kit">
        <CommittedField aria-label="URL do Worker" value={settings.workerUrl} placeholder="https://helix-engine-mcp.exemplo.workers.dev" spellCheck={false} autoComplete="off" inputMode="url" onCommit={(workerUrl) => store.update({ workerUrl: workerUrl.trim() })}/>
      </PropertyRow>
      <PropertyRow label="Segredo" hint="Opcional. O mesmo valor definido com npx wrangler secret put SECRET.">
        <CommittedField aria-label="Segredo" type="password" value={settings.secret} placeholder="Opcional" spellCheck={false} autoComplete="off" onCommit={(secret) => store.update({ secret: secret.trim() })}/>
      </PropertyRow>
      <PropertyRow label="Acesso" hint={findAssistantMode(settings.accessMode).description}>
        <SelectField label="Acesso dos agentes" options={ACCESS_OPTIONS} value={settings.accessMode} onChange={(accessMode) => store.update({ accessMode })}/>
      </PropertyRow>
      <AgentUrlRow url={agentUrlOf(settings)} onRotate={() => store.rotateAddress()}/>
      <BridgeStatusLine status={status} problem={workerUrlProblem(settings)}/>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-2 py-1">
        <KitDownloadLink />
        <span className="min-w-0 text-3xs text-muted-foreground">Na pasta do kit, rode npx wrangler deploy.</span>
      </div>
      <AssetSourceList store={bridge.assetSources}/>
      <AgentCallList calls={calls}/>
    </section>);
}
