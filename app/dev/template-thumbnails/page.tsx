'use client';
import { useEffect, useState } from 'react';
import { createRenderSettings } from '@/engine/editor/session/render-settings';
import { PROJECT_TEMPLATES } from '@/engine/project/templates/project-templates';
import { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import { Renderer } from '@/engine/renderer/renderer';
import { TerrainMaterialLibrary } from '@/engine/terrain/materials/terrain-material-library';
const WIDTH = 800;
const HEIGHT = 450;
const MIN_READY_FRAMES = 4;
export default function TemplateThumbnailsPage() {
    const [lines, setLines] = useState<string[]>([]);
    useEffect(() => {
        let cancelled = false;
        const log = (line: string) => setLines((previous) => [...previous, line]);
        const run = async () => {
            const only = new URLSearchParams(window.location.search).get('id');
            const templates = only ? PROJECT_TEMPLATES.filter((template) => template.id === only) : PROJECT_TEMPLATES;
            if (templates.length === 0) {
                log(`nenhum template com id "${only}"`);
                return;
            }
            const canvas = document.createElement('canvas');
            const renderer = new Renderer(canvas);
            renderer.setFixedSize(WIDTH, HEIGHT);
            const settings = createRenderSettings();
            try {
                for (const template of templates) {
                    const materials = new TerrainMaterialLibrary(() => { });
                    const scene = template.createPreviewScene({ terrainMaterials: materials, onRigReady: () => { } });
                    const camera = new PerspectiveCamera();
                    camera.aspect = WIDTH / HEIGHT;
                    template.preview.frame(scene, camera);
                    let frames = 0;
                    let readyFrames = 0;
                    let last = performance.now();
                    while (!cancelled) {
                        const now = await new Promise<number>(requestAnimationFrame);
                        const deltaSeconds = Math.min(0.1, (now - last) / 1000);
                        last = now;
                        renderer.render(scene, camera, {
                            showGrid: template.preview.showGrid,
                            shadows: true,
                            selection: null,
                            showCsgBrushes: false,
                            gizmo: null,
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
                        const loading = materials.list().some((material) => material.loading);
                        if (frames % 10 === 0)
                            log(`${template.id} frame ${frames} shaders=${renderer.stats.shadersPending} complete=${renderer.frameComplete} loading=${loading}`);
                        if (readyFrames >= MIN_READY_FRAMES && renderer.frameComplete && !loading)
                            break;
                    }
                    if (cancelled)
                        return;
                    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.92));
                    if (!blob) {
                        log(`${template.id}: toBlob falhou`);
                        continue;
                    }
                    const response = await fetch(`/api/dev/template-thumbnail?id=${template.id}`, { method: 'POST', body: blob });
                    log(`${template.id}: salvo (${blob.size} bytes, status ${response.status}, ${frames} frames)`);
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
