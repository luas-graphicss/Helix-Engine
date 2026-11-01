import type { Entity } from '@/engine/core/scene/entity';
import { auditBridge, type BridgeAudit } from '../api-manifest';
import type { RuntimeHost, ScriptContext, ScriptHandle } from '../runtime/runtime-host';
import { createAnimationApi } from './animation';
import { createAssetsApi } from './assets';
import { createAudioApi } from './audio';
import { createCameraApi } from './camera';
import { createCharacterApi, createPlayerApi } from './character';
import { createDebugApi, createEngineInfo, createEventsApi, createLogApi, createTaskApi, createTimeApi } from './core';
import { createEditorApi } from './editor';
import { createGuiApi } from './gui';
import { createInputApi } from './input';
import { createLightApi } from './light';
import { createMaterialApi } from './material';
import { createMathApi } from './math';
import { createMeshApi } from './mesh';
import { createPhysicsApi, type AxisLocks } from './physics';
import { createNetApi, createPlayApi, netRealmFor } from './play';
import { createProjectApi, createStorageApi } from './project';
import { createPropsApi, type PropRegistry } from './props';
import { guardRealms } from './realm-guard';
import { createPostApi, createRenderApi } from './render';
import { createSceneApi } from './scene';
import { createSkyApi, createWorldApi } from './sky';
import { createTerrainApi } from './terrain';
import { createVfxApi } from './vfx';
export class ActorScript {
    declare readonly actor: Entity;
    declare readonly self: Entity;
    declare readonly entity: Entity;
    declare readonly helix: HelixRoot;
    declare readonly script: ScriptHandle;
}
export type HelixRoot = Record<string, unknown>;
export interface HelixBridges {
    readonly props: PropRegistry;
    readonly locks: AxisLocks;
}
export function createHelixRoot(host: RuntimeHost, bridges: HelixBridges): HelixRoot {
    const { scene, transform } = createSceneApi(host);
    const { mesh, csg } = createMeshApi(host);
    const { material, materials, texture } = createMaterialApi(host);
    const root: HelixRoot = {
        engine: createEngineInfo(),
        ActorScript,
        time: createTimeApi(host),
        task: createTaskApi(host),
        log: createLogApi(host),
        debug: createDebugApi(host, host.debug),
        events: createEventsApi(host),
        math: createMathApi(),
        props: createPropsApi(host, bridges.props),
        scene,
        transform,
        mesh,
        csg,
        material,
        materials,
        texture,
        light: createLightApi(host, scene),
        camera: createCameraApi(host, host.cameraEffects),
        sky: createSkyApi(host),
        world: createWorldApi(host),
        post: createPostApi(host),
        render: createRenderApi(host, host.renderState),
        physics: createPhysicsApi(host, bridges.locks),
        character: createCharacterApi(host),
        player: createPlayerApi(host),
        terrain: createTerrainApi(host, scene),
        gui: createGuiApi(host),
        audio: createAudioApi(host),
        animation: createAnimationApi(host),
        vfx: createVfxApi(host, scene),
        input: createInputApi(host),
        assets: createAssetsApi(host),
        project: createProjectApi(host),
        storage: createStorageApi(host),
        play: createPlayApi(host),
        net: createNetApi(host),
        editor: host.mode === 'editor' ? createEditorApi(host) : undefined,
    };
    Object.defineProperties(root, {
        context: { enumerable: true, get: () => host.current?.runContext ?? 'shared' },
        isEditor: { enumerable: true, get: () => host.mode === 'editor' },
        isPlaying: { enumerable: true, get: () => host.running && host.mode === 'play' },
        self: { enumerable: true, get: () => host.current?.self ?? null },
        script: { enumerable: true, get: () => host.current?.handle ?? null },
        __esModule: { value: true },
        default: { value: root },
    });
    return guardRealms(host, root);
}
export function createHelixFor(host: RuntimeHost, root: HelixRoot, context: ScriptContext): HelixRoot {
    const view: HelixRoot = Object.create(root);
    Object.defineProperties(view, {
        self: { enumerable: true, get: () => context.self },
        script: { enumerable: true, get: () => context.handle },
        context: { enumerable: true, get: () => context.runContext },
        net: { enumerable: true, get: () => host.net.facade(netRealmFor(host, context.runContext)) },
        default: { value: view },
    });
    return view;
}
export function auditHelixRoot(root: HelixRoot, mode: 'play' | 'editor'): BridgeAudit {
    return auditBridge(root, { editor: mode === 'editor' });
}
