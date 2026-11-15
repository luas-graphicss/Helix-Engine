import type { ToolDescriptor } from './tool-descriptor';
export const BRIDGE_PROTOCOL_VERSION = 1;
export const BRIDGE_ERROR_CODES = ['BAD_REQUEST', 'UNAUTHORIZED', 'PROTOCOL_MISMATCH', 'UNKNOWN_PEER', 'PEER_REPLACED', 'FILE_NOT_FOUND', 'FILE_TOO_LARGE'] as const;
export type BridgeErrorCode = (typeof BRIDGE_ERROR_CODES)[number];
export interface BridgeErrorBody {
    readonly error: {
        readonly code: BridgeErrorCode;
        readonly message: string;
    };
}
export interface EngineIdentity {
    readonly name: string;
    readonly version: string;
    readonly project: string;
}
export interface HelloRequest {
    readonly protocol: number;
    readonly peer: string;
    readonly engine: EngineIdentity;
    readonly accessMode: string;
    readonly tools: readonly ToolDescriptor[];
}
export interface HelloResponse {
    readonly serverVersion: string;
    readonly pollWaitMs: number;
}
export interface ToolCallEvent {
    readonly callId: string;
    readonly tool: string;
    readonly arguments: Readonly<Record<string, unknown>>;
    readonly agent: string;
    readonly remainingMs: number;
}
export interface ToolAttachment {
    readonly fileId: string;
    readonly name: string;
    readonly mimeType: string;
    readonly size: number;
}
export interface ToolCallResult {
    readonly callId: string;
    readonly failed: boolean;
    readonly output: string;
    readonly attachments: readonly ToolAttachment[];
    readonly durationMs: number;
}
export interface ResultBatch {
    readonly peer: string;
    readonly results: readonly ToolCallResult[];
}
export interface PollResponse {
    readonly calls: readonly ToolCallEvent[];
    readonly cancelled: readonly string[];
}
export interface ByeRequest {
    readonly peer: string;
}
