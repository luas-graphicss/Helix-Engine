import type { Scene } from '@/engine/core/scene/scene';
import { codeViewOptionsFromSettings } from '@/engine/editor/code/code-preferences';
import { liveVerifierFor } from '@/engine/editor/code/verification/live-verifier';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { PHYSICS_QUALITY_PRESETS } from '@/engine/physics/world/physics-settings';
import { ORBIT_BASE_SPEEDS } from '@/engine/renderer/camera/orbit-controller';
import { engineSettings } from '../engine-settings-store';
export function applySessionOpenDefaults(session: EditorSession): void {
    const get = engineSettings.get.bind(engineSettings);
    session.tool = get('editor.open.tool');
    session.space = get('editor.open.space');
    session.showGrid = get('editor.open.grid');
    session.shadowsEnabled = get('editor.open.shadows');
    session.snap.enabled = get('snap.enabled');
    session.snap.translate = get('snap.translate');
    session.snap.rotate = get('snap.rotate');
    session.snap.scale = get('snap.scale');
    session.gui.options = {
        grid: get('gui.grid'),
        gridSize: get('gui.gridSize'),
        snapGrid: get('gui.snapGrid'),
        snapGuides: get('gui.snapGuides'),
        rulers: get('gui.rulers'),
        outlines: get('gui.outlines'),
        safeArea: get('gui.safeArea'),
        checkerboard: get('gui.checkerboard'),
        deviceFrame: get('gui.deviceFrame'),
        devicePixels: get('gui.devicePixels'),
    };
    session.playtest.setTimeScale(get('simulation.timeScale'));
    session.render.perfHud = get('editor.open.perfHud');
    session.code.presentation = get('code.presentation');
    session.code.commandBarVisible = get('code.commandBar');
}
export function applyNewScenePhysicsDefaults(scene: Scene): void {
    Object.assign(scene.physics, PHYSICS_QUALITY_PRESETS[engineSettings.get('simulation.physics.quality')], {
        fixedTimestep: 1 / Number(engineSettings.get('simulation.physics.stepRate')),
        sleepEnabled: engineSettings.get('simulation.physics.sleep'),
        warmStarting: engineSettings.get('simulation.physics.warmStarting'),
    });
}
export function applyRuntimeSessionSettings(session: EditorSession): void {
    const get = engineSettings.get.bind(engineSettings);
    const { orbit, render } = session;
    orbit.orbitSpeed = ORBIT_BASE_SPEEDS.orbit * get('editor.camera.orbitSpeed');
    orbit.panSpeed = ORBIT_BASE_SPEEDS.pan * get('editor.camera.panSpeed');
    orbit.zoomSpeed = ORBIT_BASE_SPEEDS.zoom * get('editor.camera.zoomSpeed') * (get('editor.camera.invertZoom') ? -1 : 1);
    orbit.invertOrbitY = get('editor.camera.invertOrbitY');
    session.camera.fovDegrees = get('editor.camera.fov');
    render.renderOnDemand = get('render.onDemand');
    render.lod.enabled = get('render.lod.enabled');
    render.lod.bias = get('render.lod.bias');
    render.culling.frustumCulling = get('render.culling.frustum');
    render.culling.minPixelSize = get('render.culling.minPixelSize');
    render.myriad.enabled = get('render.myriad.enabled');
    render.myriad.pixelError = get('render.myriad.pixelError');
    render.myriad.occlusionCulling = get('render.myriad.occlusion');
    render.myriad.shadowClusters = get('render.myriad.shadowClusters');
    render.terrain.materialCache = get('render.terrainCache');
    render.showCsgBrushes = get('render.csgGhosts');
    render.lightHelpers = get('render.helpers.lights');
    render.soundHelpers = get('render.helpers.sounds');
    render.vfxHelpers = get('render.helpers.vfx');
    session.audio.engine.setMonitorGain(get('audio.monitorVolume') / 100);
}
export function applyLiveSessionSettings(session: EditorSession): void {
    const get = engineSettings.get.bind(engineSettings);
    applyRuntimeSessionSettings(session);
    session.focusPadding = get('selection.focusPadding');
    session.log.setLimit(get('editor.console.limit'));
    session.autosave.settingsChanged();
    session.code.setOptions(codeViewOptionsFromSettings());
    liveVerifierFor(session).settingsChanged();
}
