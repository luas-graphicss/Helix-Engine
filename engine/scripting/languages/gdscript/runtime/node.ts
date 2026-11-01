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
    private $root(): EngineEntity {
        return this.$context.scene.root as EngineEntity;
    }
    protected $resolvePath(path: string): NodeBase | null {
        if (path.length === 0 || path === '.')
            return this;
        if (path.startsWith('%')) {
            const found = (this.$sceneApi.find as Fn)(path.slice(1).replace(/^\/+/, '')) as EngineEntity | null;
            return found ? wrapEntity(found, this.$context) : null;
        }
        let current: NodeBase | null = this;
        let parts = path.split('/');
        if (path.startsWith('/')) {
            current = wrapEntity(this.$root(), this.$context);
            parts = parts.slice(1);
            if (parts[0] === 'root')
                parts = parts.slice(1);
        }
        for (const rawPart of parts) {
            if (!current)
                return null;
            const part = rawPart.trim();
            if (part === '' || part === '.')
                continue;
            if (part === '..') {
                current = current.$parent();
                continue;
            }
            if (part.startsWith('%')) {
                const found = (this.$sceneApi.find as Fn)(part.slice(1), current.$entity ?? undefined) as EngineEntity | null;
                current = found ? wrapEntity(found, this.$context) : null;
                continue;
            }
            current = current.$children().find((child) => child.name === part) ?? null;
        }
        return current;
    }
    get_node(path: unknown): NodeBase {
        const text = str(path);
        const found = this.$resolvePath(text);
        if (!found) {
            const names = this.$children().map((child) => child.name);
            fail(`get_node("${text}"): nenhum nó nesse caminho a partir de "${this.name}".${names.length > 0 ? ` Filhos: ${names.join(', ')}.` : ' Este nó não tem filhos.'}`);
        }
        return found;
    }
    get_node_or_null(path: unknown): NodeBase | null {
        return this.$resolvePath(str(path));
    }
    has_node(path: unknown): boolean {
        return this.$resolvePath(str(path)) !== null;
    }
    find_child(pattern: unknown, recursive = true, _owned = true): NodeBase | null {
        const text = str(pattern);
        const search = (node: NodeBase): NodeBase | null => {
            for (const child of node.$children()) {
                if (wildcardMatch(text, child.name))
                    return child;
                if (recursive) {
                    const inner = search(child);
                    if (inner)
                        return inner;
                }
            }
            return null;
        };
        return search(this);
    }
    find_children(pattern: unknown, type: unknown = '', recursive = true, _owned = true): NodeBase[] {
        const text = str(pattern);
        const typeName = str(type ?? '');
        const result: NodeBase[] = [];
        const search = (node: NodeBase): void => {
            for (const child of node.$children()) {
                if ((text === '' || wildcardMatch(text, child.name)) && (typeName === '' || child.is_class(typeName)))
                    result.push(child);
                if (recursive)
                    search(child);
            }
        };
        search(this);
        return result;
    }
    find_parent(pattern: unknown): NodeBase | null {
        const text = str(pattern);
        for (let current = this.$parent(); current; current = current.$parent())
            if (wildcardMatch(text, current.name))
                return current;
        return null;
    }
    get_parent(): NodeBase | null {
        return this.$parent();
    }
    get_children(_includeInternal = false): NodeBase[] {
        return this.$children();
    }
    get_child(index: unknown, _includeInternal = false): NodeBase {
        const children = this.$children();
        const at = Number(index) < 0 ? children.length + Number(index) : Number(index);
        const child = children[at];
        if (!child)
            fail(`get_child(${str(index)}): "${this.name}" tem ${children.length} filho(s).`);
        return child;
    }
    get_child_count(_includeInternal = false): number {
        return this.$children().length;
    }
    protected $materialize(parent: EngineEntity, index?: number): void {
        const kind = GODOT_NODE_CLASSES[godotBaseOf(this.constructor)];
        if (!kind)
            return;
        const options: AnyRecord = { name: this.$virtualName, position: this.position, rotation: this.rotation_degrees, scale: this.scale, visible: this.$virtualVisible };
        if (kind === 'character')
            options.character = {};
        const entity = (this.$sceneApi.spawn as Fn)(kind, options, parent) as EngineEntity;
        if (index !== undefined)
            (this.$sceneApi.reparent as Fn)(entity, parent, index);
        this.$entity = entity;
        this.$context.registerNode(entity, this);
        for (const group of this.$groupNames)
            entity.tags.add(group);
        for (const child of this.$virtualChildren)
            child.$materialize(entity);
    }
    add_child(node: unknown, _forceReadableName = false, _internal = 0): void {
        const child = requireNode(node, 'add_child');
        if (child === this)
            fail('add_child(): um nó não pode ser filho de si mesmo.');
        if (child.$parent() !== null && child.$inTree)
            fail(`add_child(): "${child.name}" já tem pai (${child.$parent()!.name}); use reparent() ou remove_child() antes.`);
        if (this.$entity) {
            if (child.$entity) {
                if (child.$entity.parent !== this.$entity)
                    (this.$sceneApi.reparent as Fn)(child.$entity, this.$entity);
            }
            else {
                child.$materialize(this.$entity);
            }
            child.$virtualParent = null;
            if (child.$entity && !child.$script)
                this.$context.trackManual(child);
            if (this.$inTree)
                child.$enterTree();
            return;
        }
        child.$virtualParent = this;
        if (!this.$virtualChildren.includes(child))
            this.$virtualChildren.push(child);
        if (this.$inTree)
            child.$enterTree();
    }
    add_sibling(node: unknown, forceReadableName = false): void {
        const parent = this.$parent();
        if (!parent)
            fail('add_sibling(): este nó não tem pai.');
        parent.add_child(node, forceReadableName);
        const sibling = requireNode(node, 'add_sibling');
        if (parent.$entity && sibling.$entity)
            (this.$sceneApi.reparent as Fn)(sibling.$entity, parent.$entity, this.get_index() + 1);
    }
    remove_child(node: unknown): void {
        const child = requireNode(node, 'remove_child');
        if (child.$parent() !== this)
            fail(`remove_child(): "${child.name}" não é filho de "${this.name}".`);
        child.$exitTree();
        if (this.$entity && child.$entity)
            (this.$sceneApi.remove as Fn)(this.$entity, child.$entity);
        const at = this.$virtualChildren.indexOf(child);
        if (at >= 0)
            this.$virtualChildren.splice(at, 1);
        child.$virtualParent = null;
    }
    reparent(newParent: unknown, keepGlobalTransform = true): void {
        const parent = requireNode(newParent, 'reparent');
        if (this.$entity && parent.$entity) {
            if (keepGlobalTransform)
                (this.$transformApi.setParentKeepWorld as Fn)(this.$entity, parent.$entity);
            else
                (this.$sceneApi.reparent as Fn)(this.$entity, parent.$entity);
            return;
        }
        const previous = this.$parent();
        if (previous) {
            const at = previous.$virtualChildren.indexOf(this);
            if (at >= 0)
                previous.$virtualChildren.splice(at, 1);
        }
        this.$virtualParent = null;
        parent.add_child(this);
    }
    get_index(_includeInternal = false): number {
        const parent = this.$parent();
        if (!parent)
            return -1;
        return parent.$children().indexOf(this);
    }
    move_child(node: unknown, toIndex: unknown): void {
        const child = requireNode(node, 'move_child');
        if (this.$entity && child.$entity) {
            ;
            (this.$sceneApi.reparent as Fn)(child.$entity, this.$entity, Number(toIndex));
            return;
        }
        const at = this.$virtualChildren.indexOf(child);
        if (at < 0)
            fail(`move_child(): "${child.name}" não é filho de "${this.name}".`);
        this.$virtualChildren.splice(at, 1);
        this.$virtualChildren.splice(Math.max(0, Math.min(this.$virtualChildren.length, Number(toIndex))), 0, child);
    }
    queue_free(): void {
        if (this.$queuedFree || this.$freed)
            return;
        this.$queuedFree = true;
        this.$context.defer(() => this.free());
    }
    free(): void {
        if (this.$freed)
            return;
        const entity = this.$entity;
        if (entity && entity.parent) {
            ;
            (this.$sceneApi.destroy as Fn)(entity);
        }
        this.$exitTree();
        const parent = this.$virtualParent;
        if (parent) {
            const at = parent.$virtualChildren.indexOf(this);
            if (at >= 0)
                parent.$virtualChildren.splice(at, 1);
        }
        super.free();
    }
    is_queued_for_deletion(): boolean {
        return this.$queuedFree;
    }
    is_inside_tree(): boolean {
        return this.$inTree;
    }
    get_tree(): SceneTree {
        return sceneTreeOf(this.$context);
    }
    get_path(): string {
        if (!this.$entity)
            return this.$virtualParent ? `${this.$virtualParent.get_path()}/${this.name}` : this.name;
        const path = str((this.$sceneApi.path as Fn)(this.$entity));
        return `/root/${path.replace(/^\/+/, '')}`;
    }
    get_path_to(node: unknown, _useUniquePath = false): string {
        const target = requireNode(node, 'get_path_to');
        const mine = this.get_path().split('/').filter(Boolean);
        const theirs = target.get_path().split('/').filter(Boolean);
        let common = 0;
        while (common < mine.length && common < theirs.length && mine[common] === theirs[common])
            common++;
        const ups = mine.length - common;
        const parts = [...Array<string>(ups).fill('..'), ...theirs.slice(common)];
        return parts.length === 0 ? '.' : parts.join('/');
    }
    get_name(): string {
        return this.name;
    }
    set_name(value: unknown): void {
        this.name = value;
    }
    is_ancestor_of(node: unknown): boolean {
        const other = requireNode(node, 'is_ancestor_of');
        for (let current = other.$parent(); current; current = current.$parent())
            if (current === this)
                return true;
        return false;
    }
    is_in_group(group: unknown): boolean {
        const name = str(group);
        return this.$groupNames.has(name) || (this.$entity?.tags.has(name) ?? false);
    }
    add_to_group(group: unknown, _persistent = false): void {
        const name = str(group);
        this.$groupNames.add(name);
        this.$entity?.tags.add(name);
        let set = this.$context.groups.get(name);
        if (!set) {
            set = new Set();
            this.$context.groups.set(name, set);
        }
        set.add(this);
    }
    remove_from_group(group: unknown): void {
        const name = str(group);
        this.$groupNames.delete(name);
        this.$entity?.tags.delete(name);
        this.$context.groups.get(name)?.delete(this);
    }
    get_groups(): string[] {
        const names = new Set(this.$groupNames);
        if (this.$entity)
            for (const tag of this.$entity.tags)
                names.add(tag);
        return Array.from(names);
    }
    set_process(enable: unknown): void {
        this.$processing = Boolean(enable);
    }
    set_physics_process(enable: unknown): void {
        this.$physicsProcessing = Boolean(enable);
    }
    set_process_input(enable: unknown): void {
        this.$inputEnabled = Boolean(enable);
        this.$updateInputRegistration();
    }
    set_process_unhandled_input(enable: unknown): void {
        this.$unhandledInputEnabled = Boolean(enable);
        this.$updateInputRegistration();
    }
    set_process_unhandled_key_input(enable: unknown): void {
        this.$unhandledKeyInputEnabled = Boolean(enable);
        this.$updateInputRegistration();
    }
    is_processing(): boolean {
        return this.$processing;
    }
    is_physics_processing(): boolean {
        return this.$physicsProcessing;
    }
    is_processing_input(): boolean {
        return this.$inputEnabled;
    }
    get_process_delta_time(): number {
        return Number(this.$context.time.delta ?? 0);
    }
    get_physics_process_delta_time(): number {
        return Number(this.$context.time.fixedDelta ?? 1 / 60);
    }
    get_viewport(): Viewport {
        return viewportOf(this.$context);
    }
    get_window(): Window {
        return windowOf(this.$context);
    }
    print_tree(): void {
        this.$context.log('info', this.$treeLines(false).join('\n'));
    }
    print_tree_pretty(): void {
        this.$context.log('info', this.$treeLines(true).join('\n'));
    }
    private $treeLines(pretty: boolean, prefix = '', last = true): string[] {
        const label = pretty ? `${prefix}${last ? '└─' : '├─'}${this.name} (${this.get_class()})` : this.get_path();
        const lines = [label];
        const children = this.$children();
        children.forEach((child, index) => lines.push(...child.$treeLines(pretty, pretty ? `${prefix}${last ? '   ' : '│  '}` : '', index === children.length - 1)));
        return lines;
    }
    duplicate(_flags = 15): NodeBase {
        if (!this.$entity)
            fail('duplicate(): só nós que já estão na cena podem ser duplicados nesta engine.');
        const copy = (this.$sceneApi.clone as Fn)(this.$entity, true) as EngineEntity;
        return wrapEntity(copy, this.$context);
    }
    create_tween(): Tween {
        return new Tween(this.$context, this);
    }
    get_rid(): number {
        return this.$entity?.id ?? 0;
    }
    set_collision_layer_value(layer: unknown, value: unknown): void {
        const bit = 1 << (Number(layer) - 1);
        this.$collisionLayer = value ? this.$collisionLayer | bit : this.$collisionLayer & ~bit;
    }
    set_collision_mask_value(layer: unknown, value: unknown): void {
        const bit = 1 << (Number(layer) - 1);
        this.$collisionMask = value ? this.$collisionMask | bit : this.$collisionMask & ~bit;
    }
    get_collision_layer_value(layer: unknown): boolean {
        return (this.$collisionLayer & (1 << (Number(layer) - 1))) !== 0;
    }
    get_collision_mask_value(layer: unknown): boolean {
        return (this.$collisionMask & (1 << (Number(layer) - 1))) !== 0;
    }
    get collision_layer(): number {
        return this.$collisionLayer;
    }
    set collision_layer(value: unknown) {
        this.$collisionLayer = Number(value) | 0;
    }
    get collision_mask(): number {
        return this.$collisionMask;
    }
    set collision_mask(value: unknown) {
        this.$collisionMask = Number(value) | 0;
    }
    is_class(name: unknown): boolean {
        if (typeof name !== 'string')
            return false;
        if (super.is_class(name))
            return true;
        return name === 'Node' || (godotIsA(godotBaseOf(this.constructor), 'Node3D') && godotIsA(name, 'Node'));
    }
    to_string(): string {
        const custom = (this as unknown as {
            _to_string: Fn;
        })._to_string;
        if (custom !== GodotObject.prototype._to_string)
            return str(custom.call(this));
        return `${this.name}:<${scriptNameOf(this) ?? godotBaseOf(this.constructor)}#${this.$instanceId}>`;
    }
}
markScriptClass(NodeBase, 'Node3D');
setGodotBase(NodeBase, 'Node3D');
interface BodyApi {
    readonly isDynamic: boolean;
    readonly isKinematic: boolean;
    readonly isStatic: boolean;
    readonly mass: number;
    linearVelocity: Float32Array;
    angularVelocity: Float32Array;
    gravityScale: number;
    applyImpulse(impulse: unknown, point?: unknown): void;
    applyAngularImpulse(impulse: unknown): void;
    applyForce(force: unknown, point?: unknown): void;
    applyTorque(torque: unknown): void;
    moveKinematic(position: unknown, orientation?: unknown, step?: unknown): void;
    wake(): void;
}
interface RaycastHit {
    readonly entity: EngineEntity;
    readonly point: Float32Array;
    readonly normal: Float32Array;
    readonly distance: number;
}
export class KinematicCollision3D extends GodotObject {
    constructor(helix: HelixRoot, private readonly collider: NodeBase, private readonly position: Vector3, private readonly normal: Vector3, private readonly travel: Vector3, private readonly remainder: Vector3) {
        super({ entity: null, helix, script: null });
    }
    get_collider(): NodeBase {
        return this.collider;
    }
    get_collider_rid(): number {
        return this.collider.get_rid();
    }
    get_collider_shape(): null {
        return null;
    }
    get_collider_velocity(): Vector3 {
        return this.collider instanceof RigidBody3DNode ? this.collider.linear_velocity : new Vector3();
    }
    get_position(): Vector3 {
        return this.position;
    }
    get_normal(): Vector3 {
        return this.normal;
    }
    get_travel(): Vector3 {
        return this.travel;
    }
    get_remainder(): Vector3 {
        return this.remainder;
    }
    get_angle(upDirection: unknown = Vector3.UP): number {
        return Math.acos(Math.max(-1, Math.min(1, this.normal.dot(toVector3(upDirection)))));
    }
    get_depth(): number {
        return 0;
    }
    get_collision_count(): number {
        return 1;
    }
    get_local_shape(): null {
        return null;
    }
}
markScriptClass(KinematicCollision3D, 'KinematicCollision3D');
setGodotBase(KinematicCollision3D, 'KinematicCollision3D');
export class CollisionObject3DNode extends NodeBase {
    protected $physicsApi(): AnyRecord {
        return this.$helix.physics as AnyRecord;
    }
    protected $body(): BodyApi | null {
        const entity = this.$entity;
        if (!entity || !entity.rigidBody)
            return null;
        const api = this.$physicsApi();
        const hasBody = api.hasBody as Fn | undefined;
        if (hasBody && !hasBody(entity))
            return null;
        try {
            return (api.bodyOf as Fn)(entity) as BodyApi;
        }
        catch {
            return null;
        }
    }
    protected $raycast(origin: Vector3, direction: Vector3, maxDistance: number): RaycastHit | null {
        const raycast = this.$physicsApi().raycast as Fn | undefined;
        if (!raycast || !this.$entity)
            return null;
        const hit = raycast(origin, direction, maxDistance, { exclude: [this.$entity] }) as RaycastHit | null;
        return hit ?? null;
    }
    protected $halfHeight(): number {
        const body = this.$entity?.rigidBody as {
            collider?: string;
            height?: number;
            radius?: number;
            boxSize?: Float32Array;
        } | null | undefined;
        if (!body) {
            const character = this.$entity?.character as {
                height?: number;
            } | null | undefined;
            return character?.height ? character.height / 2 : 0.9;
        }
        if (body.collider === 'capsule')
            return (body.height ?? 1.8) / 2;
        if (body.collider === 'sphere')
            return body.radius ?? 0.5;
        return body.boxSize ? body.boxSize[1] / 2 : 0.5;
    }
}
markScriptClass(CollisionObject3DNode, 'CollisionObject3D');
setGodotBase(CollisionObject3DNode, 'CollisionObject3D');
export class PhysicsBody3DNode extends CollisionObject3DNode {
    move_and_collide(motion: unknown, testOnly = false, _safeMargin = 0.001, _recoveryAsCollision = false): KinematicCollision3D | null {
        const delta = toVector3(motion);
        const length = delta.length();
        const from = this.global_position;
        if (length < 1e-9)
            return null;
        const direction = delta.normalized();
        const hit = this.$raycast(from, direction, length + 0.001);
        if (!hit) {
            if (!testOnly)
                this.global_position = vadd(from, delta);
            return null;
        }
        const travelLength = Math.max(0, hit.distance - 0.001);
        const travel = vscale(direction, travelLength);
        if (!testOnly)
            this.global_position = vadd(from, travel);
        return new KinematicCollision3D(this.$helix, wrapEntity(hit.entity, this.$context), fromEngineVec3(hit.point), fromEngineVec3(hit.normal), travel, vsub(delta, travel));
    }
}
markScriptClass(PhysicsBody3DNode, 'PhysicsBody3D');
setGodotBase(PhysicsBody3DNode, 'PhysicsBody3D');
export class StaticBody3DNode extends PhysicsBody3DNode {
    constant_linear_velocity = new Vector3();
    constant_angular_velocity = new Vector3();
}
markScriptClass(StaticBody3DNode, 'StaticBody3D');
setGodotBase(StaticBody3DNode, 'StaticBody3D');
export class RigidBody3DNode extends PhysicsBody3DNode {
    private readonly $touching = new Set<EngineEntity>();
    private $gravityScaleFallback = 1;
    private $virtualVelocity = new Vector3();
    private $virtualAngular = new Vector3();
    protected $contact(phase: 'begin' | 'end' | 'enter' | 'exit', other: unknown, contact: unknown): void {
        if (isEngineEntity(other)) {
            if (phase === 'begin' || phase === 'enter')
                this.$touching.add(other);
            else
                this.$touching.delete(other);
        }
        super.$contact(phase, other, contact);
    }
    get linear_velocity(): Vector3 {
        const body = this.$body();
        return body ? fromEngineVec3(body.linearVelocity) : this.$virtualVelocity;
    }
    set linear_velocity(value: unknown) {
        const body = this.$body();
        const vector = toVector3(value);
        if (body) {
            body.linearVelocity = new Float32Array([vector.x, vector.y, vector.z]);
            body.wake();
        }
        else
            this.$virtualVelocity = vector;
    }
    get angular_velocity(): Vector3 {
        const body = this.$body();
        return body ? fromEngineVec3(body.angularVelocity) : this.$virtualAngular;
    }
    set angular_velocity(value: unknown) {
        const body = this.$body();
        const vector = toVector3(value);
        if (body) {
            body.angularVelocity = new Float32Array([vector.x, vector.y, vector.z]);
            body.wake();
        }
        else
            this.$virtualAngular = vector;
    }
    get gravity_scale(): number {
        return this.$body()?.gravityScale ?? this.$gravityScaleFallback;
    }
    set gravity_scale(value: unknown) {
        const body = this.$body();
        if (body)
            body.gravityScale = Number(value);
        else
            this.$gravityScaleFallback = Number(value);
    }
    get mass(): number {
        return this.$body()?.mass ?? Number((this.$entity?.rigidBody as {
            mass?: number;
        } | null)?.mass ?? 1);
    }
    set mass(value: unknown) {
        const settings = this.$entity?.rigidBody as {
            mass?: number;
        } | null | undefined;
        if (settings)
            settings.mass = Number(value);
    }
    get sleeping(): boolean {
        const body = this.$body() as (BodyApi & {
            isSleeping?: boolean;
        }) | null;
        return body?.isSleeping ?? false;
    }
    set sleeping(value: unknown) {
        const body = this.$body() as (BodyApi & {
            sleep?: () => void;
        }) | null;
        if (!body)
            return;
        if (value)
            body.sleep?.();
        else
            body.wake();
    }
    private $requireBody(where: string): BodyApi {
        const body = this.$body();
        if (!body)
            fail(`${where}: "${this.name}" não tem corpo físico; adicione o componente Corpo Rígido ao ator.`);
        return body;
    }
    apply_impulse(impulse: unknown, position: unknown = Vector3.ZERO): void {
        const body = this.$requireBody('apply_impulse');
        const offset = toVector3(position);
        if (offset.length_squared() > 0)
            body.applyImpulse(toVector3(impulse), vadd(this.global_position, offset));
        else
            body.applyImpulse(toVector3(impulse));
    }
    apply_central_impulse(impulse: unknown): void {
        this.$requireBody('apply_central_impulse').applyImpulse(toVector3(impulse));
    }
    apply_force(force: unknown, position: unknown = Vector3.ZERO): void {
        const body = this.$requireBody('apply_force');
        const offset = toVector3(position);
        if (offset.length_squared() > 0)
            body.applyForce(toVector3(force), vadd(this.global_position, offset));
        else
            body.applyForce(toVector3(force));
    }
    apply_central_force(force: unknown): void {
        this.$requireBody('apply_central_force').applyForce(toVector3(force));
    }
    apply_torque(torque: unknown): void {
        this.$requireBody('apply_torque').applyTorque(toVector3(torque));
    }
    apply_torque_impulse(impulse: unknown): void {
        this.$requireBody('apply_torque_impulse').applyAngularImpulse(toVector3(impulse));
    }
    set_axis_velocity(axisVelocity: unknown): void {
        const target = toVector3(axisVelocity);
        const axis = target.normalized();
        const current = this.linear_velocity;
        this.linear_velocity = vadd(vsub(current, vscale(axis, current.dot(axis))), target);
    }
    get_colliding_bodies(): NodeBase[] {
        return Array.from(this.$touching, (entity) => wrapEntity(entity, this.$context));
    }
    get_contact_count(): number {
        return this.$touching.size;
    }
}
markScriptClass(RigidBody3DNode, 'RigidBody3D');
setGodotBase(RigidBody3DNode, 'RigidBody3D');
interface CharacterApi {
    readonly isGrounded: boolean;
    readonly velocity: Float32Array;
    readonly groundNormal: Float32Array;
    move(x: number, z: number): void;
    jump(): void;
    stop(): void;
}
export class CharacterBody3DNode extends PhysicsBody3DNode {
    velocity = new Vector3();
    up_direction = new Vector3(0, 1, 0);
    floor_max_angle = (45 * Math.PI) / 180;
    floor_snap_length = 0.1;
    floor_stop_on_slope = true;
    motion_mode = 0;
    private $onFloor = false;
    private $onWall = false;
    private $onCeiling = false;
    private $floorNormal = new Vector3(0, 1, 0);
    private $slideCount = 0;
    private $realVelocity = new Vector3();
    private $gravityDisabled = false;
    private $character(): CharacterApi | null {
        const entity = this.$entity;
        if (!entity || !entity.character)
            return null;
        const api = this.$helix.character as AnyRecord | undefined;
        const has = api?.has as Fn | undefined;
        if (has && !has(entity))
            return null;
        try {
            return (api?.of as Fn)(entity) as CharacterApi;
        }
        catch {
            return null;
        }
    }
    protected $beforePhysics(): void {
        const body = this.$body();
        if (body && body.isDynamic && !this.$gravityDisabled) {
            body.gravityScale = 0;
            this.$gravityDisabled = true;
        }
        if (body && body.isDynamic)
            this.velocity = fromEngineVec3(body.linearVelocity);
    }
    move_and_slide(): boolean {
        const step = this.get_physics_process_delta_time();
        const velocity = this.velocity;
        const character = this.$character();
        this.$slideCount = 0;
        this.$onWall = false;
        this.$onCeiling = false;
        if (character) {
            const horizontal = new Vector2(velocity.x, velocity.z);
            const length = horizontal.length();
            if (length > 1e-4)
                character.move(horizontal.x / Math.max(1, length), horizontal.y / Math.max(1, length));
            else
                character.stop();
            if (velocity.y > 0.01 && character.isGrounded)
                character.jump();
            this.$onFloor = character.isGrounded;
            this.$floorNormal = fromEngineVec3(character.groundNormal ?? new Float32Array([0, 1, 0]));
            this.$realVelocity = fromEngineVec3(character.velocity);
            return this.$onFloor;
        }
        const body = this.$body();
        if (body && body.isDynamic) {
            body.linearVelocity = new Float32Array([velocity.x, velocity.y, velocity.z]);
            body.wake();
            this.$probeFloor(velocity, step);
            this.$realVelocity = velocity;
            return this.$slideCount > 0;
        }
        let remaining = vscale(velocity, step);
        let collided = false;
        for (let pass = 0; pass < 4 && remaining.length() > 1e-6; pass++) {
            const from = this.global_position;
            const direction = remaining.normalized();
            const hit = this.$raycast(from, direction, remaining.length() + 0.05);
            if (!hit) {
                this.$applyMotion(remaining, body);
                break;
            }
            collided = true;
            this.$slideCount++;
            const normal = fromEngineVec3(hit.normal);
            const travel = vscale(direction, Math.max(0, hit.distance - 0.05));
            this.$applyMotion(travel, body);
            const angle = Math.acos(Math.max(-1, Math.min(1, normal.dot(this.up_direction))));
            if (angle <= this.floor_max_angle) {
                this.$onFloor = true;
                this.$floorNormal = normal;
            }
            else if (angle >= Math.PI - this.floor_max_angle)
                this.$onCeiling = true;
            else
                this.$onWall = true;
            remaining = vsub(remaining, travel).slide(normal);
            this.velocity = this.velocity.slide(normal);
        }
        if (!collided)
            this.$probeFloor(velocity, step);
        this.$realVelocity = this.velocity;
        return collided || this.$onFloor;
    }
    private $applyMotion(motion: Vector3, body: BodyApi | null): void {
        const target = vadd(this.global_position, motion);
        if (body && body.isKinematic)
            body.moveKinematic(target);
        else
            this.global_position = target;
    }
    private $probeFloor(velocity: Vector3, step: number): void {
        const half = this.$halfHeight();
        const origin = this.global_position;
        const down = vscale(this.up_direction, -1);
        const reach = half + Math.max(this.floor_snap_length, Math.abs(Math.min(0, velocity.y)) * step) + 0.05;
        const hit = this.$raycast(origin, down, reach);
        if (!hit) {
            this.$onFloor = false;
            return;
        }
        const normal = fromEngineVec3(hit.normal);
        const angle = Math.acos(Math.max(-1, Math.min(1, normal.dot(this.up_direction))));
        if (angle > this.floor_max_angle) {
            this.$onFloor = false;
            return;
        }
        this.$onFloor = true;
        this.$floorNormal = normal;
        const body = this.$body();
        if (velocity.y <= 0 && !(body && body.isDynamic)) {
            const feet = vadd(fromEngineVec3(hit.point), vscale(this.up_direction, half));
            this.global_position = feet;
            if (this.floor_stop_on_slope)
                this.velocity = new Vector3(this.velocity.x, 0, this.velocity.z);
        }
    }
    is_on_floor(): boolean {
        return this.$onFloor;
    }
    is_on_floor_only(): boolean {
        return this.$onFloor && !this.$onWall && !this.$onCeiling;
    }
    is_on_wall(): boolean {
        return this.$onWall;
    }
    is_on_ceiling(): boolean {
        return this.$onCeiling;
    }
    get_floor_normal(): Vector3 {
        return this.$floorNormal;
    }
    get_floor_angle(upDirection: unknown = Vector3.UP): number {
        return Math.acos(Math.max(-1, Math.min(1, this.$floorNormal.dot(toVector3(upDirection)))));
    }
    get_real_velocity(): Vector3 {
        return this.$realVelocity;
    }
    get_slide_collision_count(): number {
        return this.$slideCount;
    }
    get_last_motion(): Vector3 {
        return vscale(this.$realVelocity, this.get_physics_process_delta_time());
    }
    get_position_delta(): Vector3 {
        return this.get_last_motion();
    }
}
markScriptClass(CharacterBody3DNode, 'CharacterBody3D');
setGodotBase(CharacterBody3DNode, 'CharacterBody3D');
export class Area3DNode extends CollisionObject3DNode {
    private readonly $overlapping = new Set<EngineEntity>();
    monitoring = true;
    monitorable = true;
    gravity = 9.8;
    gravity_direction = new Vector3(0, -1, 0);
    priority = 0;
    private $isArea(entity: EngineEntity): boolean {
        const node = this.$context.nodesByEntity.get(entity.id) as NodeBase | undefined;
        if (node)
            return node.is_class('Area3D');
        return entity.rigidBody === null && entity.character === null;
    }
    protected $contact(phase: 'begin' | 'end' | 'enter' | 'exit', other: unknown, _contact: unknown): void {
        if (!isEngineEntity(other))
            return;
        const node = wrapEntity(other, this.$context);
        const entering = phase === 'begin' || phase === 'enter';
        if (entering)
            this.$overlapping.add(other);
        else
            this.$overlapping.delete(other);
        if (!this.monitoring)
            return;
        const area = this.$isArea(other);
        if (entering)
            this.$emit(area ? 'area_entered' : 'body_entered', node);
        else
            this.$emit(area ? 'area_exited' : 'body_exited', node);
    }
    get_overlapping_bodies(): NodeBase[] {
        return Array.from(this.$overlapping)
            .filter((entity) => !this.$isArea(entity))
            .map((entity) => wrapEntity(entity, this.$context));
    }
    get_overlapping_areas(): NodeBase[] {
        return Array.from(this.$overlapping)
            .filter((entity) => this.$isArea(entity))
            .map((entity) => wrapEntity(entity, this.$context));
    }
    overlaps_body(body: unknown): boolean {
        const node = requireNode(body, 'overlaps_body');
        return node.$entity !== null && this.$overlapping.has(node.$entity);
    }
    overlaps_area(area: unknown): boolean {
        return this.overlaps_body(area);
    }
    has_overlapping_bodies(): boolean {
        return this.get_overlapping_bodies().length > 0;
    }
    has_overlapping_areas(): boolean {
        return this.get_overlapping_areas().length > 0;
    }
}
markScriptClass(Area3DNode, 'Area3D');
setGodotBase(Area3DNode, 'Area3D');
export class AudioStreamPlayerNode extends NodeBase {
    autoplay = false;
    volume_db = 0;
    pitch_scale = 1;
    bus = 'Master';
    stream: unknown = null;
    private $sources(): AnyRecord | null {
        const audio = this.$helix.audio as AnyRecord | undefined;
        return (audio?.sources as AnyRecord | undefined) ?? null;
    }
    get finished(): Signal {
        return this.$builtinSignal('finished');
    }
    get playing(): boolean {
        const sources = this.$sources();
        if (!sources || !this.$entity?.audioSource)
            return false;
        try {
            return Boolean((sources.isPlaying as Fn)(this.$entity));
        }
        catch {
            return false;
        }
    }
    set playing(value: unknown) {
        if (value)
            this.play();
        else
            this.stop();
    }
    play(_fromPosition = 0): void {
        const sources = this.$sources();
        if (!sources || !this.$entity?.audioSource) {
            this.$context.warnOnce(`audio:${this.name}`, `${this.name}.play(): o ator não tem um componente de áudio; adicione uma Fonte de Som ao ator para o som tocar.`);
            return;
        }
        ;
        (sources.set as Fn)(this.$entity, { volumeDb: this.volume_db, pitch: this.pitch_scale });
        (sources.play as Fn)(this.$entity);
    }
    stop(): void {
        const sources = this.$sources();
        if (sources && this.$entity?.audioSource)
            (sources.stop as Fn)(this.$entity);
    }
    is_playing(): boolean {
        return this.playing;
    }
    get_playback_position(): number {
        const sources = this.$sources();
        if (!sources || !this.$entity?.audioSource)
            return 0;
        const status = (sources.status as Fn)(this.$entity) as {
            position?: number;
            time?: number;
        } | null;
        return Number(status?.position ?? status?.time ?? 0);
    }
    seek(_toPosition: unknown): void { }
    $enterTree(): void {
        super.$enterTree();
        if (this.autoplay)
            this.play();
    }
}
markScriptClass(AudioStreamPlayerNode, 'AudioStreamPlayer3D');
setGodotBase(AudioStreamPlayerNode, 'AudioStreamPlayer3D');
export class ControlNode extends NodeBase {
    text = '';
    value = 0;
    min_value = 0;
    max_value = 100;
    step = 1;
    disabled = false;
    modulate = null as unknown;
    tooltip_text = '';
    mouse_filter = 0;
    size = new Vector2();
    custom_minimum_size = new Vector2();
    anchor_left = 0;
    anchor_top = 0;
    anchor_right = 0;
    anchor_bottom = 0;
    offset_left = 0;
    offset_top = 0;
    offset_right = 0;
    offset_bottom = 0;
    get pressed(): Signal {
        return this.$builtinSignal('pressed');
    }
    get toggled(): Signal {
        return this.$builtinSignal('toggled');
    }
    get text_changed(): Signal {
        return this.$builtinSignal('text_changed');
    }
    get text_submitted(): Signal {
        return this.$builtinSignal('text_submitted');
    }
    get value_changed(): Signal {
        return this.$builtinSignal('value_changed');
    }
    get gui_input(): Signal {
        return this.$builtinSignal('gui_input');
    }
    get mouse_entered(): Signal {
        return this.$builtinSignal('mouse_entered');
    }
    get mouse_exited(): Signal {
        return this.$builtinSignal('mouse_exited');
    }
    get focus_entered(): Signal {
        return this.$builtinSignal('focus_entered');
    }
    get focus_exited(): Signal {
        return this.$builtinSignal('focus_exited');
    }
    get resized(): Signal {
        return this.$builtinSignal('resized');
    }
    get global_position2d(): Vector2 {
        return new Vector2(this.position.x, this.position.y);
    }
    set_text(value: unknown): void {
        this.text = str(value);
    }
    get_text(): string {
        return this.text;
    }
    set_value(value: unknown): void {
        this.value = Number(value);
        this.$emit('value_changed', this.value);
    }
    get_value(): number {
        return this.value;
    }
    grab_focus(): void {
        this.$emit('focus_entered');
    }
    release_focus(): void {
        this.$emit('focus_exited');
    }
    has_focus(): boolean {
        return false;
    }
    get_rect(): Rect2 {
        return new Rect2(new Vector2(this.position.x, this.position.y), this.size);
    }
    get_global_rect(): Rect2 {
        return this.get_rect();
    }
    set_anchors_preset(_preset: unknown, _keepOffsets = false): void { }
    set_size(value: unknown): void {
        if (isVecLike(value))
            this.size = new Vector2(value.x, value.y);
        this.$emit('resized');
    }
    get_size(): Vector2 {
        return this.size;
    }
    add_theme_color_override(_name: unknown, _color: unknown): void { }
    add_theme_font_size_override(_name: unknown, _size: unknown): void { }
}
markScriptClass(ControlNode, 'Control');
setGodotBase(ControlNode, 'Control');
export class TimerNode extends NodeBase {
    static readonly TIMER_PROCESS_PHYSICS = 0;
    static readonly TIMER_PROCESS_IDLE = 1;
    wait_time = 1;
    one_shot = false;
    autostart = false;
    process_callback = 1;
    private $cancel: (() => void) | null = null;
    private $startedAt = 0;
    private $pausedLeft: number | null = null;
    private $paused = false;
    private $running = false;
    get timeout(): Signal {
        return this.$builtinSignal('timeout');
    }
    get paused(): boolean {
        return this.$paused;
    }
    set paused(value: unknown) {
        const paused = Boolean(value);
        if (paused === this.$paused)
            return;
        this.$paused = paused;
        if (paused) {
            this.$pausedLeft = this.time_left;
            this.$cancel?.();
            this.$cancel = null;
        }
        else if (this.$running) {
            this.$schedule(this.$pausedLeft ?? this.wait_time);
        }
    }
    get time_left(): number {
        if (!this.$running)
            return 0;
        if (this.$paused)
            return this.$pausedLeft ?? 0;
        const now = Number(this.$context.time.now ?? 0);
        return Math.max(0, this.wait_time - (now - this.$startedAt));
    }
    private $schedule(seconds: number): void {
        this.$cancel?.();
        this.$startedAt = Number(this.$context.time.now ?? 0) - (this.wait_time - seconds);
        const delay = this.$context.time.delay as ((seconds: number, fn: () => void) => () => void) | undefined;
        if (typeof delay !== 'function') {
            this.$context.warnOnce('timer:delay', 'Timer: helix.time.delay não está disponível neste host.');
            return;
        }
        this.$cancel = delay(Math.max(0, seconds), () => {
            this.$cancel = null;
            if (this.$freed || !this.$running)
                return;
            if (this.one_shot)
                this.$running = false;
            else
                this.$schedule(this.wait_time);
            this.$emit('timeout');
        });
    }
    start(timeSec: unknown = -1): void {
        const seconds = Number(timeSec);
        if (seconds > 0)
            this.wait_time = seconds;
        this.$running = true;
        this.$paused = false;
        this.$pausedLeft = null;
        this.$schedule(this.wait_time);
    }
    stop(): void {
        this.$running = false;
        this.$cancel?.();
        this.$cancel = null;
    }
    is_stopped(): boolean {
        return !this.$running;
    }
    $enterTree(): void {
        super.$enterTree();
        if (this.autostart && !this.$running)
            this.start();
    }
    $exitTree(): void {
        this.stop();
        super.$exitTree();
    }
}
markScriptClass(TimerNode, 'Timer');
setGodotBase(TimerNode, 'Timer');
export class Camera3DNode extends NodeBase {
    private get $camera(): AnyRecord {
        return this.$helix.camera as AnyRecord;
    }
    get current(): boolean {
        return (this.$camera.main as EngineEntity | null) === this.$entity;
    }
    set current(value: unknown) {
        if (value)
            this.make_current();
    }
    get fov(): number {
        return Number(this.$camera.fov ?? 70);
    }
    set fov(value: unknown) {
        this.$camera.fov = Number(value);
    }
    get near(): number {
        return Number(this.$camera.near ?? 0.05);
    }
    set near(value: unknown) {
        this.$camera.near = Number(value);
    }
    get far(): number {
        return Number(this.$camera.far ?? 4000);
    }
    set far(value: unknown) {
        this.$camera.far = Number(value);
    }
    make_current(): void {
        if (this.$entity)
            (this.$camera.setMain as Fn)(this.$entity);
    }
    is_current(): boolean {
        return this.current;
    }
    project_ray_origin(screenPoint: unknown): Vector3 {
        const point = toVector2(screenPoint);
        const ray = (this.$camera.screenToRay as Fn)(point.x, point.y) as {
            origin: Float32Array;
        };
        return fromEngineVec3(ray.origin);
    }
    project_ray_normal(screenPoint: unknown): Vector3 {
        const point = toVector2(screenPoint);
        const ray = (this.$camera.screenToRay as Fn)(point.x, point.y) as {
            direction: Float32Array;
        };
        return fromEngineVec3(ray.direction).normalized();
    }
    unproject_position(worldPoint: unknown): Vector2 {
        const screen = (this.$camera.worldToScreen as Fn)(toVector3(worldPoint)) as {
            x: number;
            y: number;
        } | Float32Array | null;
        if (!screen)
            return new Vector2();
        return isVecLike(screen) ? new Vector2(screen.x, screen.y) : new Vector2((screen as Float32Array)[0], (screen as Float32Array)[1]);
    }
    is_position_behind(worldPoint: unknown): boolean {
        const forward = fromEngineVec3((this.$camera.forward as Float32Array | undefined) ?? new Float32Array([0, 0, -1]));
        return vsub(toVector3(worldPoint), this.global_position).dot(forward) < 0;
    }
}
markScriptClass(Camera3DNode, 'Camera3D');
setGodotBase(Camera3DNode, 'Camera3D');
function toVector2(value: unknown): Vector2 {
    if (value instanceof Vector2)
        return value;
    if (isVecLike(value))
        return new Vector2(value.x, value.y);
    return fail('Esperava um Vector2.');
}
export class Light3DNode extends NodeBase {
    private get $light(): AnyRecord | null {
        return (this.$entity?.light as AnyRecord | null) ?? null;
    }
    get light_energy(): number {
        return Number(this.$light?.intensity ?? 1);
    }
    set light_energy(value: unknown) {
        if (this.$light)
            this.$light.intensity = Number(value);
    }
    get light_color(): unknown {
        return this.$light?.color ?? null;
    }
    set light_color(value: unknown) {
        if (this.$light && isVecLike(value))
            this.$light.color = new Float32Array([value.x, value.y, value.z ?? 0]);
    }
    get shadow_enabled(): boolean {
        return Boolean(this.$light?.castShadows ?? false);
    }
    set shadow_enabled(value: unknown) {
        if (this.$light)
            this.$light.castShadows = Boolean(value);
    }
    get omni_range(): number {
        return Number(this.$light?.range ?? 10);
    }
    set omni_range(value: unknown) {
        if (this.$light)
            this.$light.range = Number(value);
    }
    get spot_range(): number {
        return this.omni_range;
    }
    set spot_range(value: unknown) {
        this.omni_range = value;
    }
}
markScriptClass(Light3DNode, 'Light3D');
setGodotBase(Light3DNode, 'Light3D');
export class Viewport extends GodotObject {
    constructor(readonly $game: GameContext) {
        super({ entity: null, helix: $game.helix, script: null });
    }
    private get $size(): Vector2i {
        const camera = this.$helix.camera as AnyRecord | undefined;
        const viewport = camera?.viewport as {
            width?: number;
            height?: number;
            x?: number;
            y?: number;
        } | Float32Array | undefined;
        if (viewport && 'width' in viewport)
            return new Vector2i(Math.round(Number(viewport.width ?? 0)), Math.round(Number(viewport.height ?? 0)));
        if (viewport && ArrayBuffer.isView(viewport))
            return new Vector2i(Math.round(viewport[0]), Math.round(viewport[1]));
        const win = globalThis as unknown as {
            innerWidth?: number;
            innerHeight?: number;
        };
        return new Vector2i(Math.round(win.innerWidth ?? 1280), Math.round(win.innerHeight ?? 720));
    }
    get size(): Vector2i {
        return this.$size;
    }
    get_visible_rect(): Rect2 {
        const size = this.$size;
        return new Rect2(new Vector2(0, 0), new Vector2(size.x, size.y));
    }
    get_size(): Vector2i {
        return this.$size;
    }
    get_mouse_position(): Vector2 {
        const pointer = (this.$helix.input as AnyRecord | undefined)?.pointer as {
            x: number;
            y: number;
        } | undefined;
        return pointer ? new Vector2(pointer.x, pointer.y) : new Vector2();
    }
    warp_mouse(_position: unknown): void {
        this.$game.warnOnce('warp_mouse', 'warp_mouse(): o navegador não permite mover o cursor; a chamada foi ignorada.');
    }
    get_camera_3d(): NodeBase | null {
        const camera = this.$game.scene.activeCamera as EngineEntity | null | undefined;
        return camera ? wrapEntity(camera, this.$game) : null;
    }
    get_camera_2d(): null {
        return null;
    }
    set_input_as_handled(): void {
        InputRouter.of(this.$game).handled = true;
    }
    is_input_handled(): boolean {
        return InputRouter.of(this.$game).handled;
    }
    gui_get_focus_owner(): null {
        return null;
    }
    gui_release_focus(): void { }
    get_window(): Window {
        return windowOf(this.$game);
    }
    get_texture(): null {
        return null;
    }
    get gui_disable_input(): boolean {
        return false;
    }
    set gui_disable_input(_value: unknown) { }
}
markScriptClass(Viewport, 'Viewport');
setGodotBase(Viewport, 'Viewport');
export class Window extends Viewport {
    static readonly MODE_WINDOWED = 0;
    static readonly MODE_MINIMIZED = 1;
    static readonly MODE_MAXIMIZED = 2;
    static readonly MODE_FULLSCREEN = 3;
    static readonly MODE_EXCLUSIVE_FULLSCREEN = 4;
    static readonly CONTENT_SCALE_MODE_DISABLED = 0;
    static readonly CONTENT_SCALE_MODE_CANVAS_ITEMS = 1;
    static readonly CONTENT_SCALE_MODE_VIEWPORT = 2;
    static readonly CONTENT_SCALE_ASPECT_IGNORE = 0;
    static readonly CONTENT_SCALE_ASPECT_KEEP = 1;
    static readonly CONTENT_SCALE_ASPECT_EXPAND = 4;
    title = '';
    content_scale_mode = 0;
    content_scale_aspect = 1;
    content_scale_size = new Vector2i(0, 0);
    get mode(): number {
        const doc = (globalThis as unknown as {
            document?: {
                fullscreenElement?: unknown;
            };
        }).document;
        return doc?.fullscreenElement ? 3 : 0;
    }
    set mode(value: unknown) {
        const doc = (globalThis as unknown as {
            document?: {
                fullscreenElement?: unknown;
                exitFullscreen?: () => Promise<void>;
                documentElement?: {
                    requestFullscreen?: () => Promise<void>;
                };
            };
        }).document;
        if (!doc)
            return;
        if (Number(value) >= 3)
            doc.documentElement?.requestFullscreen?.()?.catch(() => { });
        else if (doc.fullscreenElement)
            doc.exitFullscreen?.()?.catch(() => { });
    }
    get size_changed(): Signal {
        return this.$builtinSignal('size_changed');
    }
    get close_requested(): Signal {
        return this.$builtinSignal('close_requested');
    }
    get_position(): Vector2i {
        return new Vector2i(0, 0);
    }
    set_size(_value: unknown): void {
        this.$game.warnOnce('window_size', 'Window.size: o tamanho da janela é do navegador; a chamada foi ignorada.');
    }
    get_contents_minimum_size(): Vector2 {
        return new Vector2();
    }
    has_focus(): boolean {
        const doc = (globalThis as unknown as {
            document?: {
                hasFocus?: () => boolean;
            };
        }).document;
        return doc?.hasFocus?.() ?? true;
    }
    grab_focus(): void { }
    get_node(path: unknown): NodeBase {
        return this.$rootNode().get_node(path);
    }
    get_node_or_null(path: unknown): NodeBase | null {
        return this.$rootNode().get_node_or_null(path);
    }
    has_node(path: unknown): boolean {
        return this.$rootNode().has_node(path);
    }
    add_child(node: unknown, forceReadableName = false, internal = 0): void {
        this.$rootNode().add_child(node, forceReadableName, internal);
    }
    remove_child(node: unknown): void {
        this.$rootNode().remove_child(node);
    }
    get_children(): NodeBase[] {
        return this.$rootNode().get_children();
    }
    get_child_count(): number {
        return this.$rootNode().get_child_count();
    }
    get_child(index: unknown): NodeBase {
        return this.$rootNode().get_child(index);
    }
    find_child(pattern: unknown, recursive = true, owned = true): NodeBase | null {
        return this.$rootNode().find_child(pattern, recursive, owned);
    }
    find_children(pattern: unknown, type: unknown = '', recursive = true, owned = true): NodeBase[] {
        return this.$rootNode().find_children(pattern, type, recursive, owned);
    }
    get_path(): string {
        return '/root';
    }
    get name(): string {
        return 'root';
    }
    $rootNode(): NodeBase {
        return wrapEntity(this.$game.scene.root as EngineEntity, this.$game);
    }
}
markScriptClass(Window, 'Window');
setGodotBase(Window, 'Window');
export class SceneTreeTimer extends GodotObject {
    private $left: number;
    private $cancel: (() => void) | null = null;
    constructor(readonly $game: GameContext, seconds: number, private readonly ignoreTimeScale: boolean) {
        super({ entity: null, helix: $game.helix, script: null });
        this.$left = Math.max(0, seconds);
        const delay = $game.time.delay as ((seconds: number, fn: () => void) => () => void) | undefined;
        const startedAt = Number($game.time.now ?? 0);
        if (typeof delay === 'function') {
            this.$cancel = delay(this.$left, () => {
                this.$cancel = null;
                this.$left = 0;
                this.$emit('timeout');
            });
        }
        this.$startedAt = startedAt;
    }
    private readonly $startedAt: number;
    get timeout(): Signal {
        return this.$builtinSignal('timeout');
    }
    get time_left(): number {
        if (!this.$cancel)
            return 0;
        const now = Number(this.$game.time.now ?? 0);
        return Math.max(0, this.$left - (now - this.$startedAt));
    }
    set time_left(value: unknown) {
        this.$cancel?.();
        this.$left = Math.max(0, Number(value));
        const delay = this.$game.time.delay as ((seconds: number, fn: () => void) => () => void) | undefined;
        if (typeof delay === 'function') {
            this.$cancel = delay(this.$left, () => {
                this.$cancel = null;
                this.$emit('timeout');
            });
        }
    }
    is_ignoring_time_scale(): boolean {
        return this.ignoreTimeScale;
    }
}
markScriptClass(SceneTreeTimer, 'SceneTreeTimer');
setGodotBase(SceneTreeTimer, 'SceneTreeTimer');
