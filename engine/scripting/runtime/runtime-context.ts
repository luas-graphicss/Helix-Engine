export interface ScriptOwner {
    readonly id: number;
    readonly name: string;
    readonly active: boolean;
    track(dispose: () => void): () => void;
}
export interface CallbackInvoker {
    invoke<T>(owner: ScriptOwner | null, phase: string, fn: () => T): T | undefined;
}
export type Unsubscribe = () => void;
