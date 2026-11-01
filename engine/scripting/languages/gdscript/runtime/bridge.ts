import { Basis, Quaternion, Transform3D, Vector2, Vector3, fail, isVecLike, type VecLike } from './values';
type AnyRecord = Record<string, unknown>;
export type HelixRoot = AnyRecord;
type Fn = (...args: unknown[]) => unknown;
export interface EngineEntity {
    readonly id: number;
    name: string;
    readonly kind: string;
    readonly transform: {
        readonly position: Float32Array;
        readonly rotation: Float32Array;
        readonly scale: Float32Array;
    };
    readonly children: EngineEntity[];
    parent: EngineEntity | null;
    visible: boolean;
    readonly tags: Set<string>;
    meta: Record<string, unknown>;
    script: {
        assetId: string;
        enabled: boolean;
    } | null;
    rigidBody: unknown | null;
    character: unknown | null;
    mesh: unknown | null;
    light: unknown | null;
    audioSource: unknown | null;
    guiSurface: unknown | null;
    vfx: unknown | null;
    terrain: unknown | null;
}
export function isEngineEntity(value: unknown): value is EngineEntity {
    if (value === null || typeof value !== 'object')
        return false;
    const candidate = value as Partial<EngineEntity>;
    return typeof candidate.id === 'number' && typeof candidate.kind === 'string' && Array.isArray(candidate.children) && candidate.transform !== undefined && typeof candidate.transform === 'object';
}
const DEG = 180 / Math.PI;
const RAD = Math.PI / 180;
export function toVector3(value: unknown): Vector3 {
    if (value instanceof Vector3)
        return value;
    if (isVecLike(value))
        return new Vector3(value.x, value.y, value.z ?? 0);
    if (Array.isArray(value) && value.length >= 3)
        return new Vector3(value[0], value[1], value[2]);
    return fail(`Esperava um Vector3, recebeu ${value === null ? 'null' : typeof value}.`);
}
export function toVector2(value: unknown): Vector2 {
    if (value instanceof Vector2)
        return value;
    if (isVecLike(value))
        return new Vector2(value.x, value.y);
    return fail(`Esperava um Vector2, recebeu ${value === null ? 'null' : typeof value}.`);
}
export function fromEngineVec3(vector: ArrayLike<number> | VecLike): Vector3 {
    if (isVecLike(vector))
        return new Vector3(vector.x, vector.y, vector.z ?? 0);
    return new Vector3(vector[0], vector[1], vector[2]);
}
export function writeEngineVec3(target: Float32Array, value: unknown): void {
    const vector = toVector3(value);
    target[0] = vector.x;
    target[1] = vector.y;
    target[2] = vector.z;
}
export function radiansToDegrees(vector: VecLike): Vector3 {
    return new Vector3(vector.x * DEG, vector.y * DEG, (vector.z ?? 0) * DEG);
}
export function degreesToRadians(vector: VecLike): Vector3 {
    return new Vector3(vector.x * RAD, vector.y * RAD, (vector.z ?? 0) * RAD);
}
export function fromEngineQuat(quat: ArrayLike<number> | {
    x: number;
    y: number;
    z: number;
    w: number;
}): Quaternion {
    const q = quat as {
        x?: number;
        y?: number;
        z?: number;
        w?: number;
    } & ArrayLike<number>;
    if (typeof q.w === 'number')
        return new Quaternion(q.x, q.y, q.z, q.w);
    return new Quaternion(q[0], q[1], q[2], q[3]);
}
export function basisFromEulerDegrees(rotation: ArrayLike<number> | VecLike): Basis {
    return Basis.from_euler(degreesToRadians(isVecLike(rotation) ? rotation : { x: rotation[0], y: rotation[1], z: rotation[2] }));
}
export function transformFromEngine(position: ArrayLike<number> | VecLike, rotation: ArrayLike<number> | VecLike): Transform3D {
    return new Transform3D(basisFromEulerDegrees(rotation), fromEngineVec3(position));
}
export function transformFromMatrix(matrix: ArrayLike<number>): Transform3D {
    const basis = new Basis(new Vector3(matrix[0], matrix[1], matrix[2]), new Vector3(matrix[4], matrix[5], matrix[6]), new Vector3(matrix[8], matrix[9], matrix[10]));
    return new Transform3D(basis, new Vector3(matrix[12], matrix[13], matrix[14]));
}
export interface NodeLike {
    readonly $entity: EngineEntity | null;
    $context: GameContext;
    $manualFrame(delta: number): void;
    $manualPhysics(step: number): void;
}
export const CLASS_EXPORT = '__gdClass';
export function classOfModule(exports: unknown): Function | null {
    if (typeof exports === 'function')
        return exports;
    if (exports === null || typeof exports !== 'object')
        return null;
    const cls = (exports as Record<string, unknown>)[CLASS_EXPORT];
    return typeof cls === 'function' ? cls : null;
}
export const DEFAULT_ACTIONS: Readonly<Record<string, readonly string[]>> = {
    ui_accept: ['Enter', 'NumpadEnter', 'Space', 'Gamepad:A'],
    ui_select: ['Space', 'Gamepad:Y'],
    ui_cancel: ['Escape', 'Gamepad:B'],
    ui_focus_next: ['Tab'],
    ui_focus_prev: ['Tab'],
    ui_left: ['ArrowLeft', 'Gamepad:left'],
    ui_right: ['ArrowRight', 'Gamepad:right'],
    ui_up: ['ArrowUp', 'Gamepad:up'],
    ui_down: ['ArrowDown', 'Gamepad:down'],
    ui_page_up: ['PageUp'],
    ui_page_down: ['PageDown'],
    ui_home: ['Home'],
    ui_end: ['End'],
    ui_text_backspace: ['Backspace'],
    ui_text_delete: ['Delete'],
    ui_text_submit: ['Enter', 'NumpadEnter'],
    ui_text_newline: ['Enter'],
    ui_menu: ['ContextMenu'],
};
export class GameContext {
    readonly nodesByEntity = new Map<number, NodeLike>();
    readonly wrappers = new WeakMap<object, NodeLike>();
    readonly manualNodes = new Set<NodeLike>();
    readonly virtualActions = new Map<string, number>();
    readonly deadzones = new Map<string, number>();
    readonly customMonitors = new Map<string, Fn>();
    readonly projectSettings = new Map<string, unknown>();
    readonly groups = new Map<string, Set<NodeLike>>();
    readonly tweens = new Set<{
        step(delta: number): boolean;
    }>();
    readonly frameListeners = new Set<(delta: number) => void>();
    readonly physicsListeners = new Set<(step: number) => void>();
    require: ((specifier: string) => unknown) | null = null;
    wrap: (entity: EngineEntity) => NodeLike = () => fail('O runtime de nós do GDScript ainda não foi carregado.');
    readonly services = new Map<string, unknown>();
    physicsFrames = 0;
    inPhysicsFrame = false;
    maxFps = 0;
    private lastFrame = -1;
    private physicsUnsubscribe: (() => void) | null = null;
    private fpsSamples: number[] = [];
    private nextInstanceId = 1;
    constructor(readonly helix: HelixRoot) { }
    get time(): AnyRecord {
        return this.helix.time as AnyRecord;
    }
    get scene(): AnyRecord {
        return this.helix.scene as AnyRecord;
    }
    get input(): AnyRecord {
        return this.helix.input as AnyRecord;
    }
    get physics(): AnyRecord {
        return this.helix.physics as AnyRecord;
    }
    log(level: 'info' | 'warn' | 'error' | 'debug', message: string): void {
        const log = this.helix.log as Record<string, Fn> | undefined;
        log?.[level]?.('GDScript', message);
    }
    allocateInstanceId(): number {
        return this.nextInstanceId++;
    }
    private readonly warned = new Set<string>();
    warnOnce(key: string, message: string): void {
        if (this.warned.has(key))
            return;
        this.warned.add(key);
        this.log('warn', message);
    }
    frame(delta: number): void {
        const frame = Number(this.time.frame ?? 0);
        if (frame === this.lastFrame)
            return;
        this.lastFrame = frame;
        if (delta > 0) {
            this.fpsSamples.push(1 / delta);
            if (this.fpsSamples.length > 30)
                this.fpsSamples.shift();
        }
        for (const tween of Array.from(this.tweens))
            tween.step(delta);
        for (const node of Array.from(this.manualNodes))
            node.$manualFrame(delta);
        for (const listener of Array.from(this.frameListeners))
            listener(delta);
    }
    get fps(): number {
        if (this.fpsSamples.length === 0)
            return 0;
        return this.fpsSamples.reduce((sum, value) => sum + value, 0) / this.fpsSamples.length;
    }
    registerNode(entity: EngineEntity, node: NodeLike): void {
        this.nodesByEntity.set(entity.id, node);
    }
    unregisterNode(entity: EngineEntity, node: NodeLike): void {
        if (this.nodesByEntity.get(entity.id) === node)
            this.nodesByEntity.delete(entity.id);
        this.manualNodes.delete(node);
    }
    trackManual(node: NodeLike): void {
        this.manualNodes.add(node);
        this.ensurePhysicsClock();
    }
    ensurePhysicsClock(): void {
        if (this.physicsUnsubscribe)
            return;
        const onPreStep = this.physics?.onPreStep as ((fn: (h: number) => void) => () => void) | undefined;
        if (typeof onPreStep !== 'function')
            return;
        this.physicsUnsubscribe = onPreStep((h) => {
            this.physicsFrames++;
            this.inPhysicsFrame = true;
            try {
                for (const manual of Array.from(this.manualNodes))
                    manual.$manualPhysics(h);
                for (const listener of Array.from(this.physicsListeners))
                    listener(h);
            }
            finally {
                this.inPhysicsFrame = false;
            }
        });
    }
    service<T>(key: string, create: () => T): T {
        let value = this.services.get(key) as T | undefined;
        if (value === undefined) {
            value = create();
            this.services.set(key, value);
        }
        return value;
    }
    defer(fn: () => void): void {
        const nextFrame = this.time.nextFrame as ((fn: () => void) => void) | undefined;
        if (typeof nextFrame === 'function')
            nextFrame(fn);
        else
            queueMicrotask(fn);
    }
}
const contexts = new WeakMap<object, GameContext>();
export function contextOf(helix: HelixRoot): GameContext {
    const key = (helix.scene ?? helix) as object;
    let context = contexts.get(key);
    if (!context) {
        context = new GameContext(helix);
        contexts.set(key, context);
    }
    return context;
}
