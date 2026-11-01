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
    get tree_exiting(): Signal {
        return this.$builtinSignal('tree_exiting');
    }
    get tree_exited(): Signal {
        return this.$builtinSignal('tree_exited');
    }
    get renamed(): Signal {
        return this.$builtinSignal('renamed');
    }
    get visibility_changed(): Signal {
        return this.$builtinSignal('visibility_changed');
    }
    get child_entered_tree(): Signal {
        return this.$builtinSignal('child_entered_tree');
    }
    get child_exiting_tree(): Signal {
        return this.$builtinSignal('child_exiting_tree');
    }
    get body_entered(): Signal {
        return this.$builtinSignal('body_entered');
    }
    get body_exited(): Signal {
        return this.$builtinSignal('body_exited');
    }
    get area_entered(): Signal {
        return this.$builtinSignal('area_entered');
    }
    get area_exited(): Signal {
        return this.$builtinSignal('area_exited');
    }
    get input_event(): Signal {
        return this.$builtinSignal('input_event');
    }
    get entity(): EngineEntity | null {
        return this.$entity;
    }
    get script(): unknown {
        return this.$script;
    }
    protected get $t(): TransformHolder {
        return this.$entity ? this.$entity.transform : this.$virtualTransform;
    }
    protected get $transformApi(): AnyRecord {
        return this.$helix.transform as AnyRecord;
    }
    protected get $sceneApi(): AnyRecord {
        return this.$helix.scene as AnyRecord;
    }
    get name(): string {
        return this.$entity ? this.$entity.name : this.$virtualName;
    }
    set name(value: unknown) {
        const text = str(value);
        if (this.$entity)
            (this.$sceneApi.rename as Fn)(this.$entity, text);
        else
            this.$virtualName = text;
        this.$emit('renamed');
    }
    get position(): Vector3 {
        return fromEngineVec3(this.$t.position);
    }
    set position(value: unknown) {
        writeEngineVec3(this.$t.position, value);
    }
    get rotation(): Vector3 {
        return degreesToRadians(fromEngineVec3(this.$t.rotation));
    }
    set rotation(value: unknown) {
        writeEngineVec3(this.$t.rotation, radiansToDegrees(toVector3(value)));
    }
    get rotation_degrees(): Vector3 {
        return fromEngineVec3(this.$t.rotation);
    }
    set rotation_degrees(value: unknown) {
        writeEngineVec3(this.$t.rotation, value);
    }
    get scale(): Vector3 {
        return fromEngineVec3(this.$t.scale);
    }
    set scale(value: unknown) {
        if (typeof value === 'number')
            writeEngineVec3(this.$t.scale, new Vector3(value, value, value));
        else
            writeEngineVec3(this.$t.scale, value);
    }
    get quaternion(): Quaternion {
        return Quaternion.from_euler(this.rotation);
    }
    set quaternion(value: unknown) {
        if (!(value instanceof Quaternion))
            fail('quaternion: esperava um Quaternion.');
        this.rotation = value.get_euler();
    }
    get basis(): Basis {
        return basisFromEulerDegrees(this.$t.rotation).scaled(this.scale);
    }
    set basis(value: unknown) {
        if (!(value instanceof Basis))
            fail('basis: esperava um Basis.');
        this.rotation = value.get_euler();
        this.scale = value.get_scale();
    }
    get transform(): Transform3D {
        return new Transform3D(this.basis, this.position);
    }
    set transform(value: unknown) {
        if (!(value instanceof Transform3D))
            fail('transform: esperava um Transform3D.');
        this.basis = value.basis;
        this.position = value.origin;
    }
    get global_position(): Vector3 {
        if (!this.$entity)
            return this.position;
        return fromEngineVec3((this.$transformApi.worldPosition as Fn)(this.$entity) as Float32Array);
    }
    set global_position(value: unknown) {
        if (!this.$entity) {
            this.position = value;
            return;
        }
        ;
        (this.$transformApi.setWorldPosition as Fn)(this.$entity, toVector3(value));
    }
    get global_rotation(): Vector3 {
        return degreesToRadians(this.global_rotation_degrees);
    }
    set global_rotation(value: unknown) {
        this.global_rotation_degrees = radiansToDegrees(toVector3(value));
    }
    get global_rotation_degrees(): Vector3 {
        if (!this.$entity)
            return this.rotation_degrees;
        return fromEngineVec3((this.$transformApi.worldRotationEuler as Fn)(this.$entity) as Float32Array);
    }
    set global_rotation_degrees(value: unknown) {
        if (!this.$entity) {
            this.rotation_degrees = value;
            return;
        }
        ;
        (this.$transformApi.setWorldRotation as Fn)(this.$entity, toVector3(value));
    }
    get global_basis(): Basis {
        return this.global_transform.basis;
    }
    set global_basis(value: unknown) {
        if (!(value instanceof Basis))
            fail('global_basis: esperava um Basis.');
        this.global_transform = new Transform3D(value, this.global_position);
    }
    get global_transform(): Transform3D {
        if (!this.$entity)
            return this.transform;
        return transformFromMatrix((this.$transformApi.worldMatrix as Fn)(this.$entity) as Float32Array);
    }
    set global_transform(value: unknown) {
        if (!(value instanceof Transform3D))
            fail('global_transform: esperava um Transform3D.');
        if (!this.$entity) {
            this.transform = value;
            return;
        }
        const b = value.basis;
        const matrix = new Float32Array([b.x.x, b.x.y, b.x.z, 0, b.y.x, b.y.y, b.y.z, 0, b.z.x, b.z.y, b.z.z, 0, value.origin.x, value.origin.y, value.origin.z, 1]);
        (this.$transformApi.setWorldMatrix as Fn)(this.$entity, matrix);
    }
    get visible(): boolean {
        return this.$entity ? this.$entity.visible : this.$virtualVisible;
    }
    set visible(value: unknown) {
        const visible = Boolean(value);
        if (this.$entity)
            (this.$sceneApi.setVisible as Fn)(this.$entity, visible);
        else
            this.$virtualVisible = visible;
        this.$syncVisibility();
    }
    private $virtualVisible = true;
    get owner(): GodotObject | null {
        return this.$inTree ? this.get_tree().root : null;
    }
    set owner(_value: unknown) { }
    is_visible_in_tree(): boolean {
        if (!this.visible)
            return false;
        for (let current: EngineEntity | null = this.$entity?.parent ?? null; current; current = current.parent)
            if (!current.visible)
                return false;
        return true;
    }
    show(): void {
        this.visible = true;
    }
    hide(): void {
        this.visible = false;
    }
    look_at(target: unknown, up: unknown = Vector3.UP, _useModelFront = false): void {
        const point = target instanceof NodeBase ? target.global_position : toVector3(target);
        if (this.$entity) {
            ;
            (this.$transformApi.lookAt as Fn)(this.$entity, point, toVector3(up));
            return;
        }
        this.basis = Basis.looking_at(vsub(point, this.position), toVector3(up)).scaled(this.scale);
    }
    look_at_from_position(position: unknown, target: unknown, up: unknown = Vector3.UP, useModelFront = false): void {
        this.global_position = position;
        this.look_at(target, up, useModelFront);
    }
    translate(offset: unknown): void {
        if (this.$entity) {
            ;
            (this.$transformApi.translate as Fn)(this.$entity, toVector3(offset), 'local');
            return;
        }
        this.position = vadd(this.position, this.basis.xform(toVector3(offset)));
    }
    translate_object_local(offset: unknown): void {
        this.translate(offset);
    }
    global_translate(offset: unknown): void {
        if (this.$entity) {
            ;
            (this.$transformApi.translate as Fn)(this.$entity, toVector3(offset), 'world');
            return;
        }
        this.position = vadd(this.position, toVector3(offset));
    }
    rotate(axis: unknown, angle: unknown): void {
        const scale = this.scale;
        this.basis = basisFromEulerDegrees(this.$t.rotation).rotated(toVector3(axis), Number(angle)).scaled(scale);
    }
    rotate_x(angle: unknown): void {
        this.rotate(Vector3.RIGHT, angle);
    }
    rotate_y(angle: unknown): void {
        this.rotate(Vector3.UP, angle);
    }
    rotate_z(angle: unknown): void {
        this.rotate(Vector3.BACK, angle);
    }
    rotate_object_local(axis: unknown, angle: unknown): void {
        const scale = this.scale;
        const current = basisFromEulerDegrees(this.$t.rotation);
        this.basis = current.multiply(Basis.from_euler(new Vector3()).rotated(toVector3(axis), Number(angle))).scaled(scale);
    }
    to_global(local: unknown): Vector3 {
        if (this.$entity)
            return fromEngineVec3((this.$transformApi.localToWorld as Fn)(this.$entity, toVector3(local)) as Float32Array);
        return this.transform.xform(toVector3(local));
    }
    to_local(global: unknown): Vector3 {
        if (this.$entity)
            return fromEngineVec3((this.$transformApi.worldToLocal as Fn)(this.$entity, toVector3(global)) as Float32Array);
        return this.transform.affine_inverse().xform(toVector3(global));
    }
    get_global_transform(): Transform3D {
        return this.global_transform;
    }
    get_transform(): Transform3D {
        return this.transform;
    }
    set_identity(): void {
        writeEngineVec3(this.$t.position, Vector3.ZERO);
        writeEngineVec3(this.$t.rotation, Vector3.ZERO);
        writeEngineVec3(this.$t.scale, Vector3.ONE);
    }
    protected $children(): NodeBase[] {
        if (this.$entity)
            return this.$entity.children.map((child) => wrapEntity(child, this.$context));
        return this.$virtualChildren.slice();
    }
    protected $parent(): NodeBase | null {
        if (this.$entity)
            return this.$entity.parent ? wrapEntity(this.$entity.parent, this.$context) : null;
        return this.$virtualParent;
    }
}
