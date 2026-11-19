export interface BudgetEntry {
    readonly topLevel: number;
    readonly maxTopLevel: number;
    readonly bytesAt: (topLevel: number) => number;
}
export function fitTopLevelsToBudget(entries: readonly BudgetEntry[], budgetBytes: number): number[] {
    const levels = entries.map((entry) => entry.topLevel);
    const bytes = entries.map((entry) => entry.bytesAt(entry.topLevel));
    let total = 0;
    for (const size of bytes)
        total += size;
    while (total > budgetBytes) {
        let largest = -1;
        for (let index = 0; index < entries.length; index++) {
            if (levels[index] >= entries[index].maxTopLevel)
                continue;
            if (largest < 0 || bytes[index] > bytes[largest])
                largest = index;
        }
        if (largest < 0)
            break;
        levels[largest]++;
        const reduced = entries[largest].bytesAt(levels[largest]);
        total -= bytes[largest] - reduced;
        bytes[largest] = reduced;
    }
    return levels;
}
