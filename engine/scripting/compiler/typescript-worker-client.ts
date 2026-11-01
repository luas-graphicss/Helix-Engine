import type TS from 'typescript';
import type { InstrumentOutput } from './debug-instrument';
import { ScriptProjectIndex, type ProjectScript } from './project-index';
import type { DecodedSourceMap } from './source-map';
import type { FormatOptions, TypeScriptMutation, TypeScriptQuery, TypeScriptReply, TypeScriptRequest, TypeScriptResults } from './typescript-protocol';
import type { TypeScriptCheck, TypeScriptEmit } from './typescript-service';
export class TypeScriptWorkerProject {
    private readonly index = new ScriptProjectIndex();
    private readonly pending = new Map<number, {
        resolve(value: unknown): void;
        reject(cause: Error): void;
    }>();
    private nextId = 1;
    private worker: Worker | null = null;
    private failure: Error | null = null;
    version: string | null = null;
    async ready(): Promise<void> {
        const { version } = await this.query({ kind: 'init' });
        this.version = version;
    }
    get scriptNames(): string[] {
        return this.index.scriptNames;
    }
    setScript(script: ProjectScript): boolean {
        const changed = this.index.setScript(script);
        if (changed)
            this.mutate({ kind: 'set', script });
        return changed;
    }
    removeScript(assetId: string): boolean {
        const changed = this.index.removeScript(assetId);
        if (changed)
            this.mutate({ kind: 'remove', assetId });
        return changed;
    }
    retainOnly(assetIds: ReadonlySet<string>): boolean {
        const changed = this.index.retainOnly(assetIds);
        if (changed)
            this.mutate({ kind: 'retainOnly', assetIds: Array.from(assetIds) });
        return changed;
    }
    has(assetId: string): boolean {
        return this.index.has(assetId);
    }
    pathOf(assetId: string): string | null {
        return this.index.pathOf(assetId);
    }
    assetOfPath(path: string): {
        assetId: string;
        name: string;
    } | null {
        return this.index.assetOfPath(path);
    }
    textOf(path: string): string | null {
        return this.index.textOf(path);
    }
    fetchText(path: string): Promise<string | null> {
        const local = this.index.textOf(path);
        return local !== null ? Promise.resolve(local) : this.query({ kind: 'text', path });
    }
    clear(): Promise<void> {
        this.index.retainOnly(new Set());
        return this.query({ kind: 'clear' }).then(() => undefined);
    }
    resolveSpecifier(specifier: string): {
        assetId: string;
        path: string;
        name: string;
    } | null {
        return this.index.resolveSpecifier(specifier);
    }
    check(assetId: string): Promise<TypeScriptCheck> {
        return this.query({ kind: 'check', assetId });
    }
    compile(assetId: string): Promise<TypeScriptEmit> {
        return this.query({ kind: 'compile', assetId });
    }
    dependenciesOf(assetId: string): Promise<readonly string[]> {
        return this.query({ kind: 'dependencies', assetId });
    }
    completions(path: string, pos: number, triggerCharacter: '.' | null): Promise<TS.WithMetadata<TS.CompletionInfo> | null> {
        return this.query({ kind: 'completions', path, pos, triggerCharacter });
    }
    completionDetails(path: string, pos: number, entry: Pick<TS.CompletionEntry, 'name' | 'source' | 'data'>, format: FormatOptions): Promise<TS.CompletionEntryDetails | null> {
        return this.query({ kind: 'completionDetails', path, pos, name: entry.name, source: entry.source, data: entry.data, format });
    }
    quickInfo(path: string, pos: number): Promise<TS.QuickInfo | null> {
        return this.query({ kind: 'quickInfo', path, pos });
    }
    signatureHelp(path: string, pos: number, reason: TS.SignatureHelpTriggerReason): Promise<TS.SignatureHelpItems | null> {
        return this.query({ kind: 'signatureHelp', path, pos, reason });
    }
    formattingEdits(path: string, format: FormatOptions): Promise<readonly TS.TextChange[]> {
        return this.query({ kind: 'format', path, format });
    }
    definitions(path: string, pos: number): Promise<readonly TS.DefinitionInfo[]> {
        return this.query({ kind: 'definition', path, pos });
    }
    renameInfo(path: string, pos: number): Promise<TS.RenameInfo> {
        return this.query({ kind: 'renameInfo', path, pos });
    }
    renameLocations(path: string, pos: number): Promise<readonly TS.RenameLocation[]> {
        return this.query({ kind: 'renameLocations', path, pos });
    }
    instrument(code: string, sourceMap: DecodedSourceMap | null, reserved: readonly string[]): Promise<InstrumentOutput | null> {
        return this.query({ kind: 'instrument', code, sourceMap, reserved });
    }
    private mutate(mutation: TypeScriptMutation): void {
        if (this.failure)
            return;
        this.ensureWorker().postMessage(mutation satisfies TypeScriptRequest);
    }
    private query<Q extends TypeScriptQuery>(query: Q): Promise<TypeScriptResults[Q['kind']]> {
        if (this.failure)
            return Promise.reject(this.failure);
        const id = this.nextId++;
        const worker = this.ensureWorker();
        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
            worker.postMessage({ ...query, id } satisfies TypeScriptRequest);
        });
    }
    private ensureWorker(): Worker {
        if (this.worker)
            return this.worker;
        if (typeof Worker === 'undefined')
            throw new Error('este ambiente não tem Web Workers; o compilador TypeScript precisa deles.');
        const worker = new Worker(new URL('./typescript-worker.ts', import.meta.url), { type: 'module', name: 'helix-typescript' });
        worker.onmessage = (event: MessageEvent<TypeScriptReply>) => {
            const reply = event.data;
            const pending = this.pending.get(reply.id);
            if (!pending)
                return;
            this.pending.delete(reply.id);
            if (reply.ok)
                pending.resolve(reply.result);
            else
                pending.reject(new Error(reply.error));
        };
        worker.onerror = (event) => {
            const cause = new Error(event.message || 'o worker do TypeScript falhou.');
            this.fail(cause);
        };
        this.worker = worker;
        return worker;
    }
    private fail(cause: Error): void {
        this.failure = cause;
        for (const pending of this.pending.values())
            pending.reject(cause);
        this.pending.clear();
        this.worker?.terminate();
        this.worker = null;
        if (singleton === this)
            singleton = null;
    }
}
let singleton: TypeScriptWorkerProject | null = null;
let loading: Promise<TypeScriptWorkerProject> | null = null;
export function loadTypeScriptProject(): Promise<TypeScriptWorkerProject> {
    if (singleton)
        return Promise.resolve(singleton);
    if (!loading) {
        const project = new TypeScriptWorkerProject();
        loading = project
            .ready()
            .then(() => {
            singleton = project;
            return project;
        })
            .finally(() => {
            loading = null;
        });
    }
    return loading;
}
export function isTypeScriptProjectReady(): boolean {
    return singleton !== null;
}
