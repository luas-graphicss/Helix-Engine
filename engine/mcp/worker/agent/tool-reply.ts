import type { ToolAttachment, ToolCallResult } from '@/engine/mcp/protocol/bridge-messages';
import { describeFailure, type CallFailure, type CallFailureCode } from '@/engine/mcp/worker/session/call-failure';
const TOOL_FAILED_STATUS = 422;
const FAILURE_STATUS: Record<CallFailureCode, number> = {
    ENGINE_OFFLINE: 503,
    ENGINE_DISCONNECTED: 503,
    QUEUE_FULL: 429,
    QUEUE_EXPIRED: 504,
    TIMEOUT: 504,
    UNKNOWN_TOOL: 404,
    INVALID_ARGUMENTS: 400,
    FILE_REJECTED: 400,
};
export interface ToolReply {
    readonly failed: boolean;
    readonly text: string;
    readonly attachments: readonly ToolAttachment[];
    readonly failure: CallFailure | null;
}
export function successReply(text: string, attachments: readonly ToolAttachment[] = []): ToolReply {
    return { failed: false, text, attachments, failure: null };
}
export function failureReply(failure: CallFailure): ToolReply {
    return { failed: true, text: describeFailure(failure), attachments: [], failure };
}
export function replyFromResult(result: ToolCallResult): ToolReply {
    return { failed: result.failed, text: result.output, attachments: result.attachments, failure: null };
}
export function mayHaveExecuted(reply: ToolReply): boolean {
    return reply.failure === null || reply.failure.execution === 'unknown';
}
export function httpStatusOf(reply: ToolReply): number {
    if (!reply.failed)
        return 200;
    return reply.failure ? FAILURE_STATUS[reply.failure.code] : TOOL_FAILED_STATUS;
}
