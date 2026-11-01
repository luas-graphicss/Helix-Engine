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
    size?: number;
    onSizeChange?: (size: number) => void;
    measure?: () => number | undefined;
    onResizingChange?: (resizing: boolean) => void;
};
function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}
export function useResizableSize({ initial, min, max, axis, inverted = false, size: controlledSize, onSizeChange, measure, onResizingChange }: ResizableSizeOptions) {
    const [internalSize, setInternalSize] = useState(initial);
    const [isResizing, setIsResizing] = useState(false);
    const dragStart = useRef<{
        pointer: number;
        size: number;
    } | null>(null);
    const size = controlledSize ?? internalSize;
    const onResizingChangeRef = useRef(onResizingChange);
    onResizingChangeRef.current = onResizingChange;
    const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragStart.current = {
            pointer: axis === 'horizontal' ? event.clientX : event.clientY,
            size: measure?.() ?? size,
        };
        setIsResizing(true);
        onResizingChangeRef.current?.(true);
    }, [axis, size, measure]);
    const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
        if (!dragStart.current)
            return;
        const pointer = axis === 'horizontal' ? event.clientX : event.clientY;
        const delta = pointer - dragStart.current.pointer;
        const next = clamp(dragStart.current.size + (inverted ? -delta : delta), min, max);
        setInternalSize(next);
        onSizeChange?.(next);
    }, [axis, inverted, min, max, onSizeChange]);
    const onPointerUp = useCallback((event: ReactPointerEvent<HTMLElement>) => {
        if (!dragStart.current)
            return;
        dragStart.current = null;
        setIsResizing(false);
        onResizingChangeRef.current?.(false);
        if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
    }, []);
    const handleProps = { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp };
    return { size, isResizing, handleProps };
}
