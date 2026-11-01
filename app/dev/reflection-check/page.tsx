'use client';
import { useEffect, useRef, useState } from 'react';
import * as vec3 from '@/engine/core/math/vec3';
import { createRenderSettings } from '@/engine/editor/session/render-settings';
import { getProjectTemplate } from '@/engine/project/templates/project-templates';
import { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import { Renderer } from '@/engine/renderer/renderer';
import { TerrainMaterialLibrary } from '@/engine/terrain/materials/terrain-material-library';
const WIDTH = 960;
const HEIGHT = 540;
function readNumber(params: URLSearchParams, key: string, fallback: number): number {
    const value = Number(params.get(key));
    return Number.isFinite(value) && params.has(key) ? value : fallback;
}
type DumpKind = 'ssr' | 'ssrAlpha' | 'history' | 'surface';
function dumpTexture(gl: WebGL2RenderingContext, texture: WebGLTexture, width: number, height: number, kind: DumpKind, target: HTMLCanvasElement): string {
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    const isFloat = kind !== 'surface';
    const pixels = isFloat ? new Float32Array(width * height * 4) : new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, isFloat ? gl.FLOAT : gl.UNSIGNED_BYTE, pixels);
    const error = gl.getError();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(framebuffer);
    target.width = width;
    target.height = height;
    const context = target.getContext('2d');
    if (!context)
        return 'sem 2d';
    const image = context.createImageData(width, height);
    let sumA = 0;
    let maxR = 0;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const src = (y * width + x) * 4;
            const dst = ((height - 1 - y) * width + x) * 4;
            let r = pixels[src];
            let g = pixels[src + 1];
            let b = pixels[src + 2];
            const a = pixels[src + 3];
            if (isFloat) {
                sumA += a;
                maxR = Math.max(maxR, r);
                if (kind === 'ssrAlpha') {
                    r = g = b = a;
                }
                else {
                    r = r / (1 + r);
                    g = g / (1 + g);
                    b = b / (1 + b);
                }
                image.data[dst] = Math.round(Math.min(1, Math.max(0, r)) * 255);
                image.data[dst + 1] = Math.round(Math.min(1, Math.max(0, g)) * 255);
                image.data[dst + 2] = Math.round(Math.min(1, Math.max(0, b)) * 255);
            }
            else {
                image.data[dst] = r;
                image.data[dst + 1] = g;
                image.data[dst + 2] = b;
            }
            image.data[dst + 3] = 255;
        }
    }
    context.putImageData(image, 0, 0);
    return `dump ${kind} ${width}x${height} fb=0x${status.toString(16)} err=${error} meanA=${(sumA / (width * height)).toFixed(3)} maxR=${maxR.toFixed(2)}`;
}
export default function ReflectionCheckPage() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const dumpRef = useRef<HTMLCanvasElement>(null);
    const [status, setStatus] = useState('iniciando');
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        let cancelled = false;
        const params = new URLSearchParams(window.location.search);
        const renderer = new Renderer(canvas);
        renderer.setFixedSize(WIDTH, HEIGHT);
        const settings = createRenderSettings();
        const materials = new TerrainMaterialLibrary(() => { });
        const template = getProjectTemplate('reflections');
        const scene = template.createPreviewScene({ terrainMaterials: materials, onRigReady: () => { } });
        const camera = new PerspectiveCamera();
        camera.aspect = WIDTH / HEIGHT;
        template.preview.frame(scene, camera);
        vec3.set(camera.position, readNumber(params, 'x', camera.position[0]), readNumber(params, 'y', camera.position[1]), readNumber(params, 'z', camera.position[2]));
        vec3.set(camera.target, readNumber(params, 'tx', camera.target[0]), readNumber(params, 'ty', camera.target[1]), readNumber(params, 'tz', camera.target[2]));
        camera.fovDegrees = readNumber(params, 'fov', camera.fovDegrees);
        const maxFrames = readNumber(params, 'frames', 400);
        const flag = (key: string, fallback: boolean) => (params.has(key) ? params.get(key) !== '0' : fallback);
        const reflections = { probe: flag('probe', true), screenSpace: flag('ssr', true), water: flag('water', true), intensity: readNumber(params, 'intensity', 1) };
        if (!flag('clouds', true))
            scene.sky.clouds.enabled = false;
        if (!flag('cloudShadow', true))
            scene.sky.clouds.shadows = false;
        let frames = 0;
        let last = performance.now();
        const run = async () => {
            while (!cancelled && frames < maxFrames) {
                const now = await new Promise<number>(requestAnimationFrame);
                const deltaSeconds = Math.min(0.1, (now - last) / 1000);
                last = now;
                renderer.render(scene, camera, {
                    showGrid: false,
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
                    reflections,
                });
                frames++;
                const loading = materials.list().some((material) => material.loading);
                const stats = renderer.stats;
                let dumpInfo = '';
                const dumpKind = params.get('dump') as DumpKind | null;
                const dumpCanvas = dumpRef.current;
                if (dumpKind && dumpCanvas && renderer.ready && frames % 30 === 0) {
                    const internals = renderer as unknown as {
                        gl: WebGL2RenderingContext;
                        reflections: {
                            screenPass: {
                                texture: WebGLTexture;
                                width: number;
                                height: number;
                            };
                            history: {
                                texture: WebGLTexture;
                                width: number;
                                height: number;
                            };
                            surfaceBuffer: {
                                texture: WebGLTexture;
                                width: number;
                                height: number;
                            };
                        };
                    };
                    const { gl, reflections: r } = internals;
                    const source = dumpKind === 'history' ? r.history : dumpKind === 'surface' ? r.surfaceBuffer : r.screenPass;
                    dumpInfo = dumpTexture(gl, source.texture, source.width, source.height, dumpKind, dumpCanvas);
                }
                setStatus(`frame ${frames} ready=${renderer.ready} complete=${renderer.frameComplete} loading=${loading} shaders=${stats.shadersPending} probeValid=${stats.reflectionProbeValid} probeFaces=${stats.reflectionProbeFaces} ssr=${stats.reflectionScreenTraced} settled=${stats.settled} ${dumpInfo}`);
            }
        };
        void run().catch((cause) => setStatus(`erro: ${cause instanceof Error ? cause.message : String(cause)}`));
        return () => {
            cancelled = true;
            renderer.dispose();
        };
    }, []);
    return (<main style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 8, background: '#111', minHeight: '100vh' }}>
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} style={{ width: WIDTH, height: HEIGHT }}/>
      <pre id="status" style={{ color: '#ddd', fontSize: 12 }}>
        {status}
      </pre>
      <canvas ref={dumpRef} style={{ width: WIDTH, height: HEIGHT, imageRendering: 'pixelated' }}/>
    </main>);
}
