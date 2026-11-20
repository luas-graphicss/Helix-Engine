import type { EditorSession } from '@/engine/editor/session/editor-session';
import { MAX_RPC_DECLARATIONS, createRpcDeclaration, uniqueRpcName, type RpcDeclaration } from '@/engine/net/settings/rpc-declarations';
import { editMultiplayer } from './multiplayer-settings-operations';
const NEW_RPC_NAME = 'rpc';
export function canAddRpc(session: EditorSession): boolean {
    return session.scene.multiplayer.rpcs.length < MAX_RPC_DECLARATIONS;
}
export function addRpc(session: EditorSession): void {
    editMultiplayer(session, 'Declarar RPC', (settings) => ({ ...settings, rpcs: [...settings.rpcs, createRpcDeclaration(uniqueRpcName(settings.rpcs, NEW_RPC_NAME))] }));
}
export function updateRpc(session: EditorSession, rpcName: string, patch: Partial<RpcDeclaration>): void {
    const keys = Object.keys(patch);
    editMultiplayer(session, 'RPC do multiplayer', (settings) => {
        const others = settings.rpcs.filter((rpc) => rpc.name !== rpcName);
        const name = patch.name === undefined ? rpcName : uniqueRpcName(others, patch.name);
        return { ...settings, rpcs: settings.rpcs.map((rpc) => (rpc.name === rpcName ? { ...rpc, ...patch, name } : rpc)) };
    }, keys.length === 1 && keys[0] !== 'name' ? `multiplayer.rpc.${rpcName}.${keys[0]}` : undefined);
}
export function removeRpc(session: EditorSession, rpcName: string): void {
    editMultiplayer(session, 'Excluir RPC', (settings) => ({ ...settings, rpcs: settings.rpcs.filter((rpc) => rpc.name !== rpcName) }));
}
