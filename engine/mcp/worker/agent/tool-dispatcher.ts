import type { ToolDescriptor } from '@/engine/mcp/protocol/tool-descriptor';
import { engineOffline, invalidArguments, unknownTool } from '@/engine/mcp/worker/session/call-failure';
import type { CallQueue } from '@/engine/mcp/worker/session/call-queue';
import type { EngineLink } from '@/engine/mcp/worker/session/engine-link';
import { IdempotencyCache } from '@/engine/mcp/worker/session/idempotency-cache';
import type { AgentContext } from './agent-context';
import { prepareArguments } from './argument-preparation';
import type { LocalTool } from './local-tools';
import { failureReply, mayHaveExecuted, replyFromResult, type ToolReply } from './tool-reply';
const REPLY_TTL_MS = 300000;
const REPLY_CAPACITY = 256;
export class ToolDispatcher {
    private readonly replies = new IdempotencyCache<ToolReply>(REPLY_TTL_MS, REPLY_CAPACITY, mayHaveExecuted);
    constructor(private readonly link: EngineLink, private readonly queue: CallQueue, private readonly localTools: readonly LocalTool[], private readonly isEngineOnline: () => boolean) { }
    listTools(): readonly ToolDescriptor[] {
        const local = this.localTools.map((tool) => tool.descriptor);
        const localNames = new Set(local.map((tool) => tool.name));
        return [...local, ...this.link.tools.filter((tool) => !localNames.has(tool.name))];
    }
    findTool(name: string): ToolDescriptor | undefined {
        return this.listTools().find((tool) => tool.name === name);
    }
    call(name: string, rawArguments: unknown, context: AgentContext): Promise<ToolReply> {
        const key = context.idempotencyKey === null ? null : `${context.agent}:${name}:${context.idempotencyKey}`;
        return this.replies.run(key, () => this.execute(name, rawArguments, context));
    }
    private async execute(name: string, rawArguments: unknown, context: AgentContext): Promise<ToolReply> {
        const descriptor = this.findTool(name);
        if (!descriptor)
            return failureReply(unknownTool(name, this.link.tools.length === 0));
        const prepared = prepareArguments(descriptor.inputSchema, rawArguments);
        if (!prepared.ok)
            return failureReply(invalidArguments(prepared.problem));
        const local = this.localTools.find((tool) => tool.descriptor.name === name);
        if (local)
            return local.run(prepared.arguments, context);
        if (!this.isEngineOnline())
            return failureReply(engineOffline());
        const outcome = await this.queue.submit({ tool: name, arguments: prepared.arguments, agent: context.agent });
        return outcome.status === 'completed' ? replyFromResult(outcome.result) : failureReply(outcome.failure);
    }
}
