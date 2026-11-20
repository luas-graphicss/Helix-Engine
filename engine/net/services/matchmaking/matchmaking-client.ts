import type { NetValue } from '../../wire/net-value';
import { SERVICE_DISCONNECTED_EVENT, type ServiceClient } from '../service-client';
import { isNetRecord } from '../service-params';
import { ServiceError } from '../service-protocol';
import { MATCH_EVENT, parseMatchFound, type MatchFound } from './matchmaking-types';
export interface MatchSearch {
    readonly skill?: number;
    readonly party?: boolean;
}
interface ActiveSearch {
    readonly resolve: (match: MatchFound) => void;
    readonly reject: (error: ServiceError) => void;
}
export class MatchmakingClient {
    private search: ActiveSearch | null = null;
    private readonly matchListeners = new Set<(match: MatchFound) => void>();
    constructor(private readonly service: ServiceClient) {
        service.on(MATCH_EVENT.found, (payload) => this.handleFound(payload));
        service.on(MATCH_EVENT.expired, (payload) => this.fail('timeout', isNetRecord(payload) && typeof payload.reason === 'string' ? payload.reason : ''));
        service.on(SERVICE_DISCONNECTED_EVENT, () => this.fail('disconnected', ''));
    }
    get isSearching(): boolean {
        return this.search !== null;
    }
    async find(queue: string, options: MatchSearch = {}): Promise<MatchFound> {
        if (this.search)
            throw new ServiceError('conflict', 'já existe uma busca de partida em andamento');
        const found = new Promise<MatchFound>((resolve, reject) => {
            this.search = { resolve, reject };
        });
        try {
            await this.service.request('match.find', { queue, skill: options.skill ?? 0, party: options.party ?? false });
        }
        catch (error) {
            this.search = null;
            throw error;
        }
        return found;
    }
    async cancel(): Promise<void> {
        await this.service.request('match.cancel');
        this.fail('conflict', 'busca cancelada');
    }
    onMatched(listener: (match: MatchFound) => void): () => void {
        this.matchListeners.add(listener);
        return () => {
            this.matchListeners.delete(listener);
        };
    }
    private handleFound(payload: NetValue): void {
        const match = parseMatchFound(payload);
        if (!match)
            return;
        const { search } = this;
        this.search = null;
        search?.resolve(match);
        for (const listener of Array.from(this.matchListeners))
            listener(match);
    }
    private fail(code: 'timeout' | 'disconnected' | 'conflict', message: string): void {
        const { search } = this;
        this.search = null;
        search?.reject(new ServiceError(code, message));
    }
}
