'use client';
import { useCallback, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
export type ResizeAxis = 'horizontal' | 'vertical';
type ResizableSizeOptions = {
    initial: number;
    min: number;
    max: number;
    axis: ResizeAxis;
    inverted?: boolean;
};
function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}
export function useResizableSize({ initial, min, max, axis, inverted = false }: ResizableSizeOptions) {
    const [size, setSize] = useState(initial);
    const [isResizing, setIsResizing] = useState(false);
    const dragStart = useRef<{
        pointer: number;
        size: number;
    } | null>(null);
    const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragStart.current = {
            pointer: axis === 'horizontal' ? event.clientX : event.clientY,
            size,
        };
        setIsResizing(true);
    }, [axis, size]);
    const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
        if (!dragStart.current)
            return;
        const pointer = axis === 'horizontal' ? event.clientX : event.clientY;
        const delta = pointer - dragStart.current.pointer;
        const next = dragStart.current.size + (inverted ? -delta : delta);
        setSize(clamp(next, min, max));
    }, [axis, inverted, min, max]);
    const onPointerUp = useCallback((event: ReactPointerEvent<HTMLElement>) => {
        dragStart.current = null;
        setIsResizing(false);
        event.currentTarget.releasePointerCapture(event.pointerId);
    }, []);
    const handleProps = { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp };
    return { size, isResizing, handleProps };
}
