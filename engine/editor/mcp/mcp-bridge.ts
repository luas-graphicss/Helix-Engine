import { ENGINE_NAME, ENGINE_VERSION } from '@/engine/core/engine-info';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import type { EngineIdentity, ToolCallEvent, ToolCallResult } from '@/engine/mcp/protocol/bridge-messages';
import type { ToolDescriptor } from '@/engine/mcp/protocol/tool-descriptor';
import { SourcePermissionsStore } from './asset-sources/permissions/source-permissions-store';
import type { McpAccessModeId } from './execution/access-policy';
import { CallActivity } from './execution/call-activity';
import { executeCall } from './execution/call-executor';
import { BridgeConnection, type ConnectionHost } from './link/bridge-connection';
import type { ConnectionStatus } from './link/connection-status';
import { parseWorkerOrigin } from './settings/bridge-settings';
import { BridgeSettingsStore } from './settings/bridge-settings-store';
import type { FileTransfer } from './tools/file-transfer';
import { findMcpTool, MCP_TOOL_DESCRIPTORS } from './tools/tool-catalog';
const LOG_SOURCE = 'MCP';
type Listener = () => void;
export class McpBridge implements ConnectionHost {
    readonly settings = new BridgeSettingsStore();
    readonly assetSources = new SourcePermissionsStore();
    readonly activity = new CallActivity();
    readonly tools: readonly ToolDescriptor[] = MCP_TOOL_DESCRIPTORS;
    private status: ConnectionStatus = { state: 'off' };
    private appliedTarget = '';
    private readonly connection = new BridgeConnection(this);
    private readonly statusListeners = new Set<Listener>();
    constructor(private readonly session: EditorSession) {
        this.settings.subscribe(() => this.applySettings());
    }
    readonly subscribeStatus = (listener: Listener): (() => void) => {
        this.statusListeners.add(listener);
        return () => this.statusListeners.delete(listener);
    };
    readonly getStatus = (): ConnectionStatus => this.status;
    get accessMode(): McpAccessModeId {
        return this.settings.getSnapshot().accessMode;
    }
    async load(): Promise<void> {
        const suspend = () => this.suspend();
        const resume = (event: PageTransitionEvent) => {
            if (event.persisted)
                this.applySettings();
        };
        window.addEventListener('pagehide', suspend);
        window.addEventListener('pageshow', resume);
        this.session.onDispose(() => {
            window.removeEventListener('pagehide', suspend);
            window.removeEventListener('pageshow', resume);
        });
        await Promise.all([this.settings.load(), this.assetSources.load()]);
    }
    stop(): void {
        this.suspend();
    }
    describeEngine(): EngineIdentity {
        return { name: ENGINE_NAME, version: ENGINE_VERSION, project: this.session.projectName };
    }
    async execute(call: ToolCallEvent, files: FileTransfer): Promise<ToolCallResult> {
        this.activity.begin(call, findMcpTool(call.tool)?.title ?? call.tool);
        const result = await executeCall({ session: this.session, files, sourcePermissions: this.assetSources.getSnapshot() }, this.accessMode, call);
        this.activity.finish(call.callId, result.failed, result.durationMs);
        return result;
    }
    report(status: ConnectionStatus): void {
        const previous = this.status.state;
        this.status = status;
        for (const listener of this.statusListeners)
            listener();
        if (status.state !== previous)
            this.logStatus(status);
    }
    private suspend(): void {
        this.appliedTarget = '';
        this.connection.stop();
    }
    private applySettings(): void {
        const { enabled, workerUrl, address, secret, accessMode } = this.settings.getSnapshot();
        const origin = enabled ? parseWorkerOrigin(workerUrl) : null;
        const target = origin ? [origin, address.session, address.token, secret, accessMode].join('\n') : '';
        if (target === this.appliedTarget)
            return;
        this.appliedTarget = target;
        if (origin)
            this.connection.start({ origin, address, secret });
        else
            this.connection.stop();
    }
    private logStatus(status: ConnectionStatus): void {
        const { log } = this.session;
        switch (status.state) {
            case 'online':
                log.info(LOG_SOURCE, `Conectado ao Worker: ${status.toolCount} ferramentas disponíveis para agentes externos.`);
                break;
            case 'reconnecting':
                log.warn(LOG_SOURCE, `Conexão perdida, tentando de novo. ${status.reason}`);
                break;
            case 'failed':
                log.error(LOG_SOURCE, `Conexão encerrada. ${status.reason}`);
                break;
            case 'off':
                log.info(LOG_SOURCE, 'Conexão com agentes externos desligada.');
                break;
            case 'connecting':
                break;
        }
    }
}
