'use client';
import { useEffect, useRef, useState } from 'react';
import type { InputActionType } from '@/engine/input/actions/input-asset';
import { RebindListener } from '@/engine/input/rebinding/rebind-listener';
import type { LiveDevices } from './live-devices';
export interface ControlListener {
    readonly active: boolean;
    start(expected: InputActionType, onCaptured: (path: string) => void): void;
    cancel(): void;
}
function swallowKey(event: KeyboardEvent): void {
    event.preventDefault();
    event.stopPropagation();
}
export function useControlListener(devices: LiveDevices): ControlListener {
    const [active, setActive] = useState(false);
    const release = useRef<(() => void) | null>(null);
    const cancel = () => {
        release.current?.();
        release.current = null;
        setActive(false);
    };
    const start = (expected: InputActionType, onCaptured: (path: string) => void) => {
        cancel();
        const listener = new RebindListener({ expected, devices: () => devices.registry.all });
        const stopFrames = devices.onFrame((delta) => {
            const outcome = listener.update(delta);
            if (!outcome)
                return;
            cancel();
            if (outcome.status === 'completed')
                onCaptured(outcome.path);
        });
        window.addEventListener('keydown', swallowKey, true);
        window.addEventListener('keyup', swallowKey, true);
        release.current = () => {
            stopFrames();
            window.removeEventListener('keydown', swallowKey, true);
            window.removeEventListener('keyup', swallowKey, true);
        };
        setActive(true);
    };
    useEffect(() => () => release.current?.(), []);
    return { active, start, cancel };
}
