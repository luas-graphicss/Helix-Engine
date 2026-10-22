'use client';
import { useEffect } from 'react';
import type { Entity } from '@/engine/core/scene/entity';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { GizmoDrag, type PointerSample } from '@/engine/editor/gizmo/gizmo-drag';
import { hitTestGizmo } from '@/engine/editor/gizmo/gizmo-hit-test';
import { computeGizmoFrame, createGizmoFrame, type GizmoHandle, type GizmoMode } from '@/engine/renderer/gizmo/gizmo-frame';
import * as vec3 from '@/engine/core/math/vec3';
import { dragPointOnViewPlane, pickBone, pickEffector } from '@/engine/editor/animation/viewport/bone-picking';
import { pickEntity } from './pick-entity';
type DragMode = 'orbit' | 'pan' | 'gizmo' | 'terrain' | 'ik' | null;
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
        const ikTarget = vec3.create();
        const animating = () => session.animation.active && session.animation.showSkeleton;
        const updateHover = (pointer: PointerSample) => {
            const hit = gizmoHitAt(pointer);
            session.gizmo.hovered = hit?.handle ?? null;
            if (hit) {
                session.animation.setHoveredBone(null);
                canvas.style.cursor = GIZMO_CURSOR[hit.mode];
                return;
            }
            if (!animating()) {
                canvas.style.cursor = '';
                return;
            }
            if (pickEffector(session.animation, session.camera, pointer)) {
                session.animation.setHoveredBone(null);
                canvas.style.cursor = 'grab';
                return;
            }
            const bone = pickBone(session.animation, session.camera, pointer);
            session.animation.setHoveredBone(bone?.name ?? null);
            canvas.style.cursor = bone ? 'pointer' : '';
        };
        const finishIkDrag = (event: PointerEvent, cancelled: boolean) => {
            session.animation.endIkDrag(cancelled);
            mode = null;
            canvas.style.cursor = '';
            updateHover(samplePointer(event));
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
            if (session.playtest.isPossessing)
                return;
            if (session.colorPicker.active) {
                if (event.button === 0) {
                    session.colorPicker.move(canvas, event.clientX, event.clientY);
                    session.colorPicker.commit();
                }
                else {
                    session.colorPicker.cancel();
                }
                canvas.style.cursor = '';
                event.preventDefault();
                return;
            }
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
                if (animating()) {
                    const effector = pickEffector(session.animation, session.camera, pointer);
                    if (effector && session.animation.beginIkDrag(effector.performer, effector.limb)) {
                        mode = 'ik';
                        canvas.setPointerCapture(event.pointerId);
                        canvas.style.cursor = 'grabbing';
                        canvas.focus();
                        event.preventDefault();
                        return;
                    }
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
            if (session.colorPicker.active) {
                session.colorPicker.move(canvas, event.clientX, event.clientY);
                canvas.style.cursor = 'crosshair';
                return;
            }
            if (mode === 'gizmo') {
                gizmoDrag?.update(samplePointer(event));
                return;
            }
            if (mode === 'ik') {
                const anchor = session.animation.ikTarget;
                if (anchor && dragPointOnViewPlane(ikTarget, session.camera, anchor, samplePointer(event)))
                    session.animation.updateIkDrag(ikTarget);
                return;
            }
            if (mode === 'terrain') {
                updateTerrainHover(samplePointer(event), event.shiftKey);
                return;
            }
            if (!mode) {
                if (session.playtest.isPossessing)
                    return;
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
            if (mode === 'ik') {
                finishIkDrag(event, event.type === 'pointercancel');
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
                const bone = animating() ? pickBone(session.animation, session.camera, pointer) : null;
                const hit = bone ? bone.performer.rig.joints[bone.joint] : pickAt(pointer);
                if (pointer.ctrl && hit)
                    session.toggleSelection(hit);
                else if (!pointer.ctrl)
                    session.select(hit);
                updateHover(pointer);
            }
            else if (button === 2) {
                const hit = pickAt(pointer);
                if (hit && !session.isSelected(hit))
                    session.select(hit);
                handlers.onContextMenu(event.clientX, event.clientY);
            }
        };
        const onPointerLeave = () => {
            session.colorPicker.leave();
            if (mode)
                return;
            session.gizmo.hovered = null;
            session.animation.setHoveredBone(null);
            session.terrain.clearHover();
            canvas.style.cursor = '';
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Shift' && session.tool === 'terrain')
                session.terrain.setInvert(true);
            if (event.key === 'Escape' && session.colorPicker.active) {
                session.colorPicker.cancel();
                canvas.style.cursor = '';
                event.preventDefault();
                event.stopImmediatePropagation();
                return;
            }
            if (event.key !== 'Escape' || (mode !== 'gizmo' && mode !== 'terrain' && mode !== 'ik'))
                return;
            if (mode === 'gizmo') {
                gizmoDrag?.cancel();
                gizmoDrag = null;
                session.gizmo.active = null;
                mode = null;
            }
            else if (mode === 'ik') {
                session.animation.endIkDrag(true);
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
            if (session.playtest.isPossessing)
                return;
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
