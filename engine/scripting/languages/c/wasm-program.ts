import { HANDLE_BASE, HandleError, HandleTable, HandleType, type HandleTableOptions } from './wasm-handles';
import { MinimalWasi, WasmExit } from './wasm-wasi';
export interface WasmProgramHost {
    readonly root: unknown;
    readonly script: unknown;
    readonly self: unknown;
    require(name: string): unknown;
    log(level: number, message: string): void;
    write(fd: 1 | 2, line: string): void;
    now(): number;
    enter?(): void;
    exit?(): void;
    writeTypedArray?: HandleTableOptions['writeTypedArray'];
}
export class WasmScriptThrow extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'WasmScriptThrow';
    }
}
type WasmFunction = (...args: number[]) => number | void;
interface CallbackRecord {
    readonly destructor: number;
    readonly userdata: number;
}
const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
const CALLBACK_INVOKE = '__hx_invoke_callback';
const CALLBACK_DROP = '__hx_drop_callback';
export class WasmProgram {
    readonly handles: HandleTable;
    readonly exports: Record<string, WebAssembly.ExportValue>;
    private readonly wasi: MinimalWasi;
    private readonly memory: WebAssembly.Memory;
    private readonly table: WebAssembly.Table | null;
    private readonly stackPointer: WebAssembly.Global | null;
    private readonly encoder = new TextEncoder();
    private readonly decoder = new TextDecoder();
    private readonly registry: FinalizationRegistry<CallbackRecord | number> | null;
    private depth = 0;
    private disposed = false;
    private faultCell = -1;
    private faultMessage = '';
    exitCode: number | null = null;
    constructor(module: WebAssembly.Module, private readonly host: WasmProgramHost) {
        this.handles = new HandleTable({ writeTypedArray: host.writeTypedArray });
        this.wasi = new MinimalWasi({ write: (fd, line) => host.write(fd, line) });
        const wasiNames = WebAssembly.Module.imports(module)
            .filter((entry) => entry.module === 'wasi_snapshot_preview1' || entry.module === 'wasi_unstable')
            .map((entry) => entry.name);
        const wasiImports = this.wasi.imports(wasiNames);
        const helixImports = this.helixImports();
        const instance = new WebAssembly.Instance(module, {
            wasi_snapshot_preview1: wasiImports,
            wasi_unstable: wasiImports,
            helix: helixImports,
            env: helixImports,
        });
        this.exports = instance.exports as Record<string, WebAssembly.ExportValue>;
        const memory = this.exports.memory;
        if (!(memory instanceof WebAssembly.Memory))
            throw new Error('o módulo não exporta a memória (ligue com --export-dynamic).');
        this.memory = memory;
        this.wasi.attach(memory);
        const table = this.exports.__indirect_function_table;
        this.table = table instanceof WebAssembly.Table ? table : null;
        const stackPointer = this.exports.__stack_pointer;
        this.stackPointer = stackPointer instanceof WebAssembly.Global ? stackPointer : null;
        this.registry =
            typeof FinalizationRegistry === 'function'
                ? new FinalizationRegistry<CallbackRecord | number>((record) => {
                    if (typeof record === 'number')
                        this.dropDispatchedCallback(record);
                    else
                        this.destroyCallback(record);
                })
                : null;
    }
    get isDisposed(): boolean {
        return this.disposed;
    }
    get usesFaultCell(): boolean {
        return this.faultCell >= 0;
    }
    functionNames(): string[] {
        return Object.keys(this.exports).filter((name) => typeof this.exports[name] === 'function' && !INTERNAL_EXPORT.test(name));
    }
    hasFunction(name: string): boolean {
        return typeof this.exports[name] === 'function';
    }
    start(): number {
        const initialize = this.exports._initialize;
        const ctors = this.exports.__wasm_call_ctors;
        const main = this.exports.main;
        return this.enter(() => {
            if (typeof initialize === 'function') {
                ;
                (initialize as WasmFunction)();
                return 0;
            }
            if (typeof ctors === 'function')
                (ctors as WasmFunction)();
            if (typeof main !== 'function')
                return 0;
            const code = (main as WasmFunction)(0, 0);
            return typeof code === 'number' ? code : 0;
        });
    }
    invoke(name: string, args: readonly unknown[]): unknown {
        const fn = this.exports[name];
        if (typeof fn !== 'function')
            throw new HandleError(`${name} não é uma função exportada pelo script.`);
        return this.enter(() => {
            const converted = args.map((arg) => this.toWasm(arg));
            return (fn as WasmFunction)(...converted);
        });
    }
    invokeForValue(name: string, args: readonly unknown[]): unknown {
        const fn = this.exports[name];
        if (typeof fn !== 'function')
            throw new HandleError(`${name} não é uma função exportada pelo script.`);
        return this.enter(() => {
            const converted = args.map((arg) => this.toWasm(arg));
            const result = (fn as WasmFunction)(...converted);
            return typeof result === 'number' && result >= HANDLE_BASE && this.handles.has(result) ? this.handles.value(result) : result;
        });
    }
    dispose(): void {
        if (this.disposed)
            return;
        this.disposed = true;
        this.wasi.flush();
        this.handles.clear();
    }
    private enter<T>(fn: () => T): T {
        if (this.disposed)
            throw new HandleError('o script já foi encerrado.');
        if (this.exitCode !== null)
            throw new WasmExit(this.exitCode);
        this.depth++;
        this.handles.pushPool();
        this.host.enter?.();
        const savedStack = this.stackPointer?.value as number | undefined;
        try {
            return fn();
        }
        catch (cause) {
            if (cause instanceof WasmExit)
                this.exitCode = cause.code;
            if (this.stackPointer && savedStack !== undefined)
                this.stackPointer.value = savedStack;
            throw cause;
        }
        finally {
            this.host.exit?.();
            this.handles.popPool();
            this.depth--;
            if (this.depth === 0)
                this.wasi.flush();
        }
    }
    private toWasm(value: unknown): number {
        switch (typeof value) {
            case 'number':
                return value;
            case 'boolean':
                return value ? 1 : 0;
            case 'bigint':
                return Number(value);
            default:
                return this.handles.acquire(value);
        }
    }
    private readString(ptr: number, length: number): string {
        if (length === 0)
            return '';
        return this.decoder.decode(new Uint8Array(this.memory.buffer, ptr, length));
    }
    private writeString(text: string, ptr: number, capacity: number): number {
        const bytes = this.encoder.encode(text);
        if (capacity > 0) {
            const count = Math.min(bytes.length, capacity - 1);
            const target = new Uint8Array(this.memory.buffer, ptr, capacity);
            target.set(bytes.subarray(0, count));
            target[count] = 0;
        }
        return bytes.length;
    }
    private writeBytes(text: string, ptr: number, capacity: number): number {
        const bytes = this.encoder.encode(text);
        if (capacity > 0)
            new Uint8Array(this.memory.buffer, ptr, capacity).set(bytes.subarray(0, Math.min(bytes.length, capacity)));
        return bytes.length;
    }
    private readHandles(ptr: number, count: number): unknown[] {
        if (count <= 0)
            return [];
        const view = new Uint32Array(this.memory.buffer, ptr, count);
        const out = new Array<unknown>(count);
        for (let i = 0; i < count; i++)
            out[i] = this.handles.value(view[i]);
        return out;
    }
    private stringify(value: unknown): string {
        if (typeof value === 'string')
            return value;
        if (value === undefined)
            return 'undefined';
        if (value === null)
            return 'null';
        if (typeof value === 'object') {
            try {
                const text = String(value);
                return text === '[object Object]' ? JSON.stringify(value) ?? text : text;
            }
            catch {
                return '[objeto]';
            }
        }
        return String(value);
    }
    private fault(cause: unknown): void {
        if (!this.faultMessage)
            this.faultMessage = cause instanceof Error ? cause.message : String(cause);
        new DataView(this.memory.buffer).setUint32(this.faultCell, 1, true);
    }
    private takeFault(ptr: number, capacity: number): number {
        const message = this.faultMessage;
        this.faultMessage = '';
        if (this.faultCell >= 0)
            new DataView(this.memory.buffer).setUint32(this.faultCell, 0, true);
        return this.writeBytes(message, ptr, capacity);
    }
    private passesThrough(cause: unknown): boolean {
        if (cause instanceof WasmExit || cause instanceof WasmScriptThrow)
            return true;
        return cause instanceof Error && cause.name === 'TaskCancelledError';
    }
    private createCallback(fnIndex: number, userdata: number, destructor: number): (...args: unknown[]) => unknown {
        if (!this.table)
            throw new HandleError('o módulo não exporta a tabela de funções (ligue com --export-table).');
        const target = this.table.get(fnIndex) as ((userdata: number, args: number) => number) | null;
        if (typeof target !== 'function')
            throw new HandleError(`hx_function recebeu um ponteiro de função inválido (#${fnIndex}).`);
        const proxy = (...args: unknown[]): unknown => {
            if (this.disposed || this.exitCode !== null)
                return undefined;
            return this.enter(() => {
                const result = target(userdata, this.handles.acquire(args));
                return this.handles.value(result);
            });
        };
        Object.defineProperty(proxy, 'name', { value: `callback#${fnIndex}` });
        if (destructor !== 0 && this.registry)
            this.registry.register(proxy, { destructor, userdata });
        return proxy;
    }
    private destroyCallback(record: CallbackRecord): void {
        if (this.disposed || !this.table)
            return;
        const destructor = this.table.get(record.destructor) as ((userdata: number) => void) | null;
        if (typeof destructor !== 'function')
            return;
        try {
            destructor(record.userdata);
        }
        catch {
        }
    }
    private createDispatchedCallback(id: number): (...args: unknown[]) => unknown {
        const invoke = this.exports[CALLBACK_INVOKE];
        if (typeof invoke !== 'function')
            throw new HandleError(`o módulo não exporta ${CALLBACK_INVOKE}; o SDK da linguagem precisa estar ligado ao script.`);
        const target = invoke as (id: number, args: number) => number;
        const proxy = (...args: unknown[]): unknown => {
            if (this.disposed || this.exitCode !== null)
                return undefined;
            return this.enter(() => {
                const result = target(id, this.handles.acquire(args));
                return this.handles.value(result);
            });
        };
        Object.defineProperty(proxy, 'name', { value: `callback#${id}` });
        if (this.registry)
            this.registry.register(proxy, id);
        return proxy;
    }
    private dropDispatchedCallback(id: number): void {
        if (this.disposed)
            return;
        const drop = this.exports[CALLBACK_DROP];
        if (typeof drop !== 'function')
            return;
        try {
            ;
            (drop as WasmFunction)(id);
        }
        catch {
        }
    }
    private helixImports(): Record<string, (...args: never[]) => unknown> {
        const handles = this.handles;
        const host = this.host;
        const imports = {
            retain: (ref: number) => handles.retain(ref),
            release: (ref: number) => handles.release(ref),
            type: (ref: number) => handles.typeOf(ref),
            equals: (a: number, b: number) => (handles.equals(a, b) ? 1 : 0),
            root: () => handles.acquire(host.root),
            script: () => handles.acquire(host.script),
            self: () => handles.acquire(host.self),
            require: (ptr: number, length: number) => handles.acquire(host.require(this.readString(ptr, length))),
            number: (value: number) => handles.acquire(value),
            boolean: (value: number) => handles.acquire(value !== 0),
            string: (ptr: number, length: number) => handles.acquire(this.readString(ptr, length)),
            null: () => handles.acquire(null),
            array: () => handles.acquire([]),
            object: () => handles.acquire({}),
            function: (fnIndex: number, userdata: number, destructor: number) => handles.acquire(this.createCallback(fnIndex, userdata, destructor)),
            callback: (id: number) => handles.acquire(this.createDispatchedCallback(id)),
            pool: (ref: number) => handles.acquire(handles.value(ref)),
            to_number: (ref: number) => {
                const value = handles.value(ref);
                if (typeof value === 'number')
                    return value;
                if (typeof value === 'boolean')
                    return value ? 1 : 0;
                if (typeof value === 'bigint')
                    return Number(value);
                if (typeof value === 'string')
                    return Number(value);
                return Number.NaN;
            },
            to_boolean: (ref: number) => (handles.value(ref) ? 1 : 0),
            string_bytes: (ref: number) => this.encoder.encode(this.stringify(handles.value(ref))).length,
            string_copy: (ref: number, ptr: number, capacity: number) => this.writeString(this.stringify(handles.value(ref)), ptr, capacity),
            string_read: (ref: number, ptr: number, capacity: number) => this.writeBytes(this.stringify(handles.value(ref)), ptr, capacity),
            get: (object: number, ptr: number, length: number) => handles.acquire(handles.get(object, this.readString(ptr, length))),
            index: (object: number, index: number) => handles.acquire(handles.get(object, index)),
            set: (object: number, ptr: number, length: number, value: number) => handles.set(object, this.readString(ptr, length), handles.value(value)),
            set_index: (object: number, index: number, value: number) => handles.set(object, index, handles.value(value)),
            has: (object: number, ptr: number, length: number) => (handles.hasKey(object, this.readString(ptr, length)) ? 1 : 0),
            delete: (object: number, ptr: number, length: number) => handles.deleteKey(object, this.readString(ptr, length)),
            length: (object: number) => handles.length(object),
            keys: (object: number) => handles.acquire(handles.keys(object)),
            call: (fn: number, argsPtr: number, count: number) => handles.acquire(handles.call(fn, this.readHandles(argsPtr, count))),
            invoke: (object: number, ptr: number, length: number, argsPtr: number, count: number) => handles.acquire(handles.invoke(object, this.readString(ptr, length), this.readHandles(argsPtr, count))),
            construct: (ctor: number, argsPtr: number, count: number) => handles.acquire(handles.construct(ctor, this.readHandles(argsPtr, count))),
            log: (level: number, ptr: number, length: number) => host.log(Math.min(Math.max(level | 0, 0), LOG_LEVELS.length - 1), this.readString(ptr, length)),
            throw: (ptr: number, length: number) => {
                throw new WasmScriptThrow(this.readString(ptr, length));
            },
            now: () => host.now(),
            fault_cell: (ptr: number) => {
                this.faultCell = ptr >>> 0;
            },
            fault_take: (ptr: number, capacity: number) => this.takeFault(ptr, capacity),
        };
        const guarded: Record<string, (...args: never[]) => unknown> = {};
        for (const [name, fn] of Object.entries(imports)) {
            guarded[name] = (...args: never[]) => {
                try {
                    return (fn as (...args: never[]) => unknown)(...args);
                }
                catch (cause) {
                    if (this.faultCell < 0 || this.passesThrough(cause))
                        throw cause;
                    this.fault(cause);
                    return 0;
                }
            };
        }
        return guarded;
    }
}
export { HandleType, LOG_LEVELS };
const INTERNAL_EXPORT = /^(__|_Z|_start$|_initialize$|main$|memory$|malloc$|free$|calloc$|realloc$|aligned_alloc$|posix_memalign$|errno$|environ$|cabi_realloc$)/;
