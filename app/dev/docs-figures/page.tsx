'use client';
import { useEffect, useState } from 'react';
import { FIGURE_SCENES } from '@/docs/figures/figure-scenes';
import { createRenderSettings } from '@/engine/editor/session/render-settings';
import { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import { Renderer } from '@/engine/renderer/renderer';
const MIN_READY_FRAMES = 6;
const WEBP_QUALITY = 0.92;
export default function DocsFiguresPage() {
    const [lines, setLines] = useState<string[]>([]);
    useEffect(() => {
        let cancelled = false;
        const log = (line: string) => setLines((previous) => [...previous, line]);
        const run = async () => {
            const only = new URLSearchParams(window.location.search).get('id');
            const scenes = only ? FIGURE_SCENES.filter((scene) => scene.id === only) : FIGURE_SCENES;
            if (scenes.length === 0) {
                log(`nenhuma figura com id "${only}"`);
                return;
            }
            const canvas = document.createElement('canvas');
            const renderer = new Renderer(canvas);
            const settings = createRenderSettings();
            try {
                for (const figure of scenes) {
                    renderer.setFixedSize(figure.width, figure.height);
                    const camera = new PerspectiveCamera();
                    camera.aspect = figure.width / figure.height;
                    const scene = figure.build(camera);
                    let frames = 0;
                    let readyFrames = 0;
                    let last = performance.now();
                    while (!cancelled) {
                        const now = await new Promise<number>(requestAnimationFrame);
                        const deltaSeconds = Math.min(0.1, (now - last) / 1000);
                        last = now;
                        scene.updateWorldMatrices();
                        renderer.render(scene, camera, {
                            showGrid: figure.showGrid,
                            shadows: true,
                            selection: null,
                            showCsgBrushes: false,
                            gizmo: figure.gizmo?.(scene) ?? null,
                            skeletons: null,
                            terrainBrush: null,
                            lightHelpers: null,
                            soundHelpers: null,
                            vfxHelpers: null,
                            soloLight: null,
                            elapsedSeconds: now / 1000,
                            deltaSeconds,
                            culling: settings.culling,
                            lod: settings.lod,
                            myriad: settings.myriad,
                            terrainMaterialCache: settings.terrain.materialCache,
                            postCompareSplit: null,
                            profileGpu: false,
                        });
                        frames++;
                        if (renderer.ready)
                            readyFrames++;
                        if (frames % 10 === 0)
                            log(`${figure.id} frame ${frames} shaders=${renderer.stats.shadersPending} complete=${renderer.frameComplete}`);
                        if (readyFrames >= MIN_READY_FRAMES && renderer.frameComplete)
                            break;
                    }
                    if (cancelled)
                        return;
                    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY));
                    if (!blob) {
                        log(`${figure.id}: toBlob falhou`);
                        continue;
                    }
                    const response = await fetch(`/api/dev/docs-figure?id=${encodeURIComponent(figure.id)}`, { method: 'POST', body: blob });
                    log(`${figure.id}: salvo (${blob.size} bytes, status ${response.status}, ${frames} frames)`);
                }
                log('done');
            }
            finally {
                renderer.dispose();
            }
        };
        void run().catch((cause) => log(`erro: ${cause instanceof Error ? cause.message : String(cause)}`));
        return () => {
            cancelled = true;
        };
    }, []);
    return <pre id="log">{lines.join('\n')}</pre>;
}
