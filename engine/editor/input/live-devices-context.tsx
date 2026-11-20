'use client';
import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { LiveDevices } from './live-devices';
const LiveDevicesContext = createContext<LiveDevices | null>(null);
export function LiveDevicesProvider({ children }: {
    children: ReactNode;
}) {
    const [devices] = useState(() => new LiveDevices());
    useEffect(() => {
        devices.attach();
        return () => devices.detach();
    }, [devices]);
    return <LiveDevicesContext.Provider value={devices}>{children}</LiveDevicesContext.Provider>;
}
export function useLiveDevices(): LiveDevices {
    const devices = useContext(LiveDevicesContext);
    if (!devices)
        throw new Error('useLiveDevices must be used inside LiveDevicesProvider.');
    return devices;
}
export function useDeviceFrames(): LiveDevices {
    const devices = useLiveDevices();
    const subscribe = useCallback((onFrame: () => void) => devices.onFrame(onFrame), [devices]);
    const frameOf = useCallback(() => devices.frame, [devices]);
    useSyncExternalStore(subscribe, frameOf, frameOf);
    return devices;
}
