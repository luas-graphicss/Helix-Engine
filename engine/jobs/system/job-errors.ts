import type { SerializedJobError } from '../protocol/job-messages';
export class JobCancelledError extends Error {
    constructor(readonly jobName: string, reason = 'foi cancelado') {
        super(`Job "${jobName}" não terminou: ${reason}.`);
        this.name = 'JobCancelledError';
    }
}
export class JobFailedError extends Error {
    constructor(readonly jobName: string, readonly detail: SerializedJobError) {
        super(`Job "${jobName}" falhou: ${detail.message}`);
        this.name = 'JobFailedError';
    }
}
export class JobTimeoutError extends Error {
    constructor(readonly jobName: string, readonly timeoutMs: number) {
        super(`Job "${jobName}" passou do tempo limite de ${timeoutMs} ms e a thread dele foi reiniciada.`);
        this.name = 'JobTimeoutError';
    }
}
export class JobQueueFullError extends Error {
    constructor(readonly limit: number) {
        super(`A fila de jobs está cheia (${limit} jobs em andamento). Aguarde os jobs atuais ou aumente o limite no painel Jobs.`);
        this.name = 'JobQueueFullError';
    }
}
