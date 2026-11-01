import type { Entity } from '@/engine/core/scene/entity';
import type { Aabb } from '@/engine/core/math/aabb';
import type { LibraryAsset, AssetKind } from '@/engine/assets/library/asset-types';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import type { LogEntryExtras, LogLevel } from '@/engine/editor/session/editor-log';
import type { EventBus } from './event-bus';
import type { InputState } from './input-state';
import type { Scheduler } from './scheduler';
import type { StackMapper } from './stack-mapper';
import type { CallbackInvoker, ScriptOwner } from './runtime-context';
import type { WebUiHost } from '../web/web-ui-host';
import type { ScriptLanguageId } from '../script-languages';
import type { ScriptRunContext } from '../script-document';
import type { DebugDrawQueue } from '../api/core';
import type { RenderState } from '../api/render';
import type { CameraEffects } from '../api/camera';
import type { MeshData } from '@/engine/renderer/geometry/mesh-data';
import type { EntityLodOverride } from '@/engine/renderer/render-overrides';
import type { ShaderBindings, ShaderMaterial } from './shader-bindings';
import type { NetHub } from './net-hub';
export interface TimeState {
    now: number;
    delta: number;
    fixedDelta: number;
    unscaledDelta: number;
    frame: number;
    startedAt: number;
}
export interface ScriptHandle {
    readonly assetId: string;
    readonly name: string;
    readonly language: ScriptLanguageId;
    readonly runContext: ScriptRunContext;
    readonly actor: Entity | null;
    readonly enabled: boolean;
    enable(): void;
    disable(): void;
}
export interface ScriptContext extends ScriptOwner {
    readonly self: Entity | null;
    readonly handle: ScriptHandle;
    readonly assetId: string;
    readonly file: string;
    readonly runContext: ScriptRunContext;
}
export interface SystemSwitches {
    render: boolean;
    post: boolean;
    sky: boolean;
    physics: boolean;
    gui: boolean;
    audio: boolean;
    locomotion: boolean;
}
export type RuntimeMode = 'play' | 'editor';
export interface RuntimeHost extends CallbackInvoker {
    readonly session: EditorSession;
    readonly bus: EventBus;
    readonly scheduler: Scheduler;
    readonly input: InputState;
    readonly stacks: StackMapper;
    readonly web: WebUiHost;
    readonly time: TimeState;
    readonly switches: SystemSwitches;
    readonly debug: DebugDrawQueue;
    readonly mode: RuntimeMode;
    readonly current: ScriptContext | null;
    readonly running: boolean;
    log(level: LogLevel, message: string, extras?: LogEntryExtras & {
        source?: string;
    }): void;
    scriptsOf(entity: Entity): readonly ScriptContext[];
    destroyScriptsOf(entity: Entity): void;
    requestActorSync(): void;
    trackSpawned(entity: Entity): void;
    trackDestroyed(entity: Entity): void;
    readonly frameHooks: FrameHooks;
    readonly updaters: Set<(dt: number) => void>;
    readonly disposers: Set<() => void>;
    boundsOf(entity: Entity): Aabb;
    cameraEntity(): Entity | null;
    resolveAsset(value: unknown, member: string, kind?: AssetKind): LibraryAsset;
    scriptSource(asset: LibraryAsset, member: string): string;
    savePrefab(entity: Entity, name: string): Promise<LibraryAsset>;
    instantiatePrefab(asset: unknown): Promise<Entity>;
    saveMeshAsset(mesh: MeshData, name: string): Promise<LibraryAsset>;
    meshLod(entity: Entity, settings: unknown): EntityLodOverride | null;
    meshMyriad(entity: Entity, enabled: unknown): boolean;
    materialFromShader(asset: unknown, uniforms: unknown): ShaderMaterial;
    scriptsOfAsset(assetId: string): readonly ScriptContext[];
    readonly renderState: RenderState;
    readonly shaders: ShaderBindings;
    readonly cameraEffects: CameraEffects;
    readonly net: NetHub;
}
export interface FrameInfo {
    readonly gl: WebGL2RenderingContext | null;
    readonly width: number;
    readonly height: number;
    readonly pixelRatio: number;
    readonly elapsed: number;
    readonly delta: number;
    readonly frame: number;
    readonly view: Float32Array;
    readonly projection: Float32Array;
    readonly viewProjection: Float32Array;
    readonly cameraPosition: Float32Array;
    readonly sceneColor: WebGLTexture | null;
    readonly sceneDepth: WebGLTexture | null;
    readonly hdr: boolean;
}
export type FrameHookFn = (gl: WebGL2RenderingContext | null, frame: FrameInfo) => void;
export interface FrameHooks {
    before: Array<{
        owner: ScriptOwner | null;
        fn: FrameHookFn;
    }>;
    after: Array<{
        owner: ScriptOwner | null;
        fn: FrameHookFn;
    }>;
    beforePass: Map<string, Array<{
        owner: ScriptOwner | null;
        fn: FrameHookFn;
    }>>;
    afterPass: Map<string, Array<{
        owner: ScriptOwner | null;
        fn: FrameHookFn;
    }>>;
    custom: Array<{
        owner: ScriptOwner | null;
        name: string;
        after: string;
        render: FrameHookFn;
    }>;
}
