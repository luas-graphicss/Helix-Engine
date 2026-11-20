import { WireError } from '../wire/wire-error';
const MAX_NAMES = 4096;
export interface ResolvedName {
    readonly id: number;
    readonly isNew: boolean;
}
export class NameTable {
    private readonly ids = new Map<string, number>();
    resolve(name: string): ResolvedName {
        const known = this.ids.get(name);
        if (known !== undefined)
            return { id: known, isNew: false };
        if (this.ids.size >= MAX_NAMES)
            throw new RangeError(`more than ${MAX_NAMES} distinct remote procedure names in one connection`);
        const id = this.ids.size;
        this.ids.set(name, id);
        return { id, isNew: true };
    }
}
export class NameDirectory {
    private readonly names: string[] = [];
    define(id: number, name: string): void {
        if (id !== this.names.length || id >= MAX_NAMES)
            throw new WireError(`name ${id} was defined out of order`);
        this.names.push(name);
    }
    nameOf(id: number): string | undefined {
        return this.names[id];
    }
}
