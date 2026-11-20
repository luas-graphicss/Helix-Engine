import { TokenBucket } from '../rpc/token-bucket';
import { createSessionToken } from '../session/session-token';
import type { NetValue } from '../wire/net-value';
import { readText, requireRecord } from './service-params';
import { ServiceError, parseServiceRequest, type ServiceReply, type ServiceRequest } from './service-protocol';
import type { TextChannel } from './text-channel';
export interface ServiceMember {
    readonly id: string;
    readonly name: string;
    notify(event: string, payload: NetValue): void;
}
export type ServiceMethod = (member: ServiceMember, params: NetValue) => NetValue;
export interface ServiceModule {
    readonly methods: Readonly<Record<string, ServiceMethod>>;
    memberLeft(member: ServiceMember): void;
}
const HELLO_METHOD = 'hello';
const MAX_MEMBER_NAME_LENGTH = 32;
const REQUESTS_PER_SECOND = 20;
const MAX_MALFORMED_FRAMES = 8;
class MemberSession implements ServiceMember {
    readonly id = createSessionToken();
    readonly bucket = new TokenBucket(REQUESTS_PER_SECOND, REQUESTS_PER_SECOND * 2);
    name = '';
    greeted = false;
    malformed = 0;
    constructor(private readonly channel: TextChannel) { }
    notify(event: string, payload: NetValue): void {
        if (this.channel.isOpen)
            this.channel.send(JSON.stringify({ event, payload }));
    }
    reply(reply: ServiceReply): void {
        if (this.channel.isOpen)
            this.channel.send(JSON.stringify(reply));
    }
    drop(): void {
        this.channel.close();
    }
}
export class ServiceBackend {
    private readonly sessions = new Set<MemberSession>();
    private readonly methods = new Map<string, ServiceMethod>();
    constructor(private readonly modules: readonly ServiceModule[], private readonly clock: () => number) {
        for (const module of modules)
            for (const [name, method] of Object.entries(module.methods))
                this.methods.set(name, method);
    }
    get memberCount(): number {
        return this.sessions.size;
    }
    connect(channel: TextChannel): void {
        const session = new MemberSession(channel);
        this.sessions.add(session);
        channel.attach({
            text: (message) => this.handleText(session, message),
            closed: () => this.handleClosed(session),
        });
    }
    close(): void {
        for (const session of Array.from(this.sessions))
            session.drop();
    }
    private handleClosed(session: MemberSession): void {
        if (!this.sessions.delete(session) || !session.greeted)
            return;
        for (const module of this.modules)
            module.memberLeft(session);
    }
    private handleText(session: MemberSession, message: string): void {
        const request = parseServiceRequest(message);
        if (!request) {
            session.malformed++;
            if (session.malformed > MAX_MALFORMED_FRAMES)
                session.drop();
            return;
        }
        session.reply(this.answer(session, request));
    }
    private answer(session: MemberSession, request: ServiceRequest): ServiceReply {
        try {
            return { id: request.id, ok: true, value: this.execute(session, request) };
        }
        catch (error) {
            if (!(error instanceof ServiceError))
                throw error;
            return { id: request.id, ok: false, code: error.code, message: error.message };
        }
    }
    private execute(session: MemberSession, request: ServiceRequest): NetValue {
        if (!session.bucket.tryTake(this.clock()))
            throw new ServiceError('limit', 'pedidos demais por segundo');
        if (request.method === HELLO_METHOD)
            return this.greet(session, request.params);
        if (!session.greeted)
            throw new ServiceError('forbidden', 'apresente-se antes de usar os serviços');
        const method = this.methods.get(request.method);
        if (!method)
            throw new ServiceError('unknown-method', request.method);
        return method(session, request.params);
    }
    private greet(session: MemberSession, params: NetValue): NetValue {
        session.name = readText(requireRecord(params), 'name', { maxLength: MAX_MEMBER_NAME_LENGTH });
        session.greeted = true;
        return { memberId: session.id, name: session.name };
    }
}
