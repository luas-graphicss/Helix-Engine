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
    if (!entity || entity.locked)
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
        session.viewportRenderer = renderer;
        const governor = session.viewportGovernor;
        let frameHandle = 0;
        let frameCount = 0;
        let lastStatsTime = performance.now();
        let lastFrameTime = lastStatsTime;
        let lastRenderTime = lastStatsTime;
        let lastInputTime = lastStatsTime;
        let lastSignature = '';
        let settledFrames = 0;
        let publishedIdle = false;
        let drewLastTick = false;
        let consecutiveFailures = 0;
        let reportedError = '';
        const qualityGovernor = new FrameGovernor(EDITOR_QUALITY_LADDER);
        session.frameGovernor = qualityGovernor;
        const frameClock = new FrameClock();
        session.frameClock = frameClock;
        let frameInterval = resolveFrameInterval(renderer.profile);
        let editorLite = resolveEditorLite(renderer.profile);
        let qualityLadder = resolveQualityLadder(renderer.profile);
        const applyPreferences = () => {
            let changed = false;
            const nextInterval = resolveFrameInterval(renderer.profile);
            if (nextInterval !== frameInterval) {
                frameInterval = nextInterval;
                changed = true;
            }
            const nextLite = resolveEditorLite(renderer.profile);
            if (nextLite !== editorLite) {
                editorLite = nextLite;
                changed = true;
            }
            const nextLadder = resolveQualityLadder(renderer.profile);
            if (nextLadder !== qualityLadder) {
                qualityLadder = nextLadder;
                qualityGovernor.reset();
                changed = true;
            }
            const maxPixelRatio = resolveMaxPixelRatio(renderer.profile);
            if (renderer.maxPixelRatio !== maxPixelRatio) {
                renderer.maxPixelRatio = maxPixelRatio;
                changed = true;
            }
            if (changed)
                session.notify('view');
        };
        const unsubscribeSettings = engineSettings.subscribe(applyPreferences);
        const gizmoRequest: GizmoRenderRequest = { mode: 'translate', worldMatrix: mat4.create(), localAxes: false, scale: 1, hovered: null, active: null };
        const lightHelperRequest: LightHelperRequest = { mode: 'all', selection: null };
        const soundHelperRequest: SoundHelperRequest = {
            mode: 'all',
            selection: null,
            sourceState: (entityId) => session.audio.world.runtime(entityId),
            activeZoneId: null,
            elapsedSeconds: 0,
        };
        const vfxHelperRequest: VfxHelperRequest = {
            mode: 'all',
            selection: null,
            state: (entityId) => session.vfxWorld.helperState(entityId),
            elapsedSeconds: 0,
        };
        const wake = () => {
            lastInputTime = performance.now();
        };
        const wakeFromKey = (event: KeyboardEvent) => {
            if (isTextEntryTarget(event.target))
                return;
            wake();
        };
        const inputEvents = ['pointermove', 'pointerdown', 'pointerup', 'wheel', 'dragover', 'drop'] as const;
        for (const type of inputEvents)
            canvas.addEventListener(type, wake, { passive: true });
        window.addEventListener('keydown', wakeFromKey, { passive: true });
        window.addEventListener('keyup', wakeFromKey, { passive: true });
        const fail = (message: string) => {
            setError(message);
            session.markViewportReady();
        };
        const onContextLost = (event: Event) => {
            event.preventDefault();
            cancelAnimationFrame(frameHandle);
            frameHandle = 0;
            session.log.warn('Viewport', 'O contexto gráfico foi perdido (driver reiniciado ou memória de vídeo esgotada); o viewport volta assim que o navegador o restaurar.');
            fail('O contexto gráfico foi perdido; aguardando o navegador restaurá-lo…');
        };
        const onContextRestored = () => {
            session.log.info('Viewport', 'Contexto gráfico restaurado; o viewport foi recriado.');
            setGeneration((count) => count + 1);
        };
        canvas.addEventListener('webglcontextlost', onContextLost);
        canvas.addEventListener('webglcontextrestored', onContextRestored);
        const draw = (now: number, deltaSeconds: number, elapsedSeconds: number, quality: QualityStep, profileGpu: boolean): void => {
            const selection = session.selectedIds.size > 0 ? session.selectedIds : null;
            const playing = session.playtest.state === 'playing';
            renderer.render(session.scene, session.camera, {
                quality,
                qualityLevel: quality === FULL_QUALITY ? 0 : qualityGovernor.level,
                editorLite: editorLite && !playing,
                showGrid: session.showGrid,
                shadows: session.shadowsEnabled,
                selection,
                showCsgBrushes: session.render.showCsgBrushes && session.playtest.state !== 'playing',
                gizmo: resolveGizmoRequest(session, gizmoRequest),
                terrainBrush: session.terrain.brushOverlay,
                lightHelpers: resolveLightHelpers(session, lightHelperRequest, selection),
                soundHelpers: resolveSoundHelpers(session, soundHelperRequest, selection, elapsedSeconds),
                vfxHelpers: resolveVfxHelpers(session, vfxHelperRequest, selection, elapsedSeconds),
                guiSurfaces: session.guiWorld.system.draws,
                vfx: session.vfxWorld.system.draws,
                soloLight: session.render.soloLightId,
                skeletons: session.animation.overlayRequest(),
                elapsedSeconds,
                deltaSeconds,
                culling: session.render.culling,
                lod: session.render.lod,
                myriad: session.render.myriad,
                terrainMaterialCache: session.render.terrain.materialCache,
                postCompareSplit: session.render.postCompare.enabled && session.playtest.state !== 'playing' ? session.render.postCompare.split : null,
                profileGpu,
                capture: session.capture.pending,
                scripts: session.scripts.renderRequest ?? session.shaderPreview.renderRequest,
            });
            session.colorPicker.sample(renderer.gl);
            session.frameProfile.add('render', renderer.stats.cpuMs);
            lastRenderTime = now;
            frameCount++;
        };
        const tick = (now: number): void => {
            const uiBusy = governor.uiBusy;
            const minInterval = uiBusy ? Math.max(frameInterval, UI_BUSY_FRAME_MS) : frameInterval;
            if (minInterval > 0 && now - lastFrameTime < minInterval - FRAME_LIMIT_TOLERANCE_MS)
                return;
            const rawDeltaSeconds = Math.min((now - lastFrameTime) / 1000, MAX_DELTA_SECONDS);
            lastFrameTime = now;
            const deltaSeconds = frameClock.update(rawDeltaSeconds);
            const elapsedSeconds = now / 1000;
            const frameBudget = Math.max(minInterval, DEFAULT_FRAME_BUDGET_MS);
            session.playtest.physicsBudgetMs = frameBudget * PHYSICS_BUDGET_SHARE;
            const simulating = session.tick(deltaSeconds, elapsedSeconds);
            const playing = session.playtest.state === 'playing';
            const signature = sessionSignature(session);
            const sessionChanged = signature !== lastSignature;
            lastSignature = signature;
            renderer.holdResize = governor.resizing;
            const interacting = now - lastInputTime < INPUT_WAKE_MS;
            let mustDraw = !session.render.renderOnDemand || simulating || sessionChanged;
            if (!mustDraw) {
                const settling = settledFrames < SETTLE_FRAMES && !uiBusy;
                mustDraw = settling || session.colorPicker.active || session.capture.pending || interacting || renderer.inputsChanged(session.camera);
            }
            let safetyFrame = !mustDraw && now - lastRenderTime >= IDLE_REFRESH_MS;
            if (governor.covered || document.hidden) {
                if (mustDraw || safetyFrame)
                    governor.pendingFrame = true;
                frameClock.reset();
                if (!session.capture.pending) {
                    mustDraw = false;
                    safetyFrame = false;
                }
            }
            else if (governor.pendingFrame) {
                governor.pendingFrame = false;
                mustDraw = true;
                settledFrames = 0;
            }
            if (mustDraw || safetyFrame) {
                qualityGovernor.setLadder(playing ? QUALITY_LADDER : EDITOR_QUALITY_LADDER);
                if (!playing && qualityLadder === 'play' && qualityGovernor.level > 0)
                    qualityGovernor.reset();
                const continuous = simulating || interacting || !session.render.renderOnDemand;
                const laddered = qualityLadder === 'always' || (qualityLadder === 'play' && playing);
                const governing = laddered && continuous && renderer.ready;
                const sinceLastRender = now - lastRenderTime;
                let quality = FULL_QUALITY;
                if (governing) {
                    const measurable = drewLastTick && !renderer.stats.transient;
                    const gpuMs = renderer.stats.gpuMs;
                    const cpuMs = session.frameProfile.measuredMs + renderer.stats.cpuMs;
                    const loadMs = gpuMs > 0 ? Math.max(gpuMs, cpuMs) : sinceLastRender;
                    quality = measurable ? qualityGovernor.update(sinceLastRender, frameBudget, loadMs) : qualityGovernor.step;
                }
                else {
                    qualityGovernor.interrupt();
                }
                const profileGpu = session.render.profileGpu || session.render.perfHud || governing;
                const continuousFrame = drewLastTick;
                draw(now, deltaSeconds, elapsedSeconds, quality, profileGpu);
                session.frameProfile.endFrame(continuousFrame ? sinceLastRender : 0, quality === FULL_QUALITY ? 0 : qualityGovernor.level);
                drewLastTick = true;
                if (!session.viewportReady && renderer.ready)
                    session.markViewportReady();
                if (session.capture.pending)
                    session.capture.fulfill(renderer);
                if (safetyFrame)
                    frameCount--;
                settledFrames = renderer.stats.settled && !simulating && !sessionChanged ? settledFrames + 1 : 0;
                if (safetyFrame && !renderer.stats.settled)
                    mustDraw = true;
            }
            else {
                drewLastTick = false;
                qualityGovernor.interrupt();
                if (qualityGovernor.level > 0 && now - lastInputTime >= GOVERNOR_IDLE_RESET_MS)
                    qualityGovernor.reset();
                session.frameProfile.endFrame(0, 0);
            }
            const idle = !mustDraw;
            const elapsed = now - lastStatsTime;
            if (elapsed >= STATS_INTERVAL_MS || !session.viewportReady) {
                if (frameCount > 0 || idle !== publishedIdle) {
                    session.updateStats(renderer.stats, Math.round((frameCount * 1000) / elapsed), idle);
                    publishedIdle = idle;
                }
                frameCount = 0;
                lastStatsTime = now;
            }
        };
        const frame = (now: number) => {
            try {
                tick(now);
                consecutiveFailures = 0;
            }
            catch (cause) {
                if (cause instanceof WebGLContextLostError || renderer.gl.isContextLost()) {
                    if (frameHandle !== 0)
                        onContextLost(new Event('webglcontextlost'));
                    return;
                }
                const message = describeFrameError(cause);
                if (message !== reportedError) {
                    reportedError = message;
                    session.log.error('Viewport', `Falha ao renderizar o frame: ${message}`);
                    console.error('[Helix] Falha ao renderizar:', cause);
                }
                drewLastTick = false;
                qualityGovernor.interrupt();
                if (++consecutiveFailures >= MAX_CONSECUTIVE_FRAME_FAILURES) {
                    fail(message);
                    return;
                }
            }
            frameHandle = requestAnimationFrame(frame);
        };
        frameHandle = requestAnimationFrame(frame);
        return () => {
            cancelAnimationFrame(frameHandle);
            unsubscribeSettings();
            canvas.removeEventListener('webglcontextlost', onContextLost);
            canvas.removeEventListener('webglcontextrestored', onContextRestored);
            for (const type of inputEvents)
                canvas.removeEventListener(type, wake);
            window.removeEventListener('keydown', wakeFromKey);
            window.removeEventListener('keyup', wakeFromKey);
            renderer.dispose();
            rendererRef.current = null;
            if (session.viewportRenderer === renderer)
                session.viewportRenderer = null;
            if (session.frameGovernor === qualityGovernor)
                session.frameGovernor = null;
            if (session.frameClock === frameClock)
                session.frameClock = null;
        };
    }, [canvasRef, session, generation]);
    return { error };
}
