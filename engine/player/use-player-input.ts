'use client';
import { useEffect } from 'react';
import type { EditorSession } from '@/engine/editor/session/editor-session';
type DragMode = 'orbit' | 'pan' | 'gui' | 'hud' | null;
const CLICK_DRAG_THRESHOLD_PX = 4;
export function usePlayerInput(canvasRef: React.RefObject<HTMLCanvasElement | null>, session: EditorSession): void {
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        let mode: DragMode = null;
        let lastX = 0;
        let lastY = 0;
        let startX = 0;
        let startY = 0;
        let moved = false;
        let rectCache: DOMRect | null = null;
        const canvasRect = (): DOMRect => (rectCache ??= canvas.getBoundingClientRect());
        const invalidateRect = () => {
            rectCache = null;
        };
        const samplePointer = (event: PointerEvent) => {
            const rect = canvasRect();
            return { x: event.clientX - rect.left, y: event.clientY - rect.top, width: rect.width, height: rect.height };
        };
        const updateGuiHover = (pointer: {
            x: number;
            y: number;
            width: number;
            height: number;
        }): boolean => {
            if (session.hud.pointerMove(pointer.x, pointer.y)) {
                session.guiWorld.pointerLeave();
                canvas.style.cursor = session.hud.cursor ?? '';
                return true;
            }
            if (!session.guiWorld.interactive)
                return false;
            const over = session.guiWorld.pointerMove(pointer.x / pointer.width, pointer.y / pointer.height);
            canvas.style.cursor = over ? (session.guiWorld.cursor ?? '') : '';
            return over;
        };
        const onPointerDown = (event: PointerEvent) => {
            invalidateRect();
            if (event.button === 0 && session.hud.interactive) {
                const pointer = samplePointer(event);
                if (session.hud.pointerDown(pointer.x, pointer.y)) {
                    mode = 'hud';
                    canvas.setPointerCapture(event.pointerId);
                    canvas.focus();
                    event.preventDefault();
                    return;
                }
            }
            if (event.button === 0 && session.guiWorld.interactive) {
                const pointer = samplePointer(event);
                const locked = session.playtest.pointerLocked;
                const accepted = locked ? session.guiWorld.pointerDown(0.5, 0.5) : session.guiWorld.pointerDown(pointer.x / pointer.width, pointer.y / pointer.height);
                if (accepted) {
                    mode = 'gui';
                    if (!locked)
                        canvas.setPointerCapture(event.pointerId);
                    canvas.focus();
                    event.preventDefault();
                    return;
                }
            }
            if (session.playtest.isPossessing)
                return;
            if (event.button === 1 || (event.button === 0 && event.shiftKey))
                mode = 'pan';
            else if (event.button === 0 || event.button === 2)
                mode = 'orbit';
            else
                return;
            canvas.setPointerCapture(event.pointerId);
            lastX = startX = event.clientX;
            lastY = startY = event.clientY;
            moved = false;
            canvas.focus();
            event.preventDefault();
        };
        const onPointerMove = (event: PointerEvent) => {
            if (mode === 'hud') {
                const pointer = samplePointer(event);
                session.hud.pointerMove(pointer.x, pointer.y);
                return;
            }
            if (mode === 'gui') {
                if (!session.playtest.pointerLocked) {
                    const pointer = samplePointer(event);
                    session.guiWorld.pointerMove(pointer.x / pointer.width, pointer.y / pointer.height);
                }
                return;
            }
            if (!mode) {
                if (!session.playtest.pointerLocked)
                    updateGuiHover(samplePointer(event));
                return;
            }
            const deltaX = event.clientX - lastX;
            const deltaY = event.clientY - lastY;
            lastX = event.clientX;
            lastY = event.clientY;
            if (!moved && Math.hypot(event.clientX - startX, event.clientY - startY) > CLICK_DRAG_THRESHOLD_PX) {
                moved = true;
                canvas.style.cursor = mode === 'pan' ? 'grabbing' : 'move';
            }
            if (!moved)
                return;
            if (mode === 'pan')
                session.orbit.pan(deltaX, deltaY);
            else
                session.orbit.orbit(deltaX, deltaY);
        };
        const onPointerUp = (event: PointerEvent) => {
            if (!mode)
                return;
            if (canvas.hasPointerCapture(event.pointerId))
                canvas.releasePointerCapture(event.pointerId);
            const pointer = samplePointer(event);
            if (mode === 'hud') {
                mode = null;
                session.hud.pointerUp(pointer.x, pointer.y);
                updateGuiHover(pointer);
                return;
            }
            if (mode === 'gui') {
                mode = null;
                if (session.playtest.pointerLocked)
                    session.guiWorld.pointerUp(0.5, 0.5);
                else {
                    session.guiWorld.pointerUp(pointer.x / pointer.width, pointer.y / pointer.height);
                    updateGuiHover(pointer);
                }
                return;
            }
            mode = null;
            canvas.style.cursor = '';
        };
        const onPointerLeave = () => {
            if (mode)
                return;
            session.hud.pointerLeave();
            if (!session.playtest.pointerLocked)
                session.guiWorld.pointerLeave();
            canvas.style.cursor = '';
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.isComposing)
                return;
            if ((session.hud.hasFocusedInput && session.hud.keyDown(event)) || (session.guiWorld.hasFocusedInput && session.guiWorld.keyDown(event))) {
                event.preventDefault();
                event.stopImmediatePropagation();
            }
        };
        const onWheel = (event: WheelEvent) => {
            event.preventDefault();
            const rect = canvasRect();
            if (session.hud.interactive && session.hud.wheel(event.clientX - rect.left, event.clientY - rect.top, event.deltaX, event.deltaY))
                return;
            if (session.guiWorld.interactive) {
                const locked = session.playtest.pointerLocked;
                const u = locked ? 0.5 : (event.clientX - rect.left) / rect.width;
                const v = locked ? 0.5 : (event.clientY - rect.top) / rect.height;
                if (session.guiWorld.wheel(u, v, event.deltaX, event.deltaY))
                    return;
            }
            if (session.playtest.isPossessing)
                return;
            session.orbit.zoom(event.deltaY);
        };
        const suppressNativeContextMenu = (event: MouseEvent) => {
            event.preventDefault();
        };
        const rectObserver = new ResizeObserver(invalidateRect);
        rectObserver.observe(canvas);
        canvas.addEventListener('pointerdown', onPointerDown);
        canvas.addEventListener('pointermove', onPointerMove);
        canvas.addEventListener('pointerup', onPointerUp);
        canvas.addEventListener('pointercancel', onPointerUp);
        canvas.addEventListener('pointerenter', invalidateRect);
        canvas.addEventListener('pointerleave', onPointerLeave);
        canvas.addEventListener('wheel', onWheel, { passive: false });
        canvas.addEventListener('contextmenu', suppressNativeContextMenu);
        window.addEventListener('keydown', onKeyDown, { capture: true });
        window.addEventListener('resize', invalidateRect);
        return () => {
            rectObserver.disconnect();
            canvas.removeEventListener('pointerdown', onPointerDown);
            canvas.removeEventListener('pointermove', onPointerMove);
            canvas.removeEventListener('pointerup', onPointerUp);
            canvas.removeEventListener('pointercancel', onPointerUp);
            canvas.removeEventListener('pointerenter', invalidateRect);
            canvas.removeEventListener('pointerleave', onPointerLeave);
            canvas.removeEventListener('wheel', onWheel);
            canvas.removeEventListener('contextmenu', suppressNativeContextMenu);
            window.removeEventListener('keydown', onKeyDown, { capture: true });
            window.removeEventListener('resize', invalidateRect);
        };
    }, [canvasRef, session]);
}
