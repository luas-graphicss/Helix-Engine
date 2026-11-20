import { parseControlPath } from '../controls/control-path';
const PART_SEPARATOR = '#';
const MAX_OVERRIDES = 512;
const MAX_KEY_LENGTH = 96;
function overrideKey(bindingId: string, part: string | null): string {
    return part === null ? bindingId : `${bindingId}${PART_SEPARATOR}${part}`;
}
export class BindingOverrides {
    version = 0;
    private readonly paths = new Map<string, string>();
    get size(): number {
        return this.paths.size;
    }
    pathOf(bindingId: string, part: string | null): string | undefined {
        return this.paths.get(overrideKey(bindingId, part));
    }
    set(bindingId: string, part: string | null, path: string): void {
        this.paths.set(overrideKey(bindingId, part), path);
        this.version++;
    }
    remove(bindingId: string): void {
        const partPrefix = `${bindingId}${PART_SEPARATOR}`;
        for (const key of Array.from(this.paths.keys()))
            if (key === bindingId || key.startsWith(partPrefix))
                this.paths.delete(key);
        this.version++;
    }
    clear(): void {
        this.paths.clear();
        this.version++;
    }
    toRecord(): Record<string, string> {
        return Object.fromEntries(this.paths);
    }
    load(stored: unknown): void {
        this.paths.clear();
        this.version++;
        if (typeof stored !== 'object' || stored === null || Array.isArray(stored))
            return;
        for (const [key, path] of Object.entries(stored).slice(0, MAX_OVERRIDES))
            if (key.length <= MAX_KEY_LENGTH && typeof path === 'string' && parseControlPath(path))
                this.paths.set(key, path);
    }
}
