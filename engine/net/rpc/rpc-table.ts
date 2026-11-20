import type { NetValue } from '../wire/net-value';
export interface RpcContext {
    readonly senderId: number;
    readonly objectId: number;
}
export type RpcHandler = (context: RpcContext, args: NetValue[]) => void;
export interface RpcRules {
    readonly requireOwnership: boolean;
    readonly perSecond: number;
}
export interface RpcEntry {
    readonly handler: RpcHandler;
    readonly rules: RpcRules;
}
const OPEN_RULES: RpcRules = { requireOwnership: false, perSecond: 0 };
export class RpcTable {
    private readonly entries = new Map<string, RpcEntry>();
    register(name: string, handler: RpcHandler, rules: Partial<RpcRules> = {}): () => void {
        const entry: RpcEntry = { handler, rules: { ...OPEN_RULES, ...rules } };
        this.entries.set(name, entry);
        return () => {
            if (this.entries.get(name) === entry)
                this.entries.delete(name);
        };
    }
    get(name: string): RpcEntry | undefined {
        return this.entries.get(name);
    }
    names(): string[] {
        return Array.from(this.entries.keys());
    }
    clear(): void {
        this.entries.clear();
    }
}
