export const HandleType = {
    Undefined: 0,
    Null: 1,
    Boolean: 2,
    Number: 3,
    String: 4,
    Array: 5,
    Object: 6,
    Function: 7,
} as const;
export type HandleType = (typeof HandleType)[keyof typeof HandleType];
interface Entry {
    value: unknown;
    count: number;
}
export class HandleError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'HandleError';
    }
}
export interface HandleTableOptions {
    writeTypedArray?(target: ArrayBufferView, value: unknown, member: string): void;
}
export const HANDLE_BASE = 1 << 24;
const AXIS_INDEX: Readonly<Record<string, number>> = { x: 0, y: 1, z: 2, w: 3, r: 0, g: 1, b: 2, a: 3 };
export class HandleTable {
    private readonly entries = new Map<number, Entry>();
    private readonly ids = new Map<object, number>();
    private readonly pools: number[][] = [];
    private readonly bound = new WeakMap<object, Map<(...args: unknown[]) => unknown, (...args: unknown[]) => unknown>>();
    private next = HANDLE_BASE;
    constructor(private readonly options: HandleTableOptions = {}) { }
    get size(): number {
        return this.entries.size;
    }
    get depth(): number {
        return this.pools.length;
    }
    pushPool(): void {
        this.pools.push([]);
    }
    popPool(): void {
        const pool = this.pools.pop();
        if (!pool)
            return;
        for (const id of pool)
            this.release(id);
    }
    acquire(value: unknown): number {
        if (value === undefined)
            return 0;
        let id: number;
        if ((typeof value === 'object' && value !== null) || typeof value === 'function') {
            const existing = this.ids.get(value);
            if (existing !== undefined) {
                id = existing;
                const entry = this.entries.get(id);
                if (entry)
                    entry.count++;
            }
            else {
                id = this.next++;
                this.ids.set(value, id);
                this.entries.set(id, { value, count: 1 });
            }
        }
        else {
            id = this.next++;
            this.entries.set(id, { value, count: 1 });
        }
        const pool = this.pools[this.pools.length - 1];
        if (pool)
            pool.push(id);
        return id;
    }
    retain(id: number): number {
        if (id === 0)
            return 0;
        const entry = this.entries.get(id);
        if (!entry)
            throw this.missing(id);
        entry.count++;
        return id;
    }
    release(id: number): void {
        if (id === 0)
            return;
        const entry = this.entries.get(id);
        if (!entry)
            return;
        entry.count--;
        if (entry.count > 0)
            return;
        this.entries.delete(id);
        if ((typeof entry.value === 'object' && entry.value !== null) || typeof entry.value === 'function')
            this.ids.delete(entry.value);
    }
    value(id: number): unknown {
        if (id === 0)
            return undefined;
        const entry = this.entries.get(id);
        if (!entry)
            throw this.missing(id);
        return entry.value;
    }
    has(id: number): boolean {
        return id === 0 || this.entries.has(id);
    }
    clear(): void {
        this.entries.clear();
        this.ids.clear();
        this.pools.length = 0;
    }
    private missing(id: number): HandleError {
        return new HandleError(`handle #${id} já foi solto (use hx_retain para guardar um valor além do hook em que o recebeu).`);
    }
    typeOf(id: number): HandleType {
        const value = this.value(id);
        if (value === undefined)
            return HandleType.Undefined;
        if (value === null)
            return HandleType.Null;
        switch (typeof value) {
            case 'boolean':
                return HandleType.Boolean;
            case 'number':
            case 'bigint':
                return HandleType.Number;
            case 'string':
                return HandleType.String;
            case 'function':
                return HandleType.Function;
            default:
                return Array.isArray(value) || ArrayBuffer.isView(value) ? HandleType.Array : HandleType.Object;
        }
    }
    equals(a: number, b: number): boolean {
        const left = this.value(a);
        const right = this.value(b);
        if (left === right)
            return true;
        if (typeof left === 'number' && typeof right === 'number')
            return Number.isNaN(left) && Number.isNaN(right);
        return false;
    }
    get(objectId: number, key: string | number): unknown {
        const target = this.object(objectId, `ler ${describeKey(key)}`);
        const property = this.propertyKey(target, key);
        if (target instanceof Map)
            return target.get(property);
        if (target instanceof Set)
            return typeof property === 'number' ? Array.from(target)[property] : target.has(property);
        const value = (target as Record<PropertyKey, unknown>)[property];
        if (typeof value === 'function' && !isConstructor(value))
            return this.bindFunction(target, value as (...args: unknown[]) => unknown);
        return value;
    }
    set(objectId: number, key: string | number, value: unknown): void {
        const target = this.object(objectId, `escrever ${describeKey(key)}`);
        const property = this.propertyKey(target, key);
        if (target instanceof Map) {
            target.set(property, value);
            return;
        }
        const record = target as Record<PropertyKey, unknown>;
        const current = record[property];
        if (ArrayBuffer.isView(current) && value !== null && typeof value === 'object') {
            if (this.options.writeTypedArray)
                this.options.writeTypedArray(current, value, String(property));
            else
                copyNumbers(current, value, String(property));
            return;
        }
        record[property] = value;
    }
    hasKey(objectId: number, key: string | number): boolean {
        const target = this.object(objectId, `consultar ${describeKey(key)}`);
        const property = this.propertyKey(target, key);
        if (target instanceof Map)
            return target.has(property);
        if (target instanceof Set)
            return target.has(property);
        return property in target;
    }
    deleteKey(objectId: number, key: string | number): void {
        const target = this.object(objectId, `apagar ${describeKey(key)}`);
        const property = this.propertyKey(target, key);
        if (target instanceof Map || target instanceof Set) {
            target.delete(property);
            return;
        }
        delete (target as Record<PropertyKey, unknown>)[property];
    }
    length(objectId: number): number {
        const value = this.value(objectId);
        if (typeof value === 'string')
            return value.length;
        if (value === null || typeof value !== 'object')
            return 0;
        if (Array.isArray(value) || ArrayBuffer.isView(value))
            return (value as unknown as ArrayLike<number>).length;
        if (value instanceof Map || value instanceof Set)
            return value.size;
        return Object.keys(value).length;
    }
    keys(objectId: number): Array<string | number> {
        const target = this.value(objectId);
        if (target === null || typeof target !== 'object')
            return [];
        if (Array.isArray(target) || ArrayBuffer.isView(target))
            return Array.from({ length: (target as unknown as ArrayLike<number>).length }, (_, index) => index);
        if (target instanceof Map)
            return Array.from(target.keys()).map((key) => (typeof key === 'number' ? key : String(key)));
        if (target instanceof Set)
            return Array.from({ length: target.size }, (_, index) => index);
        return enumerableKeys(target);
    }
    call(functionId: number, args: unknown[]): unknown {
        const fn = this.value(functionId);
        if (typeof fn !== 'function')
            throw new HandleError(`o valor não é uma função (é ${describeType(fn)}); hx_call precisa de uma função da engine.`);
        return (fn as (...args: unknown[]) => unknown)(...args);
    }
    invoke(objectId: number, method: string, args: unknown[]): unknown {
        const target = this.object(objectId, `chamar ${method}()`);
        const fn = (target as Record<string, unknown>)[method];
        if (typeof fn !== 'function') {
            throw new HandleError(`${method} não é um método deste objeto (é ${describeType(fn)}).`);
        }
        return (fn as (...args: unknown[]) => unknown).apply(target, args);
    }
    construct(constructorId: number, args: unknown[]): unknown {
        const ctor = this.value(constructorId);
        if (typeof ctor !== 'function')
            throw new HandleError(`o valor não é um construtor (é ${describeType(ctor)}).`);
        return new (ctor as new (...args: unknown[]) => unknown)(...args);
    }
    private object(id: number, action: string): object {
        const value = this.value(id);
        if (value === null || value === undefined || (typeof value !== 'object' && typeof value !== 'function')) {
            throw new HandleError(`não dá para ${action} de ${describeType(value)}.`);
        }
        return value;
    }
    private propertyKey(target: object, key: string | number): string | number {
        if (typeof key === 'number')
            return key;
        if (Array.isArray(target) || ArrayBuffer.isView(target)) {
            const index = Number(key);
            if (Number.isInteger(index) && String(index) === key)
                return index;
            const axis = AXIS_INDEX[key];
            if (axis !== undefined && axis < (target as unknown as ArrayLike<number>).length)
                return axis;
        }
        return key;
    }
    private bindFunction(receiver: object, fn: (...args: unknown[]) => unknown): (...args: unknown[]) => unknown {
        let table = this.bound.get(receiver);
        if (!table) {
            table = new Map();
            this.bound.set(receiver, table);
        }
        let bound = table.get(fn);
        if (!bound) {
            bound = fn.bind(receiver);
            Object.defineProperty(bound, 'name', { value: fn.name });
            table.set(fn, bound);
        }
        return bound;
    }
}
function isConstructor(value: unknown): boolean {
    if (typeof value !== 'function')
        return false;
    const source = Function.prototype.toString.call(value);
    return /^class[\s{]/.test(source);
}
function describeKey(key: string | number): string {
    return typeof key === 'number' ? `[${key}]` : `"${key}"`;
}
export function describeType(value: unknown): string {
    if (value === undefined)
        return 'undefined (nada)';
    if (value === null)
        return 'null';
    if (Array.isArray(value))
        return 'uma lista';
    switch (typeof value) {
        case 'number':
            return `o número ${value}`;
        case 'string':
            return `o texto "${value.length > 40 ? `${value.slice(0, 40)}…` : value}"`;
        case 'boolean':
            return value ? 'true' : 'false';
        case 'function':
            return 'uma função';
        default:
            return 'um objeto';
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
function copyNumbers(target: ArrayBufferView, value: object, member: string): void {
    const typed = target as unknown as {
        length: number;
        set(values: ArrayLike<number>): void;
    };
    const numbers = Array.isArray(value)
        ? value
        : ArrayBuffer.isView(value)
            ? Array.from(value as unknown as ArrayLike<number>)
            : ['x', 'y', 'z', 'w'].slice(0, typed.length).map((axis) => (value as Record<string, unknown>)[axis]);
    if (numbers.length !== typed.length || numbers.some((entry) => typeof entry !== 'number')) {
        throw new HandleError(`${member}: esperava ${typed.length} números.`);
    }
    typed.set(numbers as number[]);
}
