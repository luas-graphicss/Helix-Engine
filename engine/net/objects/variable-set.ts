import { equalNetValues, type NetValue } from '../wire/net-value';
export type VariableWriter = 'server' | 'owner';
export interface VariableDefinition {
    readonly name: string;
    readonly initial: NetValue;
    readonly writer: VariableWriter;
}
export type VariableWatcher = (value: NetValue, previous: NetValue) => void;
function detach(value: NetValue): NetValue {
    return typeof value === 'object' && value !== null ? structuredClone(value) : value;
}
export class VariableSet {
    private readonly indexByName = new Map<string, number>();
    private readonly values: NetValue[] = [];
    private readonly dirty = new Set<number>();
    private readonly watchers = new Map<number, Set<VariableWatcher>>();
    readonly definitions: readonly VariableDefinition[];
    constructor(definitions: readonly VariableDefinition[]) {
        this.definitions = definitions.map((definition) => ({ ...definition, initial: detach(definition.initial) }));
        this.definitions.forEach((definition, index) => {
            this.indexByName.set(definition.name, index);
            this.values.push(detach(definition.initial));
        });
    }
    get hasDirty(): boolean {
        return this.dirty.size > 0;
    }
    indexOf(name: string): number | undefined {
        return this.indexByName.get(name);
    }
    writerOf(index: number): VariableWriter | undefined {
        return this.definitions[index]?.writer;
    }
    get(name: string): NetValue | undefined {
        const index = this.indexByName.get(name);
        return index === undefined ? undefined : detach(this.values[index]);
    }
    valueAt(index: number): NetValue {
        return this.values[index];
    }
    set(name: string, value: NetValue): boolean {
        const index = this.indexByName.get(name);
        if (index === undefined)
            return false;
        if (this.store(index, value))
            this.dirty.add(index);
        return true;
    }
    apply(index: number, value: NetValue): boolean {
        if (index >= this.values.length)
            return false;
        this.store(index, value);
        return true;
    }
    markDirty(index: number): void {
        this.dirty.add(index);
    }
    takeDirty(): number[] {
        const indices = Array.from(this.dirty);
        this.dirty.clear();
        return indices;
    }
    watch(name: string, watcher: VariableWatcher): () => void {
        const index = this.indexByName.get(name);
        if (index === undefined)
            return () => undefined;
        let watchers = this.watchers.get(index);
        if (!watchers) {
            watchers = new Set();
            this.watchers.set(index, watchers);
        }
        watchers.add(watcher);
        return () => {
            this.watchers.get(index)?.delete(watcher);
        };
    }
    snapshot(): VariableDefinition[] {
        return this.definitions.map((definition, index) => ({ ...definition, initial: this.values[index] }));
    }
    private store(index: number, value: NetValue): boolean {
        const previous = this.values[index];
        if (equalNetValues(previous, value))
            return false;
        this.values[index] = detach(value);
        for (const watcher of Array.from(this.watchers.get(index) ?? []))
            watcher(detach(value), previous);
        return true;
    }
}
