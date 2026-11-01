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
};
