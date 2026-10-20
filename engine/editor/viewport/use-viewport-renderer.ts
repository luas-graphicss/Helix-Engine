'use client';
import { useEffect, useRef, useState } from 'react';
import { Renderer } from '@/engine/renderer/renderer';
import { WebGLUnsupportedError } from '@/engine/renderer/gl/context';
import type { GizmoRenderRequest } from '@/engine/renderer/passes/gizmo-pass';
import * as mat4 from '@/engine/core/math/mat4';
import type { EditorSession } from '@/engine/editor/session/editor-session';
const STATS_INTERVAL_MS = 500;
const MAX_DELTA_SECONDS = 0.1;
function resolveGizmoRequest(session: EditorSession, request: GizmoRenderRequest): GizmoRenderRequest | null {
    const mode = session.gizmoMode;
    if (!mode)
        return null;
    const entity = session.selectedEntity;
    if (!entity)
        return null;
    request.mode = mode;
    request.worldMatrix = entity.worldMatrix;
    request.localAxes = session.gizmoUsesLocalAxes;
    request.hovered = session.gizmo.hovered;
    request.active = session.gizmo.active;
    return request;
}
export function useViewportRenderer(canvasRef: React.RefObject<HTMLCanvasElement | null>, session: EditorSession) {
    const [error, setError] = useState<string | null>(null);
    const rendererRef = useRef<Renderer | null>(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        let renderer: Renderer;
        try {
            renderer = new Renderer(canvas);
        }
        catch (cause) {
            setError(cause instanceof WebGLUnsupportedError ? cause.message : 'Falha ao inicializar o renderizador.');
            console.error('[v0] Falha ao criar renderer:', cause);
            return;
        }
        rendererRef.current = renderer;
        let frameHandle = 0;
        let frameCount = 0;
        let lastStatsTime = performance.now();
        let lastFrameTime = lastStatsTime;
        const gizmoRequest: GizmoRenderRequest = { mode: 'translate', worldMatrix: mat4.create(), localAxes: false, hovered: null, active: null };
        const frame = (now: number) => {
            const deltaSeconds = Math.min((now - lastFrameTime) / 1000, MAX_DELTA_SECONDS);
            lastFrameTime = now;
            session.tick(deltaSeconds);
            renderer.render(session.scene, session.camera, {
                showGrid: session.showGrid,
                shadows: session.shadowsEnabled,
                selectedId: session.selectedId,
                gizmo: resolveGizmoRequest(session, gizmoRequest),
                terrainBrush: session.terrain.brushOverlay,
                elapsedSeconds: now / 1000,
                deltaSeconds,
                culling: session.render.culling,
                lod: session.render.lod,
            });
            frameCount++;
            const elapsed = now - lastStatsTime;
            if (elapsed >= STATS_INTERVAL_MS) {
                session.updateStats(renderer.stats, Math.round((frameCount * 1000) / elapsed));
                frameCount = 0;
                lastStatsTime = now;
            }
            frameHandle = requestAnimationFrame(frame);
        };
        frameHandle = requestAnimationFrame(frame);
        return () => {
            cancelAnimationFrame(frameHandle);
            renderer.dispose();
            rendererRef.current = null;
        };
    }, [canvasRef, session]);
    return { error };
}
