export interface Contribution {
    readonly id: string;
}
export class RegistrationClock {
    private value = 0;
    get current(): number {
        return this.value;
    }
    next(): number {
        return ++this.value;
    }
}
interface Entry<TContribution> {
    readonly contribution: TContribution;
    readonly ownerAssetId: string | null;
    readonly sequence: number;
}
export interface OwnedContributions {
    countOwnedBy(ownerAssetId: string): number;
    sweep(ownerAssetId: string, registeredUpTo: number): void;
    clear(): void;
}
type Listener = () => void;
export class ContributionRegistry<TContribution extends Contribution> implements OwnedContributions {
    private readonly entries = new Map<string, Entry<TContribution>>();
    private readonly listeners = new Set<Listener>();
    private snapshot: readonly TContribution[] = [];
    private version = 0;
    constructor(private readonly clock: RegistrationClock, private readonly onRemoved: (contribution: TContribution) => void = () => undefined) { }
    readonly subscribe = (listener: Listener): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };
    readonly getVersion = (): number => this.version;
    register(contribution: TContribution, ownerAssetId: string | null): () => void {
        const replaced = this.entries.get(contribution.id);
        const entry: Entry<TContribution> = { contribution, ownerAssetId, sequence: this.clock.next() };
        this.entries.set(contribution.id, entry);
        if (replaced)
            this.onRemoved(replaced.contribution);
        this.changed();
        return () => {
            this.removeWhere((candidate) => candidate === entry);
        };
    }
    unregister(id: string): boolean {
        return this.removeWhere((entry) => entry.contribution.id === id) > 0;
    }
    get(id: string): TContribution | null {
        return this.entries.get(id)?.contribution ?? null;
    }
    list(): readonly TContribution[] {
        return this.snapshot;
    }
    countOwnedBy(ownerAssetId: string): number {
        let count = 0;
        for (const entry of this.entries.values())
            if (entry.ownerAssetId === ownerAssetId)
                count++;
        return count;
    }
    sweep(ownerAssetId: string, registeredUpTo: number): void {
        this.removeWhere((entry) => entry.ownerAssetId === ownerAssetId && entry.sequence <= registeredUpTo);
    }
    clear(): void {
        this.removeWhere(() => true);
    }
    private removeWhere(matches: (entry: Entry<TContribution>) => boolean): number {
        const removed = Array.from(this.entries.values()).filter(matches);
        for (const entry of removed) {
            this.entries.delete(entry.contribution.id);
            this.onRemoved(entry.contribution);
        }
        if (removed.length > 0)
            this.changed();
        return removed.length;
    }
    private changed(): void {
        this.snapshot = Array.from(this.entries.values(), (entry) => entry.contribution);
        this.version++;
        for (const listener of this.listeners)
            listener();
    }
}
