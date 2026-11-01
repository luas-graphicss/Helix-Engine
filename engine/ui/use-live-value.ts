'use client';
import { useCallback, useRef, useState } from 'react';
export function useLiveValue(value: number, onChange: (value: number) => void) {
    const [live, setLive] = useState<number | null>(null);
    const dragging = useRef(false);
    const handleChange = useCallback((next: number) => {
        if (dragging.current)
            setLive(next);
        onChange(next);
    }, [onChange]);
    const onPointerDown = useCallback(() => {
        dragging.current = true;
    }, []);
    const release = useCallback(() => {
        dragging.current = false;
        setLive((current) => (current === null ? current : null));
    }, []);
    return {
        shown: live ?? value,
        handleChange,
        dragHandlers: { onPointerDown, onPointerUp: release, onPointerCancel: release, onLostPointerCapture: release, onBlur: release },
    };
}
