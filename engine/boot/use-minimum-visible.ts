'use client';
import { useEffect, useState } from 'react';
function elapsedSince(since: number): number {
    return typeof performance === 'undefined' ? Infinity : performance.now() - since;
}
export function useMinimumVisible(ready: boolean, since: number, minimumMs: number): boolean {
    const [elapsed, setElapsed] = useState(() => elapsedSince(since) >= minimumMs);
    useEffect(() => {
        if (elapsed)
            return;
        const timer = setTimeout(() => setElapsed(true), Math.max(0, minimumMs - elapsedSince(since)));
        return () => clearTimeout(timer);
    }, [elapsed, since, minimumMs]);
    return ready && elapsed;
}
