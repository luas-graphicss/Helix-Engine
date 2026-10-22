'use client';
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { DockLayoutStore, type DockLayoutState } from './dock-layout';
const DockLayoutContext = createContext<DockLayoutStore | null>(null);
export function DockLayoutProvider({ children }: {
    children: ReactNode;
}) {
    const [store] = useState(() => new DockLayoutStore());
    useEffect(() => {
        void store.load();
    }, [store]);
    return <DockLayoutContext.Provider value={store}>{children}</DockLayoutContext.Provider>;
}
export function useDockLayoutStore(): DockLayoutStore {
    const store = useContext(DockLayoutContext);
    if (!store)
        throw new Error('useDockLayoutStore deve ser usado dentro de DockLayoutProvider.');
    return store;
}
export function useDockLayout(): [
    DockLayoutState,
    DockLayoutStore
] {
    const store = useDockLayoutStore();
    const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    return [state, store];
}
