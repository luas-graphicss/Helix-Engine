import { ArgumentException, ArgumentNullException, ArgumentOutOfRangeException, IndexOutOfRangeException, InvalidOperationException, KeyNotFoundException } from './errors';
import { TYPE_NAME, compare, equals, hashKey, isNullish, str, type Fn } from './values';
type Ref<T> = {
    v: T;
};
function requireFunction(value: unknown, what: string): Fn {
    if (typeof value !== 'function')
        throw new ArgumentNullException(what, `${what} precisa de uma função (lambda).`);
    return value as Fn;
}
export function iterate(value: unknown, context = 'foreach'): Iterable<unknown> {
    if (isNullish(value))
        throw new ArgumentNullException(null, `${context}: a coleção é nula.`);
    if (typeof value === 'string')
        return value;
    if (typeof value === 'object' || typeof value === 'function') {
        const iterator = (value as {
            [Symbol.iterator]?: unknown;
        })[Symbol.iterator];
        if (typeof iterator === 'function')
            return value as Iterable<unknown>;
        if (value instanceof Map)
            return value.entries();
        const length = (value as {
            length?: unknown;
        }).length;
        if (typeof length === 'number')
            return Array.from(value as ArrayLike<unknown>);
    }
    throw new InvalidOperationException(`${context}: o valor (${str(value)}) não é uma coleção que se possa percorrer.`);
}
function toArray(value: Iterable<unknown>): unknown[] {
    return Array.isArray(value) ? value : Array.from(value);
}
export class KeyValuePair {
    readonly Key: unknown;
    readonly Value: unknown;
    constructor(key: unknown, value: unknown) {
        this.Key = key;
        this.Value = value;
    }
    Deconstruct(key: Ref<unknown>, value: Ref<unknown>): void {
        key.v = this.Key;
        value.v = this.Value;
    }
    *[Symbol.iterator](): Iterator<unknown> {
        yield this.Key;
        yield this.Value;
    }
    Equals(other: unknown): boolean {
        return other instanceof KeyValuePair && equals(this.Key, other.Key) && equals(this.Value, other.Value);
    }
    GetHashKey(): string {
        return `kvp:${String(hashKey(this.Key))}\u0000${String(hashKey(this.Value))}`;
    }
    ToString(): string {
        return `[${str(this.Key)}, ${str(this.Value)}]`;
    }
    get [TYPE_NAME](): string {
        return 'KeyValuePair';
    }
}
export class Tuple {
    readonly $items: readonly unknown[];
    readonly $names: readonly (string | null)[];
    constructor(items: readonly unknown[], names: readonly (string | null)[] | null = null) {
        this.$items = items;
        this.$names = names ?? items.map(() => null);
        items.forEach((item, index) => {
            Object.defineProperty(this, `Item${index + 1}`, { value: item, enumerable: true });
            const name = this.$names[index];
            if (name && !(name in this))
                Object.defineProperty(this, name, { value: item, enumerable: false });
        });
    }
    get Length(): number {
        return this.$items.length;
    }
    [Symbol.iterator](): Iterator<unknown> {
        return this.$items[Symbol.iterator]();
    }
    Equals(other: unknown): boolean {
        return other instanceof Tuple && other.$items.length === this.$items.length && this.$items.every((item, index) => equals(item, other.$items[index]));
    }
    GetHashKey(): string {
        return `tuple:${this.$items.map((item) => String(hashKey(item))).join('\u0000')}`;
    }
    CompareTo(other: unknown): number {
        if (!(other instanceof Tuple))
            throw new ArgumentException('Só dá para comparar tuplas com tuplas.');
        for (let index = 0; index < Math.min(this.$items.length, other.$items.length); index++) {
            const result = compare(this.$items[index], other.$items[index]);
            if (result !== 0)
                return result;
        }
        return this.$items.length - other.$items.length;
    }
    ToString(): string {
        return `(${this.$items.map((item) => str(item)).join(', ')})`;
    }
    get [TYPE_NAME](): string {
        return 'ValueTuple';
    }
}
function keyOf(selector: unknown, item: unknown, index: number): unknown {
    return selector === undefined || selector === null ? item : requireFunction(selector, 'o seletor')(item, index);
}
interface SortKey {
    readonly selector: Fn;
    readonly descending: boolean;
}
function sum(values: unknown[], what: string): number {
    let total = 0;
    for (const value of values) {
        if (typeof value !== 'number')
            throw new InvalidOperationException(`${what}: a sequência tem um valor que não é número (${str(value)}).`);
        total += value;
    }
    return total;
}
export const LINQ: Record<string, (source: Iterable<unknown>, ...args: unknown[]) => unknown> = {
    Where(source, predicate) {
        const test = requireFunction(predicate, 'Where');
        const result = new List();
        let index = 0;
        for (const item of source)
            if (test(item, index++))
                result.$items.push(item);
        return result;
    },
    Select(source, selector) {
        const map = requireFunction(selector, 'Select');
        const result = new List();
        let index = 0;
        for (const item of source)
            result.$items.push(map(item, index++));
        return result;
    },
    SelectMany(source, selector, resultSelector) {
        const map = requireFunction(selector, 'SelectMany');
        const result = new List();
        let index = 0;
        for (const item of source) {
            const inner = iterate(map(item, index++), 'SelectMany');
            for (const sub of inner)
                result.$items.push(resultSelector ? requireFunction(resultSelector, 'SelectMany')(item, sub) : sub);
        }
        return result;
    },
    OrderBy(source, selector) {
        return OrderedList.sort(source, [{ selector: selector ? requireFunction(selector, 'OrderBy') : (item) => item, descending: false }]);
    },
    OrderByDescending(source, selector) {
        return OrderedList.sort(source, [{ selector: selector ? requireFunction(selector, 'OrderByDescending') : (item) => item, descending: true }]);
    },
    ThenBy(source, selector) {
        if (!(source instanceof OrderedList))
            throw new InvalidOperationException('ThenBy só vale depois de OrderBy/OrderByDescending.');
        return OrderedList.sort(source.$sourceItems, [...source.$sortKeys, { selector: requireFunction(selector, 'ThenBy'), descending: false }]);
    },
    ThenByDescending(source, selector) {
        if (!(source instanceof OrderedList))
            throw new InvalidOperationException('ThenByDescending só vale depois de OrderBy/OrderByDescending.');
        return OrderedList.sort(source.$sourceItems, [...source.$sortKeys, { selector: requireFunction(selector, 'ThenByDescending'), descending: true }]);
    },
    First(source, predicate) {
        let index = 0;
        for (const item of source)
            if (!predicate || requireFunction(predicate, 'First')(item, index++))
                return item;
        throw new InvalidOperationException(predicate ? 'First: nenhum elemento satisfaz a condição.' : 'First: a sequência está vazia.');
    },
    FirstOrDefault(source, predicateOrDefault, defaultValue) {
        const predicate = typeof predicateOrDefault === 'function' ? (predicateOrDefault as Fn) : null;
        const fallback = predicate ? defaultValue : predicateOrDefault;
        let index = 0;
        for (const item of source)
            if (!predicate || predicate(item, index++))
                return item;
        return fallback === undefined ? null : fallback;
    },
    Last(source, predicate) {
        const items = toArray(source);
        for (let index = items.length - 1; index >= 0; index--)
            if (!predicate || requireFunction(predicate, 'Last')(items[index], index))
                return items[index];
        throw new InvalidOperationException(predicate ? 'Last: nenhum elemento satisfaz a condição.' : 'Last: a sequência está vazia.');
    },
    LastOrDefault(source, predicateOrDefault, defaultValue) {
        const predicate = typeof predicateOrDefault === 'function' ? (predicateOrDefault as Fn) : null;
        const fallback = predicate ? defaultValue : predicateOrDefault;
        const items = toArray(source);
        for (let index = items.length - 1; index >= 0; index--)
            if (!predicate || predicate(items[index], index))
                return items[index];
        return fallback === undefined ? null : fallback;
    },
    Single(source, predicate) {
        const matches = predicate ? (LINQ.Where(source, predicate) as List).$items : toArray(source);
        if (matches.length !== 1)
            throw new InvalidOperationException(matches.length === 0 ? 'Single: a sequência está vazia.' : 'Single: a sequência tem mais de um elemento.');
        return matches[0];
    },
    SingleOrDefault(source, predicate) {
        const matches = typeof predicate === 'function' ? (LINQ.Where(source, predicate) as List).$items : toArray(source);
        if (matches.length > 1)
            throw new InvalidOperationException('SingleOrDefault: a sequência tem mais de um elemento.');
        return matches.length === 1 ? matches[0] : null;
    },
    ElementAt(source, index) {
        const items = toArray(source);
        const position = Number(index);
        if (!Number.isInteger(position) || position < 0 || position >= items.length)
            throw new ArgumentOutOfRangeException('index', `ElementAt: índice ${str(index)} fora da sequência (${items.length} elementos).`);
        return items[position];
    },
    ElementAtOrDefault(source, index) {
        const items = toArray(source);
        const position = Number(index);
        return position >= 0 && position < items.length ? items[position] : null;
    },
    Any(source, predicate) {
        let index = 0;
        for (const item of source)
            if (!predicate || requireFunction(predicate, 'Any')(item, index++))
                return true;
        return false;
    },
    All(source, predicate) {
        const test = requireFunction(predicate, 'All');
        let index = 0;
        for (const item of source)
            if (!test(item, index++))
                return false;
        return true;
    },
    Count(source, predicate) {
        if (!predicate)
            return Array.isArray(source) ? source.length : toArray(source).length;
        const test = requireFunction(predicate, 'Count');
        let total = 0;
        let index = 0;
        for (const item of source)
            if (test(item, index++))
                total++;
        return total;
    },
    LongCount(source, predicate) {
        return LINQ.Count(source, predicate);
    },
    Sum(source, selector) {
        const items = toArray(source).map((item, index) => keyOf(selector, item, index));
        return sum(items, 'Sum');
    },
    Average(source, selector) {
        const items = toArray(source).map((item, index) => keyOf(selector, item, index));
        if (items.length === 0)
            throw new InvalidOperationException('Average: a sequência está vazia.');
        return sum(items, 'Average') / items.length;
    },
    Min(source, selector) {
        const items = toArray(source).map((item, index) => keyOf(selector, item, index));
        if (items.length === 0)
            throw new InvalidOperationException('Min: a sequência está vazia.');
        return items.reduce((best, item) => (compare(item, best) < 0 ? item : best));
    },
    Max(source, selector) {
        const items = toArray(source).map((item, index) => keyOf(selector, item, index));
        if (items.length === 0)
            throw new InvalidOperationException('Max: a sequência está vazia.');
        return items.reduce((best, item) => (compare(item, best) > 0 ? item : best));
    },
    MinBy(source, selector) {
        const map = requireFunction(selector, 'MinBy');
        const items = toArray(source);
        if (items.length === 0)
            throw new InvalidOperationException('MinBy: a sequência está vazia.');
        return items.reduce((best, item) => (compare(map(item), map(best)) < 0 ? item : best));
    },
    MaxBy(source, selector) {
        const map = requireFunction(selector, 'MaxBy');
        const items = toArray(source);
        if (items.length === 0)
            throw new InvalidOperationException('MaxBy: a sequência está vazia.');
        return items.reduce((best, item) => (compare(map(item), map(best)) > 0 ? item : best));
    },
    Aggregate(source, seedOrFn, fnOrResult, resultSelector) {
        const items = toArray(source);
        if (typeof seedOrFn === 'function' && fnOrResult === undefined) {
            if (items.length === 0)
                throw new InvalidOperationException('Aggregate: a sequência está vazia.');
            return items.slice(1).reduce((acc, item) => (seedOrFn as Fn)(acc, item), items[0]);
        }
        const fn = requireFunction(fnOrResult, 'Aggregate');
        const result = items.reduce((acc, item) => fn(acc, item), seedOrFn);
        return resultSelector ? requireFunction(resultSelector, 'Aggregate')(result) : result;
    },
    Contains(source, value) {
        for (const item of source)
            if (equals(item, value))
                return true;
        return false;
    },
    Distinct(source) {
        const seen = new Set<unknown>();
        const result = new List();
        for (const item of source) {
            const key = hashKey(item);
            if (seen.has(key))
                continue;
            seen.add(key);
            result.$items.push(item);
        }
        return result;
    },
    DistinctBy(source, selector) {
        const map = requireFunction(selector, 'DistinctBy');
        const seen = new Set<unknown>();
        const result = new List();
        for (const item of source) {
            const key = hashKey(map(item));
            if (seen.has(key))
                continue;
            seen.add(key);
            result.$items.push(item);
        }
        return result;
    },
    Take(source, count) {
        return List.from(toArray(source).slice(0, Math.max(0, Number(count))));
    },
    TakeLast(source, count) {
        const items = toArray(source);
        const amount = Math.max(0, Number(count));
        return List.from(amount === 0 ? [] : items.slice(-amount));
    },
    TakeWhile(source, predicate) {
        const test = requireFunction(predicate, 'TakeWhile');
        const result = new List();
        let index = 0;
        for (const item of source) {
            if (!test(item, index++))
                break;
            result.$items.push(item);
        }
        return result;
    },
    Skip(source, count) {
        return List.from(toArray(source).slice(Math.max(0, Number(count))));
    },
    SkipLast(source, count) {
        const items = toArray(source);
        const amount = Math.max(0, Number(count));
        return List.from(items.slice(0, Math.max(0, items.length - amount)));
    },
    SkipWhile(source, predicate) {
        const test = requireFunction(predicate, 'SkipWhile');
        const result = new List();
        let skipping = true;
        let index = 0;
        for (const item of source) {
            if (skipping && test(item, index++))
                continue;
            skipping = false;
            result.$items.push(item);
        }
        return result;
    },
    Reverse(source) {
        return List.from(toArray(source).slice().reverse());
    },
    Concat(source, other) {
        return List.from([...toArray(source), ...toArray(iterate(other, 'Concat'))]);
    },
    Append(source, item) {
        return List.from([...toArray(source), item]);
    },
    Prepend(source, item) {
        return List.from([item, ...toArray(source)]);
    },
    Union(source, other) {
        return LINQ.Distinct(List.from([...toArray(source), ...toArray(iterate(other, 'Union'))]));
    },
    Intersect(source, other) {
        const keys = new Set(toArray(iterate(other, 'Intersect')).map((item) => hashKey(item)));
        return LINQ.Distinct(List.from(toArray(source).filter((item) => keys.has(hashKey(item)))));
    },
    Except(source, other) {
        const keys = new Set(toArray(iterate(other, 'Except')).map((item) => hashKey(item)));
        return LINQ.Distinct(List.from(toArray(source).filter((item) => !keys.has(hashKey(item)))));
    },
    Zip(source, other, resultSelector) {
        const left = toArray(source);
        const right = toArray(iterate(other, 'Zip'));
        const length = Math.min(left.length, right.length);
        const result = new List();
        for (let index = 0; index < length; index++) {
            result.$items.push(resultSelector ? requireFunction(resultSelector, 'Zip')(left[index], right[index]) : new Tuple([left[index], right[index]], ['First', 'Second']));
        }
        return result;
    },
    GroupBy(source, keySelector, elementSelector) {
        const keyOfItem = requireFunction(keySelector, 'GroupBy');
        const groups = new Map<unknown, Grouping>();
        const result = new List();
        for (const item of source) {
            const key = keyOfItem(item);
            const hashed = hashKey(key);
            let grouping = groups.get(hashed);
            if (!grouping) {
                grouping = new Grouping(key);
                groups.set(hashed, grouping);
                result.$items.push(grouping);
            }
            grouping.$items.push(elementSelector ? requireFunction(elementSelector, 'GroupBy')(item) : item);
        }
        return result;
    },
    Chunk(source, size) {
        const amount = Number(size);
        if (!Number.isInteger(amount) || amount <= 0)
            throw new ArgumentOutOfRangeException('size', 'Chunk: o tamanho precisa ser um inteiro positivo.');
        const items = toArray(source);
        const result = new List();
        for (let index = 0; index < items.length; index += amount)
            result.$items.push(items.slice(index, index + amount));
        return result;
    },
    DefaultIfEmpty(source, defaultValue) {
        const items = toArray(source);
        return List.from(items.length === 0 ? [defaultValue === undefined ? null : defaultValue] : items);
    },
    SequenceEqual(source, other) {
        const left = toArray(source);
        const right = toArray(iterate(other, 'SequenceEqual'));
        return left.length === right.length && left.every((item, index) => equals(item, right[index]));
    },
    Cast(source) {
        return List.from(toArray(source));
    },
    OfType(source) {
        return List.from(toArray(source).filter((item) => !isNullish(item)));
    },
    AsEnumerable(source) {
        return source;
    },
    ToList(source) {
        return List.from(toArray(source));
    },
    ToArray(source) {
        return toArray(source).slice();
    },
    ToHashSet(source) {
        return HashSet.from(source);
    },
    ToDictionary(source, keySelector, valueSelector) {
        const keyOfItem = requireFunction(keySelector, 'ToDictionary');
        const dictionary = new Dictionary();
        for (const item of source)
            dictionary.Add(keyOfItem(item), valueSelector ? requireFunction(valueSelector, 'ToDictionary')(item) : item);
        return dictionary;
    },
    ToLookup(source, keySelector, elementSelector) {
        return LINQ.GroupBy(source, keySelector, elementSelector);
    },
    Index(source) {
        return List.from(toArray(source).map((item, index) => new Tuple([index, item], ['Index', 'Item'])));
    },
};
export class List {
    $items: unknown[] = [];
    constructor(capacityOrItems?: unknown) {
        if (capacityOrItems !== undefined && capacityOrItems !== null && typeof capacityOrItems !== 'number')
            this.$items = toArray(iterate(capacityOrItems, 'new List'));
    }
    static from(items: Iterable<unknown>): List {
        const list = new List();
        list.$items = toArray(items).slice();
        return list;
    }
    get Count(): number {
        return this.$items.length;
    }
    get Capacity(): number {
        return this.$items.length;
    }
    $at(index: unknown): unknown {
        const position = this.$position(index, 'o índice');
        return this.$items[position];
    }
    $set(index: unknown, value: unknown): void {
        const position = this.$position(index, 'o índice');
        this.$items[position] = value;
    }
    private $position(index: unknown, what: string): number {
        const position = Number(index);
        if (!Number.isInteger(position) || position < 0 || position >= this.$items.length) {
            throw new ArgumentOutOfRangeException('index', `${what} ${str(index)} está fora da lista (Count = ${this.$items.length}).`);
        }
        return position;
    }
    Add(item: unknown): void {
        this.$items.push(item);
    }
    AddRange(items: unknown): void {
        this.$items.push(...toArray(iterate(items, 'AddRange')));
    }
    Insert(index: unknown, item: unknown): void {
        const position = Number(index);
        if (!Number.isInteger(position) || position < 0 || position > this.$items.length)
            throw new ArgumentOutOfRangeException('index', `Insert: índice ${str(index)} fora da lista.`);
        this.$items.splice(position, 0, item);
    }
    InsertRange(index: unknown, items: unknown): void {
        const position = Number(index);
        if (!Number.isInteger(position) || position < 0 || position > this.$items.length)
            throw new ArgumentOutOfRangeException('index', `InsertRange: índice ${str(index)} fora da lista.`);
        this.$items.splice(position, 0, ...toArray(iterate(items, 'InsertRange')));
    }
    Remove(item: unknown): boolean {
        const index = this.IndexOf(item);
        if (index < 0)
            return false;
        this.$items.splice(index, 1);
        return true;
    }
    RemoveAt(index: unknown): void {
        const position = this.$position(index, 'RemoveAt: o índice');
        this.$items.splice(position, 1);
    }
    RemoveRange(index: unknown, count: unknown): void {
        const start = this.$position(index, 'RemoveRange: o índice');
        this.$items.splice(start, Math.max(0, Number(count)));
    }
    RemoveAll(predicate: unknown): number {
        const test = requireFunction(predicate, 'RemoveAll');
        const before = this.$items.length;
        this.$items = this.$items.filter((item) => !test(item));
        return before - this.$items.length;
    }
    Clear(): void {
        this.$items.length = 0;
    }
    Contains(item: unknown): boolean {
        return this.IndexOf(item) >= 0;
    }
    IndexOf(item: unknown, start = 0): number {
        for (let index = Math.max(0, Number(start)); index < this.$items.length; index++)
            if (equals(this.$items[index], item))
                return index;
        return -1;
    }
    LastIndexOf(item: unknown): number {
        for (let index = this.$items.length - 1; index >= 0; index--)
            if (equals(this.$items[index], item))
                return index;
        return -1;
    }
    Find(predicate: unknown): unknown {
        const test = requireFunction(predicate, 'Find');
        for (const item of this.$items)
            if (test(item))
                return item;
        return null;
    }
    FindLast(predicate: unknown): unknown {
        const test = requireFunction(predicate, 'FindLast');
        for (let index = this.$items.length - 1; index >= 0; index--)
            if (test(this.$items[index]))
                return this.$items[index];
        return null;
    }
    FindIndex(predicate: unknown): number {
        const test = requireFunction(predicate, 'FindIndex');
        return this.$items.findIndex((item) => Boolean(test(item)));
    }
    FindLastIndex(predicate: unknown): number {
        const test = requireFunction(predicate, 'FindLastIndex');
        for (let index = this.$items.length - 1; index >= 0; index--)
            if (test(this.$items[index]))
                return index;
        return -1;
    }
    FindAll(predicate: unknown): List {
        const test = requireFunction(predicate, 'FindAll');
        return List.from(this.$items.filter((item) => Boolean(test(item))));
    }
    Exists(predicate: unknown): boolean {
        const test = requireFunction(predicate, 'Exists');
        return this.$items.some((item) => Boolean(test(item)));
    }
    TrueForAll(predicate: unknown): boolean {
        const test = requireFunction(predicate, 'TrueForAll');
        return this.$items.every((item) => Boolean(test(item)));
    }
    ForEach(action: unknown): void {
        const fn = requireFunction(action, 'ForEach');
        for (const item of this.$items.slice())
            fn(item);
    }
    Sort(comparison?: unknown): void {
        if (comparison === undefined || comparison === null) {
            this.$items.sort(compare);
            return;
        }
        if (typeof comparison === 'function') {
            this.$items.sort((a, b) => Number((comparison as Fn)(a, b)));
            return;
        }
        const comparer = (comparison as {
            Compare?: unknown;
        }).Compare;
        if (typeof comparer === 'function') {
            this.$items.sort((a, b) => Number((comparer as Fn).call(comparison, a, b)));
            return;
        }
        throw new ArgumentException('Sort espera uma função de comparação (a, b) => int ou um IComparer.');
    }
    Reverse(): void {
        this.$items.reverse();
    }
    GetRange(index: unknown, count: unknown): List {
        const start = this.$position(index, 'GetRange: o índice');
        const amount = Number(count);
        if (!Number.isInteger(amount) || amount < 0 || start + amount > this.$items.length)
            throw new ArgumentException(`GetRange: ${str(count)} elementos a partir de ${start} passam do fim da lista.`);
        return List.from(this.$items.slice(start, start + amount));
    }
    CopyTo(array: unknown, arrayIndex: unknown = 0): void {
        if (!Array.isArray(array))
            throw new ArgumentException('CopyTo espera um array de destino.');
        const start = Number(arrayIndex);
        this.$items.forEach((item, index) => {
            array[start + index] = item;
        });
    }
    ToArray(): unknown[] {
        return this.$items.slice();
    }
    AsReadOnly(): List {
        return this;
    }
    TrimExcess(): void { }
    Equals(other: unknown): boolean {
        return this === other;
    }
    [Symbol.iterator](): Iterator<unknown> {
        return this.$items[Symbol.iterator]();
    }
    GetEnumerator(): Iterator<unknown> {
        return this[Symbol.iterator]();
    }
    ToString(): string {
        return `[${this.$items.map((item) => str(item)).join(', ')}]`;
    }
    get [TYPE_NAME](): string {
        return 'List';
    }
}
export class OrderedList extends List {
    $sortKeys: SortKey[] = [];
    $sourceItems: unknown[] = [];
    static sort(source: Iterable<unknown>, keys: SortKey[]): OrderedList {
        const items = toArray(source).map((item, index) => ({ item, index, keys: keys.map((key) => key.selector(item, index)) }));
        items.sort((a, b) => {
            for (let position = 0; position < keys.length; position++) {
                const result = compare(a.keys[position], b.keys[position]);
                if (result !== 0)
                    return keys[position].descending ? -result : result;
            }
            return a.index - b.index;
        });
        const list = new OrderedList();
        list.$items = items.map((entry) => entry.item);
        list.$sortKeys = keys;
        list.$sourceItems = toArray(source);
        return list;
    }
}
export class Grouping extends List {
    readonly Key: unknown;
    constructor(key: unknown) {
        super();
        this.Key = key;
    }
    get [TYPE_NAME](): string {
        return 'Grouping';
    }
}
interface Entry {
    readonly key: unknown;
    value: unknown;
}
