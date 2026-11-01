import { type EngineEntity, type GameContext, type HelixRoot, type NodeLike, basisFromEulerDegrees, contextOf, degreesToRadians, fromEngineVec3, isEngineEntity, radiansToDegrees, toVector3, transformFromMatrix, writeEngineVec3, } from './bridge';
import { GODOT_NODE_CLASSES, godotIsA, godotParentOf } from './godot-api';
import { InputEvent, InputEventAction, InputEventJoypadButton, InputEventJoypadMotion, InputEventKey, InputEventMouse, InputEventMouseButton, InputEventMouseMotion, InputEventWithModifiers, InputRouter, type InputTarget } from './input-events';
import { call as dynamicCall } from './methods';
import { GodotObject, type Injection, godotBaseOf, scriptNameOf, setGodotBase } from './object';
import { Tween } from './tween';
import { Basis, Quaternion, Rect2, Signal, Transform3D, Vector2, Vector2i, Vector3, fail, isVecLike, markScriptClass, scriptClassName } from './values';
import { str } from './variant';
type AnyRecord = Record<string, unknown>;
type Fn = (...args: unknown[]) => unknown;
interface TransformHolder {
    readonly position: Float32Array;
    readonly rotation: Float32Array;
    readonly scale: Float32Array;
}
function vadd(a: Vector3, b: Vector3): Vector3 {
    return new Vector3(a.x + b.x, a.y + b.y, a.z + b.z);
}
function vsub(a: Vector3, b: Vector3): Vector3 {
    return new Vector3(a.x - b.x, a.y - b.y, a.z - b.z);
}
function vscale(a: Vector3, k: number): Vector3 {
    return new Vector3(a.x * k, a.y * k, a.z * k);
}
export interface NodeHooks {
    onStart(): unknown;
    onUpdate(delta: number): unknown;
    onFixedUpdate(step: number): unknown;
    onEnable(): void;
    onDisable(): void;
    onDestroy(): void;
    onCollisionBegin(other: unknown, contact: unknown): void;
    onCollisionEnd(other: unknown): void;
    onTriggerEnter(other: unknown): void;
    onTriggerExit(other: unknown): void;
    [engineHook: string]: unknown;
}
const ENGINE_HOOK_NAMES: readonly string[] = ['onLoad', 'onLateUpdate', 'onRender', 'onStop', 'onBeforeHotReload', 'onHotReload'];
function requireNode(value: unknown, where: string): NodeBase {
    if (value instanceof NodeBase)
        return value;
    if (isEngineEntity(value))
        return wrapEntity(value);
    return fail(`${where}: esperava um Node, recebeu ${value === null ? 'null' : typeof value === 'object' ? (scriptClassName(value as object) ?? 'Object') : typeof value}.`);
}
function wildcardMatch(pattern: string, text: string): boolean {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
    return new RegExp(`^${escaped}$`).test(text);
}
const wrapperCache = new WeakMap<object, NodeBase>();
export function wrapEntity(entity: EngineEntity, context?: GameContext): NodeBase {
    const ctx = context ?? currentContextFor(entity);
    const own = ctx.nodesByEntity.get(entity.id);
    if (own)
        return own as NodeBase;
    const cached = wrapperCache.get(entity);
    if (cached && cached.$context === ctx)
        return cached;
    const ctor = nodeClass(godotClassForEntity(entity));
    const node = new ctor({ entity, helix: ctx.helix, script: null });
    wrapperCache.set(entity, node);
    return node;
}
let lastContext: GameContext | null = null;
function currentContextFor(_entity: EngineEntity): GameContext {
    if (!lastContext)
        fail('Nenhum jogo GDScript ativo para embrulhar o ator.');
    return lastContext;
}
export function godotClassForEntity(entity: EngineEntity): string {
    if (entity.character)
        return 'CharacterBody3D';
    const body = entity.rigidBody as {
        type?: string;
    } | null;
    if (body)
        return body.type === 'dynamic' ? 'RigidBody3D' : body.type === 'kinematic' ? 'AnimatableBody3D' : 'StaticBody3D';
    switch (entity.kind) {
        case 'camera':
            return 'Camera3D';
        case 'light':
            return 'Light3D';
        case 'mesh':
            return 'MeshInstance3D';
        case 'sound':
            return 'AudioStreamPlayer3D';
        case 'vfx':
            return 'GPUParticles3D';
        case 'gui':
            return 'Control';
        case 'terrain':
            return 'StaticBody3D';
        default:
            return entity.parent === null ? 'Window' : 'Node3D';
    }
}
export class NodeBase extends GodotObject implements NodeLike, InputTarget {
    $entity: EngineEntity | null;
    $script: unknown;
    $virtualName: string;
    $virtualParent: NodeBase | null = null;
    readonly $virtualChildren: NodeBase[] = [];
    private readonly $virtualTransform: TransformHolder = { position: new Float32Array(3), rotation: new Float32Array(3), scale: new Float32Array([1, 1, 1]) };
    $inTree = false;
    $readyDone = false;
    $queuedFree = false;
    $processing = true;
    $physicsProcessing = true;
    $inputEnabled = false;
    $unhandledInputEnabled = false;
    $unhandledKeyInputEnabled = false;
    $shortcutInputEnabled = false;
    $inputRegistered = false;
    process_mode = 0;
    $collisionLayer = 1;
    $collisionMask = 1;
    private $visibleLast: boolean | null = null;
    private $groupNames = new Set<string>();
    private readonly $disposers: Array<() => void> = [];
    $onReady: Array<() => void> = [];
    constructor(inject: Injection | null = null) {
        super(inject);
        const entity = inject?.entity;
        this.$entity = isEngineEntity(entity) ? entity : null;
        this.$script = inject?.script ?? null;
        this.$virtualName = scriptNameOf(this) ?? godotBaseOf(this.constructor);
        lastContext = this.$context;
        if (this.$entity)
            this.$context.registerNode(this.$entity, this);
    }
    $hooks(): NodeHooks {
        const hooks: NodeHooks = {
            onStart: () => this.$enterTree(),
            onUpdate: (delta) => {
                this.$context.frame(delta);
                this.$syncVisibility();
                if (this.$processing && !this.$freed)
                    return (this._process as (delta: number) => unknown)(delta);
                return undefined;
            },
            onFixedUpdate: (step) => {
                this.$context.inPhysicsFrame = true;
                try {
                    this.$beforePhysics(step);
                    if (this.$physicsProcessing && !this.$freed)
                        return (this._physics_process as (step: number) => unknown)(step);
                    return undefined;
                }
                finally {
                    this.$context.inPhysicsFrame = false;
                }
            },
            onEnable: () => this.$syncVisibility(),
            onDisable: () => this.$syncVisibility(),
            onDestroy: () => this.$exitTree(),
            onCollisionBegin: (other, contact) => this.$contact('begin', other, contact),
            onCollisionEnd: (other) => this.$contact('end', other, null),
            onTriggerEnter: (other) => this.$contact('enter', other, null),
            onTriggerExit: (other) => this.$contact('exit', other, null),
        };
        for (const name of ENGINE_HOOK_NAMES) {
            const handler = (this as unknown as Record<string, unknown>)[name];
            if (typeof handler === 'function')
                hooks[name] = (...args: unknown[]) => (handler as Fn).apply(this, args);
        }
        return hooks;
    }
    $manualFrame(delta: number): void {
        if (this.$processing && !this.$freed && this.$inTree)
            this._process(delta);
    }
    $manualPhysics(step: number): void {
        if (this.$physicsProcessing && !this.$freed && this.$inTree) {
            this.$beforePhysics(step);
            this._physics_process(step);
        }
    }
    protected $beforePhysics(_step: number): void { }
    protected $contact(phase: 'begin' | 'end' | 'enter' | 'exit', other: unknown, _contact: unknown): void {
        if (!isEngineEntity(other))
            return;
        const node = wrapEntity(other, this.$context);
        if (phase === 'begin' || phase === 'enter')
            this.$emit('body_entered', node);
        else
            this.$emit('body_exited', node);
    }
    $subscribeInput(name: string, handler: Fn): () => void {
        const input = this.$helix.input as AnyRecord | undefined;
        const subscribe = input?.[name] as ((fn: Fn) => (() => void) | undefined) | undefined;
        if (typeof subscribe !== 'function')
            return () => { };
        const dispose = subscribe(handler) ?? (() => { });
        this.$disposers.push(dispose);
        return dispose;
    }
    private $updateInputRegistration(): void {
        const wants = this.$inputEnabled || this.$unhandledInputEnabled || this.$unhandledKeyInputEnabled || this.$shortcutInputEnabled;
        const router = InputRouter.of(this.$context);
        if (wants && !this.$inputRegistered && this.$inTree) {
            router.register(this);
            this.$inputRegistered = true;
        }
        else if ((!wants || !this.$inTree) && this.$inputRegistered) {
            router.unregister(this);
            this.$inputRegistered = false;
        }
    }
    private $overrides(name: string): boolean {
        return (this as unknown as Record<string, Fn>)[name] !== (NodeBase.prototype as unknown as Record<string, Fn>)[name];
    }
    $enterTree(): unknown {
        if (this.$inTree || this.$freed)
            return undefined;
        this.$inTree = true;
        this.$inputEnabled = this.$overrides('_input');
        this.$unhandledInputEnabled = this.$overrides('_unhandled_input');
        this.$unhandledKeyInputEnabled = this.$overrides('_unhandled_key_input');
        this.$shortcutInputEnabled = this.$overrides('_shortcut_input');
        this.$updateInputRegistration();
        this.$notify(10);
        this._enter_tree();
        this.$emit('tree_entered');
        this.$virtualParent?.$emit('child_entered_tree', this);
        for (const child of this.$virtualChildren)
            child.$enterTree();
        if (this.$readyDone)
            return undefined;
        for (const init of this.$onReady)
            init();
        this.$onReady = [];
        this.$readyDone = true;
        this.$notify(13);
        const ready = (this._ready as () => unknown)();
        this.$emit('ready');
        return ready;
    }
    $exitTree(): void {
        if (!this.$inTree)
            return;
        this.$emit('tree_exiting');
        this.$virtualParent?.$emit('child_exiting_tree', this);
        this.$notify(11);
        this._exit_tree();
        for (const child of this.$virtualChildren)
            child.$exitTree();
        this.$inTree = false;
        this.$updateInputRegistration();
        for (const dispose of this.$disposers.splice(0))
            dispose();
        for (const group of this.$groupNames)
            this.$context.groups.get(group)?.delete(this);
        if (this.$entity)
            this.$context.unregisterNode(this.$entity, this);
        this.$context.manualNodes.delete(this);
        this.$emit('tree_exited');
        this.$notify(1);
        super.free();
    }
    private $notify(what: number): void {
        if (this.$overrides('_notification'))
            this._notification(what);
    }
    private $syncVisibility(): void {
        const visible = this.is_visible_in_tree();
        if (this.$visibleLast !== null && this.$visibleLast !== visible) {
            this.$notify(30);
            this.$emit('visibility_changed');
        }
        this.$visibleLast = visible;
    }
    get ready(): Signal {
        return this.$builtinSignal('ready');
    }
    get tree_entered(): Signal {
        return this.$builtinSignal('tree_entered');
    }
}
