'use client';
import { useEffect } from 'react';
import type { Entity } from '@/engine/core/scene/entity';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { GizmoDrag, type PointerSample } from '@/engine/editor/gizmo/gizmo-drag';
import { hitTestGizmo } from '@/engine/editor/gizmo/gizmo-hit-test';
import { computeGizmoFrame, createGizmoFrame, type GizmoHandle, type GizmoMode } from '@/engine/renderer/gizmo/gizmo-frame';
import { pickEntity } from './pick-entity';
type DragMode = 'orbit' | 'pan' | 'gizmo' | 'terrain' | null;
interface GizmoHit {
    handle: GizmoHandle;
    mode: GizmoMode;
    entity: Entity;
}
const CLICK_DRAG_THRESHOLD_PX = 4;
const GIZMO_CURSOR: Record<GizmoMode, string> = { translate: 'move', rotate: 'grab', scale: 'nwse-resize' };
export interface ViewportInputHandlers {
    onContextMenu: (clientX: number, clientY: number) => void;
}
export function useViewportInput(canvasRef: React.RefObject<HTMLCanvasElement | null>, session: EditorSession, handlers: ViewportInputHandlers) {
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        const frame = createGizmoFrame();
        let gizmoDrag: GizmoDrag | null = null;
        let mode: DragMode = null;
        let button = 0;
        let lastX = 0;
        let lastY = 0;
        let startX = 0;
        let startY = 0;
        let moved = false;
        const samplePointer = (event: PointerEvent): PointerSample => {
            const rect = canvas.getBoundingClientRect();
            return {
                x: event.clientX - rect.left,
                y: event.clientY - rect.top,
                width: rect.width,
                height: rect.height,
                ctrl: event.ctrlKey || event.metaKey,
            };
        };
        const pickAt = (pointer: PointerSample) => pickEntity(session.scene, session.camera, pointer.x / pointer.width, pointer.y / pointer.height);
        const gizmoHitAt = (pointer: PointerSample): GizmoHit | null => {
            const gizmoMode = session.gizmoMode;
            if (!gizmoMode)
                return null;
            const entity = session.selectedEntity;
            if (!entity)
                return null;
            if (!computeGizmoFrame(frame, entity.worldMatrix, session.camera, session.gizmoUsesLocalAxes))
                return null;
            const handle = hitTestGizmo(gizmoMode, frame, session.camera, pointer.x, pointer.y, pointer);
            return handle ? { handle, mode: gizmoMode, entity } : null;
        };
        const updateHover = (pointer: PointerSample) => {
            const hit = gizmoHitAt(pointer);
            session.gizmo.hovered = hit?.handle ?? null;
            canvas.style.cursor = hit ? GIZMO_CURSOR[hit.mode] : '';
        };
        const updateTerrainHover = (pointer: PointerSample, shift: boolean): boolean => {
            const hit = session.terrain.updateHover(pointer.x / pointer.width, pointer.y / pointer.height);
            session.terrain.setInvert(shift);
            canvas.style.cursor = hit ? 'crosshair' : '';
            return hit;
        };
        const finishTerrainStroke = (cancelled: boolean) => {
            if (cancelled)
                session.terrain.cancelStroke();
            else
                session.terrain.endStroke();
            mode = null;
        };
        const finishGizmoDrag = (event: PointerEvent, cancelled: boolean) => {
            if (cancelled)
                gizmoDrag?.cancel();
            else
                gizmoDrag?.commit();
            gizmoDrag = null;
            session.gizmo.active = null;
            mode = null;
            canvas.style.cursor = '';
            updateHover(samplePointer(event));
        };
        const onPointerDown = (event: PointerEvent) => {
            if (event.button === 0 && session.tool === 'terrain') {
                const pointer = samplePointer(event);
                if (updateTerrainHover(pointer, event.shiftKey) && session.terrain.beginStroke(event.shiftKey)) {
                    mode = 'terrain';
                    canvas.setPointerCapture(event.pointerId);
                    canvas.focus();
                    event.preventDefault();
                    return;
                }
            }
            if (event.button === 0 && !event.shiftKey) {
                const pointer = samplePointer(event);
                const hit = gizmoHitAt(pointer);
                if (hit) {
                    mode = 'gizmo';
                    gizmoDrag = new GizmoDrag(session, hit.entity, hit.mode, hit.handle, frame, pointer);
                    session.gizmo.active = hit.handle;
                    canvas.setPointerCapture(event.pointerId);
                    canvas.style.cursor = hit.mode === 'rotate' ? 'grabbing' : GIZMO_CURSOR[hit.mode];
                    canvas.focus();
                    event.preventDefault();
                    return;
                }
            }
            if (event.button === 1 || (event.button === 0 && event.shiftKey)) {
                mode = 'pan';
            }
            else if (event.button === 0 || event.button === 2) {
                mode = 'orbit';
            }
            else {
                return;
            }
            button = event.button;
            canvas.setPointerCapture(event.pointerId);
            lastX = startX = event.clientX;
            lastY = startY = event.clientY;
            moved = false;
            canvas.focus();
            event.preventDefault();
        };
        const onPointerMove = (event: PointerEvent) => {
            if (mode === 'gizmo') {
                gizmoDrag?.update(samplePointer(event));
                return;
            }
            if (mode === 'terrain') {
                updateTerrainHover(samplePointer(event), event.shiftKey);
                return;
            }
            if (!mode) {
                if (session.tool === 'terrain')
                    updateTerrainHover(samplePointer(event), event.shiftKey);
                else
                    updateHover(samplePointer(event));
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
            canvas.releasePointerCapture(event.pointerId);
            if (mode === 'gizmo') {
                finishGizmoDrag(event, event.type === 'pointercancel');
                return;
            }
            if (mode === 'terrain') {
                finishTerrainStroke(event.type === 'pointercancel');
                updateTerrainHover(samplePointer(event), event.shiftKey);
                return;
            }
            const wasClick = !moved && !event.shiftKey;
            canvas.style.cursor = '';
            mode = null;
            if (!wasClick)
                return;
            const pointer = samplePointer(event);
            if (button === 0) {
                session.select(pickAt(pointer));
                updateHover(pointer);
            }
            else if (button === 2) {
                const hit = pickAt(pointer);
                if (hit)
                    session.select(hit);
                handlers.onContextMenu(event.clientX, event.clientY);
            }
        };
        const onPointerLeave = () => {
            if (mode)
                return;
            session.gizmo.hovered = null;
            session.terrain.clearHover();
            canvas.style.cursor = '';
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Shift' && session.tool === 'terrain')
                session.terrain.setInvert(true);
            if (event.key !== 'Escape' || (mode !== 'gizmo' && mode !== 'terrain'))
                return;
            if (mode === 'gizmo') {
                gizmoDrag?.cancel();
                gizmoDrag = null;
                session.gizmo.active = null;
                mode = null;
            }
            else {
                finishTerrainStroke(true);
            }
            canvas.style.cursor = '';
            event.preventDefault();
            event.stopImmediatePropagation();
        };
        const onKeyUp = (event: KeyboardEvent) => {
            if (event.key === 'Shift' && session.tool === 'terrain')
                session.terrain.setInvert(false);
        };
        const onWheel = (event: WheelEvent) => {
            event.preventDefault();
            session.orbit.zoom(event.deltaY);
        };
        const suppressNativeContextMenu = (event: MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();
        };
        canvas.addEventListener('pointerdown', onPointerDown);
        canvas.addEventListener('pointermove', onPointerMove);
        canvas.addEventListener('pointerup', onPointerUp);
        canvas.addEventListener('pointercancel', onPointerUp);
        canvas.addEventListener('pointerleave', onPointerLeave);
        canvas.addEventListener('wheel', onWheel, { passive: false });
        canvas.addEventListener('contextmenu', suppressNativeContextMenu);
        window.addEventListener('keydown', onKeyDown, { capture: true });
        window.addEventListener('keyup', onKeyUp, { capture: true });
        return () => {
            canvas.removeEventListener('pointerdown', onPointerDown);
            canvas.removeEventListener('pointermove', onPointerMove);
            canvas.removeEventListener('pointerup', onPointerUp);
            canvas.removeEventListener('pointercancel', onPointerUp);
            canvas.removeEventListener('pointerleave', onPointerLeave);
            canvas.removeEventListener('wheel', onWheel);
            canvas.removeEventListener('contextmenu', suppressNativeContextMenu);
            window.removeEventListener('keydown', onKeyDown, { capture: true });
            window.removeEventListener('keyup', onKeyUp, { capture: true });
        };
    }, [canvasRef, session, handlers]);
}
