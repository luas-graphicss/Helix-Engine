'use client';
import { useSyncExternalStore } from 'react';
import type { BuildProgressSnapshot } from './build-progress';
import { gameCompiler } from './game-compiler';
const IDLE_SNAPSHOT: BuildProgressSnapshot = {
    status: 'idle',
    stage: null,
    stageFraction: 0,
    totalFraction: 0,
    etaSeconds: null,
    detail: null,
    startedAt: null,
    finishedAt: null,
    log: [],
    completed: new Set(),
};
const subscribe = (listener: () => void) => gameCompiler.subscribe(listener);
const getSnapshot = () => gameCompiler.snapshot();
const getServerSnapshot = () => IDLE_SNAPSHOT;
export function useBuildProgress(): BuildProgressSnapshot {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
