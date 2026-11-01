import { formatValue } from '../runtime/script-console';
import { describeThrown, HelixError } from '../runtime/script-errors';
import { toQuat, toVec3 } from '../runtime/values';
import { isDataObject, isThenable, MAX_DATA_DEPTH } from './foreign-values';
export type ForeignPrimitive = string | number | boolean | undefined;
export type Encoded = ForeignPrimitive | {
    [key: string]: unknown;
} | unknown[];
export interface ForeignBridgeOptions {
    readonly kindKey: string;
    readonly indexBase: 0 | 1;
    readonly promises: 'pending' | 'inline';
    invokeCallback(id: number, args: readonly Encoded[]): unknown;
}
interface BoundFunction {
    readonly fn: (...args: unknown[]) => unknown;
    readonly receiver: object | undefined;
    bound: ((...args: unknown[]) => unknown) | null;
}
const MAX_COPIED_TYPED_ARRAY = 16;
const RECEIVERLESS: object = Object.freeze({});
export class ForeignBridge {
    private readonly objects = new Map<number, object>();
    private readonly ids = new Map<object, number>();
    private readonly functions = new Map<number, BoundFunction>();
    private readonly functionIds = new WeakMap<object, Map<(...args: unknown[]) => unknown, number>>();
    private readonly callbacks = new Map<number, (...args: unknown[]) => unknown>();
    private nextId = 1;
    private pendingPromise: PromiseLike<unknown> | null = null;
    constructor(private readonly options: ForeignBridgeOptions) { }
    get kindKey(): string {
        return this.options.kindKey;
    }
    get size(): number {
        return this.objects.size + this.functions.size;
    }
    ref(object: object): number {
        let id = this.ids.get(object);
        if (id === undefined) {
            id = this.nextId++;
            this.ids.set(object, id);
            this.objects.set(id, object);
        }
        return id;
    }
    objectOf(id: number): object {
        const object = this.objects.get(id);
        if (!object)
            throw new HelixError(`referência #${id} a um objeto que a engine já soltou (o jogo foi reiniciado?).`);
        return object;
    }
    private functionId(fn: (...args: unknown[]) => unknown, receiver: object | undefined): number {
        const owner = receiver ?? RECEIVERLESS;
        let table = this.functionIds.get(owner);
        if (!table) {
            table = new Map();
            this.functionIds.set(owner, table);
        }
        let id = table.get(fn);
        if (id === undefined) {
            id = this.nextId++;
            table.set(fn, id);
            this.functions.set(id, { fn, receiver, bound: null });
        }
        return id;
    }
    private functionOf(id: number): BoundFunction {
        const entry = this.functions.get(id);
        if (!entry)
            throw new HelixError(`função #${id} não existe mais nesta execução.`);
        return entry;
    }
    callbackProxy(id: number): (...args: unknown[]) => unknown {
        let proxy = this.callbacks.get(id);
        if (!proxy) {
            proxy = (...args: unknown[]) => this.options.invokeCallback(id, args.map((arg) => this.encode(arg)));
            Object.defineProperty(proxy, 'name', { value: `callback#${id}` });
            this.callbacks.set(id, proxy);
        }
        return proxy;
    }
    takePendingPromise(): PromiseLike<unknown> | null {
        const promise = this.pendingPromise;
        this.pendingPromise = null;
        return promise;
    }
    clear(): void {
        this.objects.clear();
        this.ids.clear();
        this.functions.clear();
        this.callbacks.clear();
        this.pendingPromise = null;
    }
    private descriptor(kind: string | number, fields?: Record<string, unknown>): {
        [key: string]: unknown;
    } {
        return { [this.options.kindKey]: kind, ...fields };
    }
    error(cause: unknown): {
        [key: string]: unknown;
    } {
        const message = describeThrown(cause);
        const name = cause instanceof Error && !(cause instanceof HelixError) && cause.name && cause.name !== 'Error' ? `${cause.name}: ` : '';
        return this.descriptor('err', { message: `${name}${message}`, name: cause instanceof Error ? cause.name : 'Error' });
    }
    encode(value: unknown): Encoded {
        if (isThenable(value))
            return this.awaitDescriptor(value);
        if (typeof value === 'function')
            return this.descriptor('fn', { id: this.functionId(value as (...args: unknown[]) => unknown, undefined) });
        if (typeof value !== 'object' || value === null)
            return encodePrimitive(value);
        if (this.isCopiable(value, 0))
            return this.descriptor('data', { value: this.copy(value, 0) });
        return this.descriptor(this.ref(value));
    }
    private encodeLive(value: unknown, receiver: object): Encoded {
        if (isThenable(value))
            return this.awaitDescriptor(value);
        if (typeof value === 'function')
            return this.descriptor('fn', { id: this.functionId(value as (...args: unknown[]) => unknown, receiver) });
        if (typeof value !== 'object' || value === null)
            return encodePrimitive(value);
        return this.descriptor(this.ref(value));
    }
    private awaitDescriptor(promise: PromiseLike<unknown>): {
        [key: string]: unknown;
    } {
        if (this.options.promises === 'pending') {
            this.pendingPromise = promise;
            return this.descriptor('await');
        }
        const settled = Promise.resolve(promise).then((value) => this.encode(value));
        return this.descriptor('await', { promise: settled });
    }
    private isCopiable(value: object, depth: number): boolean {
        if (depth >= MAX_DATA_DEPTH)
            return false;
        if (ArrayBuffer.isView(value))
            return (value as unknown as ArrayLike<number>).length <= MAX_COPIED_TYPED_ARRAY;
        return isDataObject(value);
    }
    private copy(value: object, depth: number): unknown {
        if (ArrayBuffer.isView(value))
            return this.copyTypedArray(value);
        if (Array.isArray(value))
            return value.map((entry) => this.copyEntry(entry, depth + 1));
        const out: Record<string, unknown> = {};
        for (const [key, entry] of Object.entries(value)) {
            const encoded = this.copyEntry(entry, depth + 1);
            if (encoded !== undefined)
                out[key] = encoded;
        }
        return out;
    }
    private copyTypedArray(view: ArrayBufferView): unknown {
        const numbers = Array.from(view as unknown as ArrayLike<number>);
        return numbers.length === 3 || numbers.length === 4 ? this.descriptor('vec', { value: numbers }) : numbers;
    }
    private copyEntry(value: unknown, depth: number): unknown {
        if (typeof value === 'function')
            return this.descriptor('fn', { id: this.functionId(value as (...args: unknown[]) => unknown, undefined) });
        if (typeof value !== 'object' || value === null)
            return encodePrimitive(value);
        if (this.isCopiable(value, depth))
            return this.copy(value, depth);
        return this.descriptor(this.ref(value));
    }
    decode(value: unknown, depth = 0): unknown {
        if (value === null || value === undefined)
            return undefined;
        if (typeof value !== 'object')
            return typeof value === 'bigint' ? Number(value) : value;
        if (ArrayBuffer.isView(value))
            return value;
        if (Array.isArray(value))
            return depth > MAX_DATA_DEPTH ? value : value.map((entry) => this.decode(entry, depth + 1));
        const record = value as Record<string, unknown>;
        const kind = record[this.options.kindKey];
        if (kind !== undefined)
            return this.decodeDescriptor(kind, record);
        if (depth > MAX_DATA_DEPTH)
            return value;
        if (!isDataObject(value))
            return value;
        const out: Record<string, unknown> = {};
        for (const [key, entry] of Object.entries(record))
            out[key] = this.decode(entry, depth + 1);
        return out;
    }
    private decodeDescriptor(kind: unknown, record: Record<string, unknown>): unknown {
        if (typeof kind === 'number')
            return this.objectOf(kind);
        switch (kind) {
            case 'ref':
                return this.objectOf(Number(record.id));
            case 'fn': {
                const entry = this.functionOf(Number(record.id));
                if (entry.receiver === undefined)
                    return entry.fn;
                if (!entry.bound)
                    entry.bound = entry.fn.bind(entry.receiver);
                return entry.bound;
            }
            case 'cb':
                return this.callbackProxy(Number(record.id));
            case 'data':
                return this.decode(record.value, 1);
            default:
                throw new HelixError(`descritor de protocolo desconhecido (${String(kind)}).`);
        }
    }
    get(id: number, key: unknown): Encoded {
        try {
            const target = this.objectOf(id);
            const property = this.propertyKey(target, key);
            if (target instanceof Map)
                return this.encode(target.get(property));
            if (target instanceof Set)
                return typeof property === 'number' ? this.encode(Array.from(target)[property]) : encodePrimitive(target.has(property));
            const value = (target as Record<PropertyKey, unknown>)[property];
            return this.isDataProperty(target, property) ? this.encodeLive(value, target) : this.encode(value);
        }
        catch (cause) {
            return this.error(cause);
        }
    }
    set(id: number, key: unknown, value: unknown): Encoded {
        try {
            const target = this.objectOf(id);
            const property = this.propertyKey(target, key);
            const next = this.decode(value);
            if (target instanceof Map) {
                target.set(property, next);
                return undefined;
            }
            const record = target as Record<PropertyKey, unknown>;
            const current = record[property];
            if (current instanceof Float32Array && next !== null && typeof next === 'object') {
                copyIntoTypedArray(current, next, String(property));
                return undefined;
            }
            record[property] = next;
            return undefined;
        }
        catch (cause) {
            return this.error(cause);
        }
    }
    call(fnId: number, args: readonly unknown[]): Encoded {
        try {
            const entry = this.functionOf(fnId);
            const decoded = args.map((arg) => this.decode(arg));
            return this.encode(entry.fn.apply(entry.receiver, decoded));
        }
        catch (cause) {
            return this.error(cause);
        }
    }
    str(id: number): string {
        try {
            return formatValue(this.objectOf(id));
        }
        catch (cause) {
            return describeThrown(cause);
        }
    }
    len(id: number): number {
        try {
            const target = this.objectOf(id);
            if (Array.isArray(target) || ArrayBuffer.isView(target))
                return (target as unknown as ArrayLike<number>).length;
            if (target instanceof Map || target instanceof Set)
                return target.size;
            return Object.keys(target).length;
        }
        catch {
            return 0;
        }
    }
    keys(id: number): Array<string | number> {
        try {
            const target = this.objectOf(id);
            if (Array.isArray(target) || ArrayBuffer.isView(target)) {
                const length = (target as unknown as ArrayLike<number>).length;
                return Array.from({ length }, (_, index) => index + this.options.indexBase);
            }
            if (target instanceof Map)
                return Array.from(target.keys()).map((key) => (typeof key === 'number' ? key : String(key)));
            if (target instanceof Set)
                return Array.from({ length: target.size }, (_, index) => index + this.options.indexBase);
            return enumerableKeys(target);
        }
        catch {
            return [];
        }
    }
    has(id: number, key: string): boolean {
        try {
            const target = this.objectOf(id);
            if (Array.isArray(target) || ArrayBuffer.isView(target) || target instanceof Map || target instanceof Set)
                return false;
            return key in target;
        }
        catch {
            return false;
        }
    }
    private propertyKey(target: object, key: unknown): string | number {
        if (typeof key === 'number') {
            if (Array.isArray(target) || ArrayBuffer.isView(target) || target instanceof Set)
                return key - this.options.indexBase;
            return key;
        }
        if (typeof key === 'string')
            return key;
        if (typeof key === 'bigint')
            return Number(key) - this.options.indexBase;
        throw new HelixError(`chave inválida (${formatValue(key)}): objetos da engine só aceitam nomes (texto) ou índices (número).`);
    }
    private isDataProperty(target: object, property: string | number): boolean {
        if (Array.isArray(target) || ArrayBuffer.isView(target))
            return typeof property === 'number';
        for (let current: object | null = target; current && current !== Object.prototype; current = Object.getPrototypeOf(current)) {
            const descriptor = Object.getOwnPropertyDescriptor(current, property);
            if (descriptor)
                return descriptor.get === undefined && descriptor.set === undefined;
        }
        return false;
    }
}
function encodePrimitive(value: unknown): ForeignPrimitive {
    switch (typeof value) {
        case 'string':
        case 'number':
        case 'boolean':
            return value;
        case 'bigint':
            return Number(value);
        default:
            return undefined;
    }
}
function enumerableKeys(target: object): string[] {
    const keys = new Set<string>(Object.keys(target));
    for (let current: object | null = Object.getPrototypeOf(target); current && current !== Object.prototype; current = Object.getPrototypeOf(current)) {
        for (const [name, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(current))) {
            if (name === 'constructor' || !descriptor.enumerable)
                continue;
            keys.add(name);
        }
    }
    return Array.from(keys);
}
function copyIntoTypedArray(target: Float32Array, value: object, member: string): void {
    if (target.length === 3) {
        toVec3(value, member, target);
        return;
    }
    if (target.length === 4) {
        toQuat(value, member, target);
        return;
    }
    const numbers = Array.isArray(value) ? value : ArrayBuffer.isView(value) ? Array.from(value as unknown as ArrayLike<number>) : null;
    if (!numbers || numbers.length !== target.length || numbers.some((entry) => typeof entry !== 'number')) {
        throw new HelixError(`${member}: esperava uma lista de ${target.length} números.`);
    }
    target.set(numbers as number[]);
}
