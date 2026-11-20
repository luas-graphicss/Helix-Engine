import type { NetValue } from '../../wire/net-value';
import { createUniqueJoinCode, normalizeJoinCode } from '../join-code';
import type { ServiceMember, ServiceMethod, ServiceModule } from '../service-backend';
import { readInteger, requireRecord } from '../service-params';
import { ServiceError } from '../service-protocol';
export interface RelayAllocation {
    readonly code: string;
    readonly ownerId: string;
    readonly maxConnections: number;
    readonly createdAt: number;
    claimed: boolean;
}
export const MAX_RELAY_CONNECTIONS = 255;
const UNCLAIMED_LIFETIME_MS = 60000;
export class RelayDirectory implements ServiceModule {
    readonly methods: Readonly<Record<string, ServiceMethod>>;
    private readonly allocations = new Map<string, RelayAllocation>();
    constructor(private readonly clock: () => number, private readonly maxAllocations: number) {
        this.methods = {
            'relay.allocate': (member, params) => this.allocate(member, readInteger(requireRecord(params), 'maxPlayers', { min: 1, max: MAX_RELAY_CONNECTIONS, fallback: 4 })),
        };
    }
    get count(): number {
        return this.allocations.size;
    }
    find(code: string): RelayAllocation | undefined {
        return this.allocations.get(normalizeJoinCode(code));
    }
    release(code: string): void {
        this.allocations.delete(code);
    }
    memberLeft(member: ServiceMember): void {
        for (const allocation of this.allocations.values())
            if (allocation.ownerId === member.id && !allocation.claimed)
                this.allocations.delete(allocation.code);
    }
    expire(): void {
        const now = this.clock();
        for (const allocation of this.allocations.values())
            if (!allocation.claimed && now - allocation.createdAt > UNCLAIMED_LIFETIME_MS)
                this.allocations.delete(allocation.code);
    }
    private allocate(member: ServiceMember, maxPlayers: number): NetValue {
        if (this.allocations.size >= this.maxAllocations)
            throw new ServiceError('limit', 'o relay chegou ao máximo de sessões');
        const code = createUniqueJoinCode((candidate) => this.allocations.has(candidate));
        this.allocations.set(code, { code, ownerId: member.id, maxConnections: maxPlayers, createdAt: this.clock(), claimed: false });
        return { joinCode: code, maxPlayers };
    }
}
