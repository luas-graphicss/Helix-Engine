export function unusedId(prefix: string, taken: ReadonlySet<string>): string {
    let index = taken.size + 1;
    while (taken.has(`${prefix}${index}`))
        index++;
    return `${prefix}${index}`;
}
