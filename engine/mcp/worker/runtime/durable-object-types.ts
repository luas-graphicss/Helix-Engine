export interface DurableObjectStorage {
    get(key: string): Promise<unknown>;
    put(key: string, value: unknown): Promise<void>;
}
export interface DurableObjectState {
    readonly storage: DurableObjectStorage;
    blockConcurrencyWhile<TResult>(task: () => Promise<TResult>): Promise<TResult>;
}
export interface DurableObjectId {
    toString(): string;
}
export interface DurableObjectStub {
    fetch(request: Request): Promise<Response>;
}
export interface DurableObjectNamespace {
    idFromName(name: string): DurableObjectId;
    get(id: DurableObjectId): DurableObjectStub;
}
export interface WorkerEnv {
    readonly SESSIONS: DurableObjectNamespace;
    readonly SECRET?: string;
    readonly CALL_TIMEOUT_MS?: string;
    readonly POLL_WAIT_MS?: string;
    readonly QUEUE_LIMIT?: string;
    readonly ENGINE_WINDOW_MS?: string;
    readonly FILE_TTL_MS?: string;
}
