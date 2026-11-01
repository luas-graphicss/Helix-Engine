import type { ToolchainCompileRequest, ToolchainCompileResult } from './clang-toolchain';
import type { ClangWorkerReply, ClangWorkerRequest } from './clang-worker';
export interface NativeCompiler {
    readonly version: string | null;
    load(): Promise<void>;
    compile(request: ToolchainCompileRequest): Promise<ToolchainCompileResult>;
}
interface Pending {
    resolve(reply: ClangWorkerReply): void;
    reject(cause: Error): void;
}
type WithoutId<T> = T extends {
    id: number;
} ? Omit<T, 'id'> : never;
export class ClangClient implements NativeCompiler {
    private worker: Worker | null = null;
    private readonly pending = new Map<number, Pending>();
    private nextId = 1;
    private loading: Promise<void> | null = null;
    private loadedVersion: string | null = null;
    constructor(private readonly baseUrl: string) { }
    get version(): string | null {
        return this.loadedVersion;
    }
    load(): Promise<void> {
        if (!this.loading) {
            this.loading = this.send({ kind: 'load', baseUrl: this.baseUrl })
                .then((reply) => {
                if (reply.kind !== 'load')
                    throw new Error('resposta inesperada do worker do clang.');
                this.loadedVersion = reply.version;
            })
                .catch((cause: unknown) => {
                this.loading = null;
                this.terminate();
                throw cause;
            });
        }
        return this.loading;
    }
    async compile(request: ToolchainCompileRequest): Promise<ToolchainCompileResult> {
        await this.load();
        const reply = await this.send({ kind: 'compile', request });
        if (reply.kind !== 'compile')
            throw new Error('resposta inesperada do worker do clang.');
        return reply.result;
    }
    private send(message: WithoutId<ClangWorkerRequest>): Promise<Extract<ClangWorkerReply, {
        ok: true;
    }>> {
        const id = this.nextId++;
        const worker = this.ensureWorker();
        return new Promise((resolve, reject) => {
            this.pending.set(id, {
                resolve: (reply) => {
                    if (reply.ok)
                        resolve(reply);
                    else
                        reject(new Error(reply.error));
                },
                reject,
            });
            worker.postMessage({ ...message, id } as ClangWorkerRequest);
        });
    }
    private ensureWorker(): Worker {
        if (this.worker)
            return this.worker;
        if (typeof Worker === 'undefined')
            throw new Error('este ambiente não tem Web Workers; a toolchain C/C++ precisa deles.');
        const worker = new Worker(new URL('./clang-worker.ts', import.meta.url), { type: 'module', name: 'helix-clang' });
        worker.onmessage = (event: MessageEvent<ClangWorkerReply>) => {
            const reply = event.data;
            const pending = this.pending.get(reply.id);
            if (!pending)
                return;
            this.pending.delete(reply.id);
            pending.resolve(reply);
        };
        worker.onerror = (event) => {
            const cause = new Error(event.message || 'o worker do clang falhou.');
            this.failAll(cause);
            this.terminate();
        };
        this.worker = worker;
        return worker;
    }
    private failAll(cause: Error): void {
        for (const pending of this.pending.values())
            pending.reject(cause);
        this.pending.clear();
    }
    private terminate(): void {
        this.worker?.terminate();
        this.worker = null;
        this.loading = null;
        this.loadedVersion = null;
    }
}
