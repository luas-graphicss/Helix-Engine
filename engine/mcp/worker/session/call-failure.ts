export type CallFailureCode = 'ENGINE_OFFLINE' | 'ENGINE_DISCONNECTED' | 'QUEUE_FULL' | 'QUEUE_EXPIRED' | 'TIMEOUT' | 'UNKNOWN_TOOL' | 'INVALID_ARGUMENTS' | 'FILE_REJECTED';
export type ExecutionCertainty = 'not-executed' | 'unknown';
export interface CallFailure {
    readonly code: CallFailureCode;
    readonly message: string;
    readonly execution: ExecutionCertainty;
}
const CONNECT_HINT = 'Ask the user to open the game in the Helix editor and switch on the MCP connection in the Assistant panel.';
const EXECUTION_NOTE: Record<ExecutionCertainty, string> = {
    'not-executed': 'Nothing was executed.',
    unknown: 'The editor may have applied the change: inspect the project before repeating the call.',
};
export function engineOffline(): CallFailure {
    return { code: 'ENGINE_OFFLINE', message: `The Helix editor is not connected to this MCP session. ${CONNECT_HINT}`, execution: 'not-executed' };
}
export function engineDisconnected(delivered: boolean): CallFailure {
    return { code: 'ENGINE_DISCONNECTED', message: 'The Helix editor disconnected before answering.', execution: delivered ? 'unknown' : 'not-executed' };
}
export function queueFull(limit: number): CallFailure {
    return { code: 'QUEUE_FULL', message: `The session already has ${limit} calls in progress. Wait for them and repeat.`, execution: 'not-executed' };
}
export function queueExpired(): CallFailure {
    return { code: 'QUEUE_EXPIRED', message: `The editor did not pick up the call in time. ${CONNECT_HINT}`, execution: 'not-executed' };
}
export function callTimedOut(timeoutMs: number): CallFailure {
    return { code: 'TIMEOUT', message: `The editor did not finish within ${Math.round(timeoutMs / 1000)} seconds.`, execution: 'unknown' };
}
export function unknownTool(name: string, catalogEmpty: boolean): CallFailure {
    const hint = catalogEmpty ? `The editor has not connected yet, so only the Worker tools exist. ${CONNECT_HINT}` : 'List the tools again to see the valid names.';
    return { code: 'UNKNOWN_TOOL', message: `There is no tool named "${name}". ${hint}`, execution: 'not-executed' };
}
export function invalidArguments(problem: string): CallFailure {
    return { code: 'INVALID_ARGUMENTS', message: `Invalid arguments: ${problem}.`, execution: 'not-executed' };
}
export function fileRejected(problem: string): CallFailure {
    return { code: 'FILE_REJECTED', message: problem, execution: 'not-executed' };
}
export function describeFailure(failure: CallFailure): string {
    return `${failure.code}: ${failure.message} ${EXECUTION_NOTE[failure.execution]}`;
}
