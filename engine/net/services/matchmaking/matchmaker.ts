import { createSessionToken } from '../../session/session-token';
import type { NetValue } from '../../wire/net-value';
import type { ServiceMember, ServiceMethod, ServiceModule } from '../service-backend';
import { readFlag, readText, requireRecord, type NetRecord } from '../service-params';
import { ServiceError } from '../service-protocol';
import { sessionTicketToValue, type SessionAllocator } from '../session-ticket';
import { MATCH_EVENT, MAX_QUEUE_NAME_LENGTH, type QueueConfig } from './matchmaking-types';
interface Ticket {
    readonly id: string;
    readonly queue: QueueConfig;
    readonly members: readonly ServiceMember[];
    readonly skill: number;
    readonly createdAt: number;
}
const EXPIRY_FACTOR = 2;
const MAX_SKILL = 100000;
function readSkill(params: NetRecord): number {
    const { skill } = params;
    if (skill === undefined)
        return 0;
    if (typeof skill !== 'number' || Math.abs(skill) > MAX_SKILL)
        throw new ServiceError('invalid', `"skill" deve ser um número entre -${MAX_SKILL} e ${MAX_SKILL}`);
    return skill;
}
function assignTeams(queue: QueueConfig, tickets: readonly Ticket[]): Map<string, number> {
    const sizes = new Array<number>(queue.teamCount).fill(0);
    const strength = new Array<number>(queue.teamCount).fill(0);
    const teams = new Map<string, number>();
    for (const ticket of tickets.toSorted((a, b) => b.skill - a.skill)) {
        let chosen = -1;
        for (let team = 0; team < queue.teamCount; team++) {
            if (sizes[team] + ticket.members.length > queue.teamSize)
                continue;
            if (chosen < 0 || sizes[team] < sizes[chosen] || (sizes[team] === sizes[chosen] && strength[team] < strength[chosen]))
                chosen = team;
        }
        const team = Math.max(0, chosen);
        sizes[team] += ticket.members.length;
        strength[team] += ticket.skill * ticket.members.length;
        for (const member of ticket.members)
            teams.set(member.id, team);
    }
    return teams;
}
export class Matchmaker implements ServiceModule {
    readonly methods: Readonly<Record<string, ServiceMethod>>;
    private readonly queues = new Map<string, QueueConfig>();
    private readonly tickets = new Map<string, Ticket>();
    private readonly ticketOfMember = new Map<string, Ticket>();
    constructor(queues: readonly QueueConfig[], private readonly clock: () => number, private readonly partyOf: (member: ServiceMember) => ServiceMember[], private readonly allocateSession: SessionAllocator) {
        for (const queue of queues)
            this.queues.set(queue.name, queue);
        this.methods = {
            'match.find': (member, params) => this.find(member, requireRecord(params)),
            'match.cancel': (member) => this.cancel(member),
            'match.queues': () => Array.from(this.queues.values(), (queue) => ({ name: queue.name, teamSize: queue.teamSize, teamCount: queue.teamCount })),
        };
    }
    get waitingCount(): number {
        return this.ticketOfMember.size;
    }
    memberLeft(member: ServiceMember): void {
        const ticket = this.ticketOfMember.get(member.id);
        if (ticket)
            this.dissolve(ticket, MATCH_EVENT.expired, { reason: 'um membro do grupo saiu' }, member.id);
    }
    update(): void {
        const now = this.clock();
        for (const queue of this.queues.values())
            this.matchQueue(queue, now);
    }
    private find(member: ServiceMember, params: NetRecord): NetValue {
        const queue = this.queues.get(readText(params, 'queue', { maxLength: MAX_QUEUE_NAME_LENGTH }));
        if (!queue)
            throw new ServiceError('not-found', 'essa fila não existe neste servidor');
        const members = readFlag(params, 'party', false) ? this.partyOf(member) : [member];
        if (members.length > queue.teamSize)
            throw new ServiceError('invalid', `o grupo tem ${members.length} jogadores e o time da fila comporta ${queue.teamSize}`);
        if (members.some((entry) => this.ticketOfMember.has(entry.id)))
            throw new ServiceError('conflict', 'alguém do grupo já está procurando partida');
        const ticket: Ticket = { id: createSessionToken(), queue, members, skill: readSkill(params), createdAt: this.clock() };
        this.tickets.set(ticket.id, ticket);
        for (const entry of members)
            this.ticketOfMember.set(entry.id, ticket);
        return { ticketId: ticket.id, queue: queue.name, players: members.length };
    }
    private cancel(member: ServiceMember): NetValue {
        const ticket = this.ticketOfMember.get(member.id);
        if (!ticket)
            return false;
        this.dissolve(ticket, MATCH_EVENT.expired, { reason: 'busca cancelada' }, member.id);
        return true;
    }
    private matchQueue(queue: QueueConfig, now: number): void {
        const waiting = Array.from(this.tickets.values()).filter((ticket) => ticket.queue === queue).sort((a, b) => a.createdAt - b.createdAt);
        const capacity = queue.teamSize * queue.teamCount;
        for (const anchor of waiting) {
            if (!this.tickets.has(anchor.id))
                continue;
            const waitedSeconds = (now - anchor.createdAt) / 1000;
            const group = this.gather(anchor, waiting, capacity, queue.skillWindow + queue.skillGrowthPerSecond * waitedSeconds);
            const players = group.reduce((total, ticket) => total + ticket.members.length, 0);
            if (players === capacity || (waitedSeconds >= queue.maxWaitSeconds && players >= queue.minPlayers))
                this.form(queue, group);
            else if (waitedSeconds >= queue.maxWaitSeconds * EXPIRY_FACTOR)
                this.dissolve(anchor, MATCH_EVENT.expired, { reason: 'nenhuma partida no tempo da fila' }, null);
        }
    }
    private gather(anchor: Ticket, waiting: readonly Ticket[], capacity: number, window: number): Ticket[] {
        const group = [anchor];
        let players = anchor.members.length;
        for (const candidate of waiting) {
            if (players === capacity)
                break;
            if (candidate === anchor || !this.tickets.has(candidate.id) || players + candidate.members.length > capacity || Math.abs(candidate.skill - anchor.skill) > window)
                continue;
            group.push(candidate);
            players += candidate.members.length;
        }
        return group;
    }
    private form(queue: QueueConfig, group: readonly Ticket[]): void {
        const teams = assignTeams(queue, group);
        const members = group.flatMap((ticket) => ticket.members);
        const players = members.map((member) => ({ id: member.id, name: member.name, team: teams.get(member.id) ?? 0 }));
        const matchId = createSessionToken();
        const session = sessionTicketToValue({ mode: 'dedicated', sessionId: this.allocateSession(queue.teamSize * queue.teamCount) });
        for (const ticket of group)
            this.forget(ticket);
        for (const member of members)
            member.notify(MATCH_EVENT.found, { matchId, queue: queue.name, team: teams.get(member.id) ?? 0, players, session });
    }
    private dissolve(ticket: Ticket, event: string, payload: NetValue, silentMemberId: string | null): void {
        this.forget(ticket);
        for (const member of ticket.members)
            if (member.id !== silentMemberId)
                member.notify(event, payload);
    }
    private forget(ticket: Ticket): void {
        this.tickets.delete(ticket.id);
        for (const member of ticket.members)
            this.ticketOfMember.delete(member.id);
    }
}
