export type RpcAudienceMode = 'others' | 'all' | 'server';
export interface RpcDeclaration {
    readonly name: string;
    readonly audience: RpcAudienceMode;
    readonly requireOwnership: boolean;
    readonly reliable: boolean;
    readonly perSecond: number;
}
export const RPC_AUDIENCES: readonly RpcAudienceMode[] = ['others', 'all', 'server'];
export const RPC_AUDIENCE_LABEL: Record<RpcAudienceMode, string> = {
    others: 'Os outros jogadores',
    all: 'Todos os jogadores',
    server: 'Só o servidor',
};
export const RPC_AUDIENCE_HINT: Record<RpcAudienceMode, string> = {
    others: 'O servidor confere o limite e repassa a chamada a todos menos a quem enviou.',
    all: 'O servidor confere o limite e repassa a chamada a todos, inclusive a quem enviou.',
    server: 'A chamada para no servidor, onde um script do anfitrião decide o que fazer com ela.',
};
export const MAX_RPC_DECLARATIONS = 64;
export const MAX_RPC_NAME_LENGTH = 48;
export const MAX_RPC_RATE = 240;
export const DEFAULT_RPC_RATE = 20;
const FORBIDDEN_NAME_CHARACTERS = /[^a-zA-Z0-9_.:-]/g;
export function normalizeRpcName(name: string): string {
    return name.replace(FORBIDDEN_NAME_CHARACTERS, '').slice(0, MAX_RPC_NAME_LENGTH);
}
function clampRate(value: number): number {
    return Number.isFinite(value) ? Math.min(MAX_RPC_RATE, Math.max(1, Math.round(value))) : DEFAULT_RPC_RATE;
}
export function createRpcDeclaration(name: string): RpcDeclaration {
    return { name: normalizeRpcName(name), audience: 'others', requireOwnership: false, reliable: true, perSecond: DEFAULT_RPC_RATE };
}
export function normalizeRpcDeclarations(declarations: readonly Partial<RpcDeclaration>[]): RpcDeclaration[] {
    const byName = new Map<string, RpcDeclaration>();
    for (const declaration of declarations.slice(0, MAX_RPC_DECLARATIONS)) {
        const name = normalizeRpcName(String(declaration.name ?? ''));
        if (!name || byName.has(name))
            continue;
        byName.set(name, {
            name,
            audience: declaration.audience !== undefined && RPC_AUDIENCES.includes(declaration.audience) ? declaration.audience : 'others',
            requireOwnership: declaration.requireOwnership === true,
            reliable: declaration.reliable !== false,
            perSecond: clampRate(Number(declaration.perSecond)),
        });
    }
    return Array.from(byName.values());
}
export function uniqueRpcName(declarations: readonly RpcDeclaration[], desired: string): string {
    const taken = new Set(declarations.map((declaration) => declaration.name));
    const base = normalizeRpcName(desired) || 'rpc';
    if (!taken.has(base))
        return base;
    for (let suffix = 2;; suffix++) {
        const candidate = `${base.slice(0, MAX_RPC_NAME_LENGTH - String(suffix).length)}${suffix}`;
        if (!taken.has(candidate))
            return candidate;
    }
}
