import type { ServiceClient } from '../service-client';
import { isNetRecord } from '../service-params';
import { ServiceError } from '../service-protocol';
export async function allocateRelay(service: ServiceClient, maxPlayers: number): Promise<string> {
    const reply = await service.request('relay.allocate', { maxPlayers });
    if (!isNetRecord(reply) || typeof reply.joinCode !== 'string')
        throw new ServiceError('invalid', 'o serviço não devolveu o código do relay');
    return reply.joinCode;
}
