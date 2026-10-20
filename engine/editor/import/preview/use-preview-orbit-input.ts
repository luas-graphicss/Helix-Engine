'use client';
import { useEffect } from 'react';
import type { OrbitController } from '@/engine/renderer/camera/orbit-controller';
type DragMode = 'orbit' | 'pan' | null;
export function usePreviewOrbitInput(canvasRef: React.RefObject<HTMLCanvasElement | null>, orbit: OrbitController): void {
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        let mode: DragMode = null;
        let lastX = 0;
        let lastY = 0;
        const onPointerDown = (event: PointerEvent) => {
            if (event.button === 1 || (event.button === 0 && event.shiftKey))
                mode = 'pan';
            else if (event.button === 0 || event.button === 2)
                mode = 'orbit';
            else
                return;
            lastX = event.clientX;
            lastY = event.clientY;
            canvas.setPointerCapture(event.pointerId);
            canvas.style.cursor = mode === 'pan' ? 'grabbing' : 'move';
            event.preventDefault();
        };
        const onPointerMove = (event: PointerEvent) => {
            if (!mode)
                return;
            const deltaX = event.clientX - lastX;
            const deltaY = event.clientY - lastY;
            lastX = event.clientX;
            lastY = event.clientY;
            if (mode === 'pan')
                orbit.pan(deltaX, deltaY);
            else
                orbit.orbit(deltaX, deltaY);
        };
        const onPointerUp = (event: PointerEvent) => {
            if (!mode)
                return;
            canvas.releasePointerCapture(event.pointerId);
            mode = null;
            canvas.style.cursor = '';
        };
        const onWheel = (event: WheelEvent) => {
            event.preventDefault();
            orbit.zoom(event.deltaY);
        };
        const suppressContextMenu = (event: MouseEvent) => event.preventDefault();
        canvas.addEventListener('pointerdown', onPointerDown);
        canvas.addEventListener('pointermove', onPointerMove);
        canvas.addEventListener('pointerup', onPointerUp);
        canvas.addEventListener('pointercancel', onPointerUp);
        canvas.addEventListener('wheel', onWheel, { passive: false });
        canvas.addEventListener('contextmenu', suppressContextMenu);
        return () => {
            canvas.removeEventListener('pointerdown', onPointerDown);
            canvas.removeEventListener('pointermove', onPointerMove);
            canvas.removeEventListener('pointerup', onPointerUp);
            canvas.removeEventListener('pointercancel', onPointerUp);
            canvas.removeEventListener('wheel', onWheel);
            canvas.removeEventListener('contextmenu', suppressContextMenu);
        };
    }, [canvasRef, orbit]);
}
