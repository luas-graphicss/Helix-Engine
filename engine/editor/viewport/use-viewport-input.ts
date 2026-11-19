'use client';
import { useEffect } from 'react';
import type { ToolContribution, ToolPointer } from '@/engine/editor/extensions/tools/tool-contribution';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import type { GizmoPointer } from '@/engine/editor/transform/gizmo/gizmo-pointer';
import * as vec3 from '@/engine/core/math/vec3';
import { dragPointOnViewPlane, pickBone, pickEffector } from '@/engine/editor/animation/viewport/bone-picking';
import { gizmoCursor } from './gizmo-cursor';
import { pickEntity } from './pick-entity';
type DragMode = 'orbit' | 'pan' | 'gizmo' | 'terrain' | 'ik' | 'gui' | 'hud' | 'tool' | null;
const CLICK_DRAG_THRESHOLD_PX = 4;
export interface ViewportInputHandlers {
    onContextMenu: (clientX: number, clientY: number) => void;
}
export function useViewportInput(canvasRef: React.RefObject<HTMLCanvasElement | null>, session: EditorSession, handlers: ViewportInputHandlers) {
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        let mode: DragMode = null;
        let button = 0;
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
        const samplePointer = (event: PointerEvent): GizmoPointer => {
            const rect = canvasRect();
            return {
                x: event.clientX - rect.left,
                y: event.clientY - rect.top,
                width: rect.width,
                height: rect.height,
                ctrl: event.ctrlKey || event.metaKey,
                shift: event.shiftKey,
                alt: event.altKey,
            };
        };
        const sampleToolPointer = (event: PointerEvent, dragging: boolean): ToolPointer => {
            const pointer = samplePointer(event);
            return { x: pointer.x, y: pointer.y, u: pointer.x / pointer.width, v: pointer.y / pointer.height, button: event.button, dragging, ctrl: pointer.ctrl, shift: pointer.shift, alt: pointer.alt };
        };
        const pointerTool = (): ToolContribution | null => {
            const tool = session.extensions.toolController.active;
            return tool?.handlesPointer ? tool : null;
        };
        const pickAt = (pointer: GizmoPointer) => pickEntity(session.scene, session.camera, pointer.x / pointer.width, pointer.y / pointer.height, {
            lightHelpers: session.render.lightHelpers,
            soundHelpers: session.render.soundHelpers,
            vfxHelpers: session.render.vfxHelpers,
            selection: session.selectedIds,
        });
        const ikTarget = vec3.create();
        const animating = () => session.animation.active && session.animation.showSkeleton;
        const updateGuiHover = (pointer: GizmoPointer): boolean => {
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
        const updateHover = (pointer: GizmoPointer) => {
            const action = session.gizmo.hover(pointer);
            if (action) {
                session.animation.setHoveredBone(null);
                canvas.style.cursor = gizmoCursor(action, false);
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
        const updateTerrainHover = (pointer: GizmoPointer, shift: boolean): boolean => {
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
                session.gizmo.cancelDrag();
            else
                session.gizmo.commitDrag();
            mode = null;
            canvas.style.cursor = '';
            updateHover(samplePointer(event));
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
            const tool = event.button === 0 ? pointerTool() : null;
            if (tool) {
                mode = 'tool';
                canvas.setPointerCapture(event.pointerId);
                canvas.focus();
                event.preventDefault();
                tool.pointer('down', sampleToolPointer(event, true));
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
                const action = session.gizmo.beginDrag(pointer);
                if (action) {
                    mode = 'gizmo';
                    canvas.setPointerCapture(event.pointerId);
                    canvas.style.cursor = gizmoCursor(action, true);
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
            if (mode === 'tool') {
                pointerTool()?.pointer('move', sampleToolPointer(event, true));
                return;
            }
            if (mode === 'gizmo') {
                session.gizmo.updateDrag(samplePointer(event));
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
                if (session.playtest.isPossessing) {
                    if (!session.playtest.pointerLocked)
                        updateGuiHover(samplePointer(event));
                    return;
                }
                if (updateGuiHover(samplePointer(event)))
                    return;
                const tool = pointerTool();
                if (tool) {
                    canvas.style.cursor = tool.cursor ?? 'crosshair';
                    tool.pointer('move', sampleToolPointer(event, false));
                    return;
                }
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
            if (canvas.hasPointerCapture(event.pointerId))
                canvas.releasePointerCapture(event.pointerId);
            if (mode === 'tool') {
                mode = null;
                pointerTool()?.pointer('up', sampleToolPointer(event, false));
                return;
            }
            if (mode === 'hud') {
                mode = null;
                const pointer = samplePointer(event);
                session.hud.pointerUp(pointer.x, pointer.y);
                updateGuiHover(pointer);
                return;
            }
            if (mode === 'gui') {
                mode = null;
                const pointer = samplePointer(event);
                if (session.playtest.pointerLocked)
                    session.guiWorld.pointerUp(0.5, 0.5);
                else
                    session.guiWorld.pointerUp(pointer.x / pointer.width, pointer.y / pointer.height);
                if (!session.playtest.pointerLocked)
                    updateGuiHover(pointer);
                return;
            }
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
            session.hud.pointerLeave();
            if (!session.playtest.pointerLocked)
                session.guiWorld.pointerLeave();
            session.gizmo.clearHover();
            session.animation.setHoveredBone(null);
            session.terrain.clearHover();
            canvas.style.cursor = '';
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (!event.isComposing && ((session.hud.hasFocusedInput && session.hud.keyDown(event)) || (session.guiWorld.hasFocusedInput && session.guiWorld.keyDown(event)))) {
                event.preventDefault();
                event.stopImmediatePropagation();
                return;
            }
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
                session.gizmo.cancelDrag();
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
            if (session.hud.interactive) {
                const rect = canvasRect();
                if (session.hud.wheel(event.clientX - rect.left, event.clientY - rect.top, event.deltaX, event.deltaY))
                    return;
            }
            if (session.guiWorld.interactive) {
                const rect = canvasRect();
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
            event.stopPropagation();
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
        window.addEventListener('keyup', onKeyUp, { capture: true });
        window.addEventListener('resize', invalidateRect);
        window.addEventListener('scroll', invalidateRect, { capture: true, passive: true });
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
            window.removeEventListener('keyup', onKeyUp, { capture: true });
            window.removeEventListener('resize', invalidateRect);
            window.removeEventListener('scroll', invalidateRect, { capture: true });
        };
    }, [canvasRef, session, handlers]);
}
