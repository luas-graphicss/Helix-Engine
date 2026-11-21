import { JobSystem } from '@/engine/jobs/system/job-system';
import { detectThreadCapabilities } from '@/engine/jobs/threads/thread-capabilities';
import { spawnJobThread } from '@/engine/jobs/worker/spawn-job-thread';
import type { RuntimeHost } from './runtime-host';
const LOG_SOURCE = 'Jobs';
export function createRuntimeJobSystem(host: Pick<RuntimeHost, 'log'>): JobSystem {
    return new JobSystem({
        capabilities: detectThreadCapabilities(),
        spawnThread: spawnJobThread,
        onFallback: (reason) => host.log('warn', `As threads de jobs não puderam ser usadas (${reason}). Os jobs passam a rodar na thread principal.`, { source: LOG_SOURCE }),
    });
}
