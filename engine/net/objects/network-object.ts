import { cloneTransformState, createTransformState, type TransformState } from '../sync/transform-state';
import { ALWAYS_RELEVANT, type Relevance } from './relevance';
import { VariableSet, type VariableDefinition } from './variable-set';
export const SERVER_OWNER_ID = 0;
export const DYNAMIC_OBJECT_ID_START = 1 << 20;
export type AuthorityMode = 'server' | 'owner';
export type OwnerLeftPolicy = 'despawn' | 'server';
export interface NetworkObjectInit {
    readonly id: number;
    readonly kind?: string;
    readonly sceneId?: number;
    readonly ownerId?: number;
    readonly authority?: AuthorityMode;
    readonly transform?: TransformState;
    readonly variables?: readonly VariableDefinition[];
    readonly syncScale?: boolean;
    readonly relevance?: Relevance;
    readonly observer?: boolean;
    readonly ownerLeftPolicy?: OwnerLeftPolicy;
    readonly maxSpeed?: number;
}
export class NetworkObject {
    readonly id: number;
    readonly kind: string;
    readonly sceneId: number;
    readonly authority: AuthorityMode;
    readonly transform: TransformState;
    readonly variables: VariableSet;
    readonly syncScale: boolean;
    readonly relevance: Relevance;
    readonly observer: boolean;
    readonly ownerLeftPolicy: OwnerLeftPolicy;
    readonly maxSpeed: number;
    ownerId: number;
    constructor(init: NetworkObjectInit) {
        this.id = init.id;
        this.kind = init.kind ?? '';
        this.sceneId = init.sceneId ?? 0;
        this.ownerId = init.ownerId ?? SERVER_OWNER_ID;
        this.authority = init.authority ?? 'server';
        this.transform = init.transform ? cloneTransformState(init.transform) : createTransformState();
        this.variables = new VariableSet(init.variables ?? []);
        this.syncScale = init.syncScale ?? false;
        this.relevance = init.relevance ?? ALWAYS_RELEVANT;
        this.observer = init.observer ?? false;
        this.ownerLeftPolicy = init.ownerLeftPolicy ?? 'despawn';
        this.maxSpeed = init.maxSpeed ?? 0;
    }
    isSimulatedBy(clientId: number): boolean {
        return this.authority === 'owner' ? this.ownerId === clientId : clientId === SERVER_OWNER_ID;
    }
}
