const startedAt = typeof performance !== 'undefined' ? performance.now() : 0;
export function bootStartedAt(): number {
    return startedAt;
}
