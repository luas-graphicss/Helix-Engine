import type { AuthorityMode, OwnerLeftPolicy } from '../objects/network-object';
import type { Relevance } from '../objects/relevance';
import type { VariableDefinition, VariableWriter } from '../objects/variable-set';
export type NetworkSpawnMode = 'scene' | 'player' | 'template';
export type RelevanceMode = Relevance['mode'];
export type NetworkVariableValue = boolean | number | string;
export type NetworkVariableKind = 'boolean' | 'number' | 'string';
export interface NetworkVariableSettings {
    name: string;
    initial: NetworkVariableValue;
    writer: VariableWriter;
}
export interface NetworkObjectSettings {
    spawn: NetworkSpawnMode;
    authority: AuthorityMode;
    syncScale: boolean;
    relevance: RelevanceMode;
    relevanceRadius: number;
    observer: boolean;
    ownerLeftPolicy: OwnerLeftPolicy;
    transferable: boolean;
    maxSpeed: number;
    remoteScripts: boolean;
    variables: NetworkVariableSettings[];
}
export const NETWORK_SPAWN_MODES: readonly NetworkSpawnMode[] = ['scene', 'player', 'template'];
export const NETWORK_SPAWN_LABEL: Record<NetworkSpawnMode, string> = {
    scene: 'Objeto da cena',
    player: 'Um por jogador',
    template: 'Modelo sob demanda',
};
export const NETWORK_SPAWN_HINT: Record<NetworkSpawnMode, string> = {
    scene: 'Existe uma vez em cada sessão, desde o início, com o mesmo estado para todos.',
    player: 'O servidor cria uma cópia para cada jogador que entra e entrega a posse a ele; a cópia some quando ele sai.',
    template: 'Fica oculto no jogo e serve de molde: o anfitrião cria cópias com helix.multiplayer.spawn.',
};
export const AUTHORITY_MODES: readonly AuthorityMode[] = ['server', 'owner'];
export const AUTHORITY_LABEL: Record<AuthorityMode, string> = {
    server: 'Servidor',
    owner: 'Dono',
};
export const AUTHORITY_HINT: Record<AuthorityMode, string> = {
    server: 'Só o servidor move o objeto; os jogadores recebem a pose interpolada.',
    owner: 'O jogador dono move o objeto na própria máquina e o servidor confere a velocidade antes de repassar.',
};
export const RELEVANCE_MODES: readonly RelevanceMode[] = ['always', 'distance', 'owner'];
export const RELEVANCE_LABEL: Record<RelevanceMode, string> = {
    always: 'Todos',
    distance: 'Por distância',
    owner: 'Só o dono',
};
export const OWNER_LEFT_POLICIES: readonly OwnerLeftPolicy[] = ['despawn', 'server'];
export const OWNER_LEFT_LABEL: Record<OwnerLeftPolicy, string> = {
    despawn: 'Remover o objeto',
    server: 'Passar ao servidor',
};
export const VARIABLE_WRITERS: readonly VariableWriter[] = ['server', 'owner'];
export const VARIABLE_WRITER_LABEL: Record<VariableWriter, string> = {
    server: 'Servidor',
    owner: 'Dono',
};
export const VARIABLE_KINDS: readonly NetworkVariableKind[] = ['number', 'boolean', 'string'];
export const VARIABLE_KIND_LABEL: Record<NetworkVariableKind, string> = {
    number: 'Número',
    boolean: 'Sim ou não',
    string: 'Texto',
};
export const MAX_NETWORK_VARIABLES = 32;
export const MAX_VARIABLE_NAME_LENGTH = 32;
export const MAX_VARIABLE_TEXT_LENGTH = 256;
export const MAX_RELEVANCE_RADIUS = 10000;
export const MAX_OBJECT_SPEED = 1000;
const DEFAULT_RELEVANCE_RADIUS = 60;
const FORBIDDEN_NAME_CHARACTERS = /[^a-zA-Z0-9_]/g;
const DEFAULT_VARIABLE_VALUE: Record<NetworkVariableKind, NetworkVariableValue> = { number: 0, boolean: false, string: '' };
export function createNetworkObjectSettings(): NetworkObjectSettings {
    return {
        spawn: 'scene',
        authority: 'server',
        syncScale: false,
        relevance: 'always',
        relevanceRadius: DEFAULT_RELEVANCE_RADIUS,
        observer: false,
        ownerLeftPolicy: 'despawn',
        transferable: false,
        maxSpeed: 0,
        remoteScripts: false,
        variables: [],
    };
}
export function createPlayerObjectSettings(): NetworkObjectSettings {
    return { ...createNetworkObjectSettings(), spawn: 'player', authority: 'owner', observer: true };
}
export function cloneNetworkObjectSettings(settings: NetworkObjectSettings): NetworkObjectSettings {
    return { ...settings, variables: settings.variables.map((variable) => ({ ...variable })) };
}
export function variableKindOf(value: NetworkVariableValue): NetworkVariableKind {
    return typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : 'string';
}
export function defaultVariableValue(kind: NetworkVariableKind): NetworkVariableValue {
    return DEFAULT_VARIABLE_VALUE[kind];
}
export function normalizeVariableName(name: string): string {
    return name.replace(FORBIDDEN_NAME_CHARACTERS, '').slice(0, MAX_VARIABLE_NAME_LENGTH);
}
function normalizeVariableValue(value: unknown): NetworkVariableValue {
    if (typeof value === 'boolean')
        return value;
    if (typeof value === 'number')
        return Number.isFinite(value) ? value : 0;
    return typeof value === 'string' ? value.slice(0, MAX_VARIABLE_TEXT_LENGTH) : 0;
}
function normalizeVariables(variables: readonly Partial<NetworkVariableSettings>[]): NetworkVariableSettings[] {
    const byName = new Map<string, NetworkVariableSettings>();
    for (const variable of variables.slice(0, MAX_NETWORK_VARIABLES)) {
        const name = normalizeVariableName(String(variable.name ?? ''));
        if (!name || byName.has(name))
            continue;
        byName.set(name, { name, initial: normalizeVariableValue(variable.initial), writer: variable.writer === 'owner' ? 'owner' : 'server' });
    }
    return Array.from(byName.values());
}
function clamp(value: number, min: number, max: number, fallback: number): number {
    return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}
export function normalizeNetworkObjectSettings(settings: NetworkObjectSettings): NetworkObjectSettings {
    const defaults = createNetworkObjectSettings();
    return {
        spawn: NETWORK_SPAWN_MODES.includes(settings.spawn) ? settings.spawn : defaults.spawn,
        authority: AUTHORITY_MODES.includes(settings.authority) ? settings.authority : defaults.authority,
        syncScale: settings.syncScale === true,
        relevance: RELEVANCE_MODES.includes(settings.relevance) ? settings.relevance : defaults.relevance,
        relevanceRadius: clamp(Number(settings.relevanceRadius), 1, MAX_RELEVANCE_RADIUS, defaults.relevanceRadius),
        observer: settings.observer === true,
        ownerLeftPolicy: OWNER_LEFT_POLICIES.includes(settings.ownerLeftPolicy) ? settings.ownerLeftPolicy : defaults.ownerLeftPolicy,
        transferable: settings.transferable === true,
        maxSpeed: clamp(Number(settings.maxSpeed), 0, MAX_OBJECT_SPEED, defaults.maxSpeed),
        remoteScripts: settings.remoteScripts === true,
        variables: normalizeVariables(Array.isArray(settings.variables) ? settings.variables : []),
    };
}
export function uniqueVariableName(variables: readonly NetworkVariableSettings[], desired: string): string {
    const taken = new Set(variables.map((variable) => variable.name));
    const base = normalizeVariableName(desired) || 'variavel';
    if (!taken.has(base))
        return base;
    for (let suffix = 2;; suffix++) {
        const candidate = `${base.slice(0, MAX_VARIABLE_NAME_LENGTH - String(suffix).length)}${suffix}`;
        if (!taken.has(candidate))
            return candidate;
    }
}
export function relevanceOf(settings: NetworkObjectSettings): Relevance {
    return settings.relevance === 'distance' ? { mode: 'distance', radius: settings.relevanceRadius } : { mode: settings.relevance };
}
export function variableDefinitionsOf(settings: NetworkObjectSettings): VariableDefinition[] {
    return settings.variables.map(({ name, initial, writer }) => ({ name, initial, writer }));
}
