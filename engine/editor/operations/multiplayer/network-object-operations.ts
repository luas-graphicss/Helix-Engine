import type { Entity } from '@/engine/core/scene/entity';
import { SetValueCommand } from '@/engine/editor/commands/set-value-command';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import {
    MAX_NETWORK_VARIABLES,
    cloneNetworkObjectSettings,
    createNetworkObjectSettings,
    createPlayerObjectSettings,
    defaultVariableValue,
    normalizeNetworkObjectSettings,
    uniqueVariableName,
    variableKindOf,
    type NetworkObjectSettings,
    type NetworkSpawnMode,
    type NetworkVariableKind,
    type NetworkVariableSettings,
} from '@/engine/net/scene/network-object-settings';
const UNHOSTABLE_KINDS: ReadonlySet<Entity['kind']> = new Set(['terrain', 'gui', 'script']);
const NEW_VARIABLE_NAME = 'valor';
function hasNetworkedAncestor(entity: Entity): boolean {
    for (let current = entity.parent; current; current = current.parent)
        if (current.networkObject)
            return true;
    return false;
}
function hasNetworkedDescendant(entity: Entity): boolean {
    return entity.children.some((child) => child.networkObject !== null || hasNetworkedDescendant(child));
}
function commit(session: EditorSession, entity: Entity, label: string, next: NetworkObjectSettings | null, mergeKey?: string): void {
    session.history.execute(new SetValueCommand<NetworkObjectSettings | null>(label, (value) => {
        entity.networkObject = value;
        session.notify();
    }, entity.networkObject, next, mergeKey));
}
function presetFor(mode: NetworkSpawnMode): NetworkObjectSettings {
    return mode === 'player' ? createPlayerObjectSettings() : { ...createNetworkObjectSettings(), spawn: mode };
}
export function canAddNetworkObject(entity: Entity): boolean {
    return entity.parent !== null && entity.networkObject === null && !UNHOSTABLE_KINDS.has(entity.kind) && !hasNetworkedAncestor(entity) && !hasNetworkedDescendant(entity);
}
export function addNetworkObject(session: EditorSession, entity: Entity, mode: NetworkSpawnMode): void {
    if (canAddNetworkObject(entity))
        commit(session, entity, `Tornar ${entity.name} um objeto de rede`, presetFor(mode));
}
export function removeNetworkObject(session: EditorSession, entity: Entity): void {
    if (entity.networkObject)
        commit(session, entity, `Tirar ${entity.name} da rede`, null);
}
export function updateNetworkObject(session: EditorSession, entity: Entity, patch: Partial<NetworkObjectSettings>): void {
    const current = entity.networkObject;
    if (!current)
        return;
    const next = normalizeNetworkObjectSettings({ ...cloneNetworkObjectSettings(current), ...patch });
    if (JSON.stringify(next) === JSON.stringify(current))
        return;
    const keys = Object.keys(patch);
    commit(session, entity, `Objeto de rede de ${entity.name}`, next, keys.length === 1 && keys[0] !== 'variables' ? `networkObject.${entity.id}.${keys[0]}` : undefined);
}
export function canAddNetworkVariable(entity: Entity): boolean {
    return entity.networkObject !== null && entity.networkObject.variables.length < MAX_NETWORK_VARIABLES;
}
export function addNetworkVariable(session: EditorSession, entity: Entity): void {
    const current = entity.networkObject;
    if (current && canAddNetworkVariable(entity))
        updateNetworkObject(session, entity, { variables: [...current.variables, { name: uniqueVariableName(current.variables, NEW_VARIABLE_NAME), initial: 0, writer: 'server' }] });
}
export function updateNetworkVariable(session: EditorSession, entity: Entity, index: number, patch: Partial<NetworkVariableSettings>): void {
    const current = entity.networkObject;
    const variable = current?.variables[index];
    if (!current || !variable)
        return;
    const others = current.variables.filter((_other, position) => position !== index);
    const name = patch.name === undefined ? variable.name : uniqueVariableName(others, patch.name);
    updateNetworkObject(session, entity, { variables: current.variables.map((other, position) => (position === index ? { ...other, ...patch, name } : other)) });
}
export function setNetworkVariableKind(session: EditorSession, entity: Entity, index: number, kind: NetworkVariableKind): void {
    const variable = entity.networkObject?.variables[index];
    if (variable && variableKindOf(variable.initial) !== kind)
        updateNetworkVariable(session, entity, index, { initial: defaultVariableValue(kind) });
}
export function removeNetworkVariable(session: EditorSession, entity: Entity, index: number): void {
    const current = entity.networkObject;
    if (current)
        updateNetworkObject(session, entity, { variables: current.variables.filter((_variable, position) => position !== index) });
}
