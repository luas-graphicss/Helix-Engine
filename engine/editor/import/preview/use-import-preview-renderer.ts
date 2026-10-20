'use client';
import { useEffect, useRef, useState } from 'react';
import { Renderer } from '@/engine/renderer/renderer';
import { WebGLUnsupportedError } from '@/engine/renderer/gl/context';
import type { CullingOptions } from '@/engine/renderer/culling/visible-set';
import type { LodSettings } from '@/engine/renderer/lod/lod-selector';
import type { ImportPreviewModel } from './import-preview-model';
export interface PreviewRenderSettings {
    grid: boolean;
    shadows: boolean;
}
const MAX_DELTA_SECONDS = 0.1;
const PREVIEW_CULLING: CullingOptions = { frustumCulling: true, minPixelSize: 0 };
const PREVIEW_LOD: LodSettings = { enabled: false, bias: 0 };
export function useImportPreviewRenderer(canvasRef: React.RefObject<HTMLCanvasElement | null>, model: ImportPreviewModel, settings: PreviewRenderSettings) {
    const [error, setError] = useState<string | null>(null);
    const settingsRef = useRef(settings);
    settingsRef.current = settings;
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        let renderer: Renderer;
        try {
            renderer = new Renderer(canvas);
        }
        catch (cause) {
            setError(cause instanceof WebGLUnsupportedError ? cause.message : 'Falha ao inicializar a pré-visualização.');
            return;
        }
        let frameHandle = 0;
        let lastFrameTime = performance.now();
        const frame = (now: number) => {
            const deltaSeconds = Math.min((now - lastFrameTime) / 1000, MAX_DELTA_SECONDS);
            lastFrameTime = now;
            renderer.render(model.scene, model.camera, {
                showGrid: settingsRef.current.grid,
                shadows: settingsRef.current.shadows,
                selectedId: null,
                gizmo: null,
                terrainBrush: null,
                elapsedSeconds: now / 1000,
                deltaSeconds,
                culling: PREVIEW_CULLING,
                lod: PREVIEW_LOD,
            });
            frameHandle = requestAnimationFrame(frame);
        };
        frameHandle = requestAnimationFrame(frame);
        return () => {
            cancelAnimationFrame(frameHandle);
            renderer.dispose();
        };
    }, [canvasRef, model]);
    return { error };
}
