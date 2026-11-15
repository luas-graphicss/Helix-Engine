import { BRIDGE_ERROR_CODES, type BridgeErrorBody, type ByeRequest, type EngineIdentity, type HelloRequest, type HelloResponse, type PollResponse, type ResultBatch, type ToolAttachment, type ToolCallEvent, type ToolCallResult } from './bridge-messages';
import { isFiniteNumber, isRecord, isText, isTextList } from './json-shape';
import { isToolName, parseToolDescriptor } from './tool-descriptor';
const PEER_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
const MAX_TOOLS = 256;
const MAX_BATCH_SIZE = 64;
const MAX_ATTACHMENTS = 8;
const MAX_OUTPUT_LENGTH = 400000;
const MAX_LABEL_LENGTH = 160;
function parseList<TItem>(value: unknown, limit: number, parseItem: (item: unknown) => TItem | null): TItem[] | null {
    if (!Array.isArray(value) || value.length > limit)
        return null;
    const items: TItem[] = [];
    for (const candidate of value) {
        const item = parseItem(candidate);
        if (item === null)
            return null;
        items.push(item);
    }
    return items;
}
function isLabel(value: unknown): value is string {
    return isText(value) && value.length <= MAX_LABEL_LENGTH;
}
export function isPeerId(value: unknown): value is string {
    return isText(value) && PEER_PATTERN.test(value);
}
function parseEngineIdentity(value: unknown): EngineIdentity | null {
    if (!isRecord(value))
        return null;
    const { name, version, project } = value;
    return isLabel(name) && isLabel(version) && isLabel(project) ? { name, version, project } : null;
}
export function parseHelloRequest(value: unknown): HelloRequest | null {
    if (!isRecord(value))
        return null;
    const { protocol, peer, accessMode } = value;
    if (!isFiniteNumber(protocol) || !isPeerId(peer) || !isLabel(accessMode))
        return null;
    const engine = parseEngineIdentity(value.engine);
    const tools = parseList(value.tools, MAX_TOOLS, parseToolDescriptor);
    return engine && tools ? { protocol, peer, engine, accessMode, tools } : null;
}
export function parseHelloResponse(value: unknown): HelloResponse | null {
    if (!isRecord(value))
        return null;
    const { serverVersion, pollWaitMs } = value;
    return isText(serverVersion) && isFiniteNumber(pollWaitMs) ? { serverVersion, pollWaitMs } : null;
}
export function parseToolAttachment(value: unknown): ToolAttachment | null {
    if (!isRecord(value))
        return null;
    const { fileId, name, mimeType, size } = value;
    return isLabel(fileId) && isLabel(name) && isLabel(mimeType) && isFiniteNumber(size) ? { fileId, name, mimeType, size } : null;
}
function parseToolCallResult(value: unknown): ToolCallResult | null {
    if (!isRecord(value))
        return null;
    const { callId, failed, output, durationMs } = value;
    if (!isLabel(callId) || typeof failed !== 'boolean' || !isText(output) || output.length > MAX_OUTPUT_LENGTH || !isFiniteNumber(durationMs))
        return null;
    const attachments = parseList(value.attachments, MAX_ATTACHMENTS, parseToolAttachment);
    return attachments ? { callId, failed, output, attachments, durationMs } : null;
}
export function parseResultBatch(value: unknown): ResultBatch | null {
    if (!isRecord(value))
        return null;
    const { peer } = value;
    const results = parseList(value.results, MAX_BATCH_SIZE, parseToolCallResult);
    return isPeerId(peer) && results ? { peer, results } : null;
}
function parseToolCallEvent(value: unknown): ToolCallEvent | null {
    if (!isRecord(value))
        return null;
    const { callId, tool, agent, remainingMs } = value;
    if (!isLabel(callId) || !isText(tool) || !isToolName(tool) || !isLabel(agent) || !isFiniteNumber(remainingMs) || !isRecord(value.arguments))
        return null;
    return { callId, tool, arguments: value.arguments, agent, remainingMs };
}
export function parsePollResponse(value: unknown): PollResponse | null {
    if (!isRecord(value))
        return null;
    const { cancelled } = value;
    const calls = parseList(value.calls, MAX_BATCH_SIZE, parseToolCallEvent);
    return isTextList(cancelled) && calls ? { calls, cancelled } : null;
}
export function parseByeRequest(value: unknown): ByeRequest | null {
    if (!isRecord(value))
        return null;
    const { peer } = value;
    return isPeerId(peer) ? { peer } : null;
}
export function parseBridgeError(value: unknown): BridgeErrorBody | null {
    if (!isRecord(value) || !isRecord(value.error))
        return null;
    const { code: rawCode, message } = value.error;
    const code = BRIDGE_ERROR_CODES.find((candidate) => candidate === rawCode);
    return code && isText(message) ? { error: { code, message } } : null;
}
