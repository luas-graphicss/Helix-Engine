const PRIMITIVES = `
                                                                                                  
  export interface Vec3 extends Float32Array {
    x: number
    y: number
    z: number
    r: number
    g: number
    b: number
  }
                                  
  export interface Quat extends Float32Array {
    x: number
    y: number
    z: number
    w: number
  }
  export type Mat4 = Float32Array
  export type Mat3 = Float32Array
                                                                                       
  export type Vec3Like = Vec3 | ArrayLike<number> | { x: number; y: number; z: number }
  export type QuatLike = Quat | ArrayLike<number> | { x: number; y: number; z: number; w: number }
                                                                                                   
  export type ColorLike = Vec3Like | string
     
                                                                          
                                                                               
                                                                      
     
  export type SettingsInput<T> = { [K in keyof T]?: T[K] extends Vec3 ? Vec3Like : T[K] extends Quat ? QuatLike : T[K] extends object ? SettingsInput<T[K]> : T[K] }
  export interface Aabb {
    readonly min: Vec3
    readonly max: Vec3
  }
  export interface Ray {
    readonly origin: Vec3
    readonly direction: Vec3
  }
  export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }
  export type Unsubscribe = () => void
  export type Space = 'local' | 'world'
`;
const SCENE_TYPES = `
  export type EntityKind = 'group' | 'mesh' | 'light' | 'camera' | 'terrain' | 'character' | 'sound' | 'gui' | 'vfx' | 'script'
  export type ComponentKind = 'mesh' | 'material' | 'light' | 'rigidBody' | 'character' | 'csg' | 'csgBrush' | 'audioSource' | 'audioZone' | 'guiSurface' | 'vfx' | 'script'
  export type PrimitiveKind = 'box' | 'roundedBox' | 'plane' | 'sphere' | 'cylinder' | 'cone' | 'torus' | 'capsule' | 'rock' | 'denseSphere' | 'torusKnot' | 'flutedColumn' | 'engravedTorus'

  export interface Transform {
                                      
    readonly position: Vec3
                                                
    readonly rotation: Vec3
    readonly scale: Vec3
    readonly localMatrix: Mat4
    updateLocalMatrix(): boolean
  }

  export interface MeshData {
    name: string
    positions: Float32Array
    normals: Float32Array
    uvs: Float32Array
    indices: Uint16Array | Uint32Array
    tangents?: Float32Array
    readonly bounds: Aabb
    version: number
  }

  export type MaterialTextureSlot = 'baseColorMap' | 'metallicRoughnessMap' | 'normalMap' | 'occlusionMap' | 'emissiveMap'
  export interface Texture {
    name: string
    image: ImageBitmap | HTMLCanvasElement | HTMLImageElement | ImageData | null
    width: number
    height: number
    colorSpace: 'srgb' | 'linear'
    wrapS: 'repeat' | 'clamp' | 'mirror'
    wrapT: 'repeat' | 'clamp' | 'mirror'
    magFilter: 'linear' | 'nearest'
    minFilter: 'linear' | 'nearest'
    dynamic: boolean
    version: number
  }
  export interface Material {
    name: string
    baseColor: Vec3
    opacity: number
    roughness: number
    metallic: number
    emissive: Vec3
    emissiveIntensity: number
    alphaMode: 'opaque' | 'mask' | 'blend'
    alphaCutoff: number
    doubleSided: boolean
    baseColorMap: Texture | null
    metallicRoughnessMap: Texture | null
    normalMap: Texture | null
    normalScale: number
    occlusionMap: Texture | null
    occlusionStrength: number
    emissiveMap: Texture | null
    uvTiling: Vec3
    libraryId: string | null
  }
  export interface MaterialDocument {
    readonly id: string
    name: string
    readonly material: Material
    readonly physical: PhysicalProperties
    readonly updatedAt: number
  }

  export type LocalLightType = 'point' | 'spot' | 'rect' | 'disc' | 'tube'
  export type LightType = 'directional' | 'ambient' | LocalLightType
  export interface LightShadow {
    enabled: boolean
    softness: number
    bias: number
    normalBias: number
    strength: number
  }
  export interface DirectionalLight {
    type: 'directional'
    color: Vec3
    intensity: number
    castShadows: boolean
  }
  export interface AmbientLight {
    type: 'ambient'
    skyColor: Vec3
    groundColor: Vec3
    intensity: number
  }
  export interface LocalLightBase {
    color: Vec3
                                                        
    temperature: number | null
    intensity: number
    range: number
    falloff: number
    sourceRadius: number
    specular: number
    shadow: LightShadow
    animation: 'none' | 'flicker' | 'pulse' | 'strobe'
    animationSpeed: number
    animationAmount: number
  }
  export interface PointLight extends LocalLightBase { type: 'point' }
  export interface SpotLight extends LocalLightBase { type: 'spot'; innerAngle: number; outerAngle: number }
  export interface RectLight extends LocalLightBase { type: 'rect'; width: number; height: number; twoSided: boolean }
  export interface DiscLight extends LocalLightBase { type: 'disc'; radius: number; twoSided: boolean }
  export interface TubeLight extends LocalLightBase { type: 'tube'; length: number }
  export type LocalLight = PointLight | SpotLight | RectLight | DiscLight | TubeLight
  export type Light = DirectionalLight | AmbientLight | LocalLight

  export interface PhysicalProperties {
    density: number
    friction: number
    restitution: number
    linearDamping: number
  }
  export interface RigidBodySettings {
    type: 'static' | 'kinematic' | 'dynamic'
    collider: 'box' | 'sphere' | 'capsule' | 'mesh'
    boxSize: Vec3
    radius: number
    height: number
    center: Vec3
    mass: number
    friction: number
    restitution: number
    linearDamping: number
    angularDamping: number
    gravityScale: number
    canSleep: boolean
                                                                                                                                    
    layer?: string
                                                                                       
    collidesWith?: string[]
  }

  export interface CharacterClips { idle: string | null; walk: string | null; run: string | null; crouch: string | null }
  export interface CharacterSettings {
    autoPossess: boolean
    model: string | null
    clips: CharacterClips
    radius: number
    height: number
    crouchHeight: number
    walkSpeed: number
    runSpeed: number
    crouchSpeed: number
    acceleration: number
    braking: number
    airControl: number
    jumpHeight: number
    maxSlopeDegrees: number
    stepHeight: number
    rotationRate: number
    mass: number
  }
  export interface PlayerCameraSettings {
    distance: number
    minDistance: number
    maxDistance: number
    pitch: number
    minPitch: number
    maxPitch: number
    sensitivity: number
    invertY: boolean
    pivotHeight: number
  }
  export interface PlayerSettings {
    enabled: boolean
    spawnIfMissing: boolean
    character: CharacterSettings
    camera: PlayerCameraSettings
  }

  export interface CsgSettings { live: boolean; precision: 'fast' | 'exact'; showBrushes: boolean }
  export type CsgOperation = 'subtract' | 'union' | 'intersect'
  export interface CsgBrushSettings { operation: CsgOperation; enabled: boolean }
  export interface CsgTargetStats { triangles: number; brushes: number; ms: number }

  export interface ScriptSettings {
    assetId: string | null
    enabled: boolean
    props: Record<string, JsonValue>
    executionOrder: number
  }
                                                                            
  export interface GameServerSettings {
    mode: 'none' | 'authoritative'
    url: string
    tickRate: number
    maxPlayers: number
    target: 'node' | 'docker' | 'cloudflare'
  }
  export interface ScriptingSettings {
    baseLanguage: string | null
    entryScriptId: string | null
    server: GameServerSettings
  }

  export interface AudioCone { enabled: boolean; innerAngle: number; outerAngle: number; outerGainDb: number }
  export interface AudioOcclusion { enabled: boolean; attenuationDb: number; lowpass: number }
  export interface AudioSourceSettings {
    assetId: string | null
    muted: boolean
    volumeDb: number
    pitch: number
    loopMode: 'clip' | 'loop' | 'once'
    trigger: 'auto' | 'proximity' | 'manual'
    triggerRadius: number
    stopOnExit: boolean
    fadeIn: number
    fadeOut: number
    repeatMin: number
    repeatMax: number
    randomStart: boolean
    spatial: boolean
    panningModel: 'equalpower' | 'hrtf'
    distanceModel: 'inverse' | 'linear' | 'exponential'
    minDistance: number
    maxDistance: number
    rolloff: number
    airAbsorption: number
    cone: AudioCone
    doppler: number
    occlusion: AudioOcclusion
    reverbSend: number
    priority: number
  }
  export interface AudioZoneSettings {
    enabled: boolean
    shape: 'box' | 'sphere'
    size: Vec3
    radius: number
    falloff: number
    priority: number
    reverb: Record<string, number | boolean>
    echo: Record<string, number | boolean>
    filter: { enabled: boolean; frequency: number }
    ambience: { assetId: string | null; volumeDb: number }
  }

  export interface GuiSurfaceSettings {
    content: { kind: 'screen'; assetId: string | null } | { kind: 'video'; video: Record<string, unknown> } | { kind: 'view'; view: Record<string, unknown> }
    mount: Record<string, unknown>
    pixelsPerMeter: number
    shading: 'lit' | 'screen' | 'overlay'
    brightness: number
    blend: 'opaque' | 'cutout' | 'transparent'
    opacity: number
    doubleSided: boolean
    interactive?: boolean
  }

  export interface VfxSettings {
    assetId: string | null
    autoPlay: boolean
    playInEditor: boolean
    loop: boolean | null
    scale: number
    timeScale: number
    seed: number
    cullDistance: number
  }

                                                                           
  export class Entity {
    readonly id: number
    name: string
    readonly kind: EntityKind
    readonly transform: Transform
                                                                                                   
    readonly worldMatrix: Mat4
    readonly children: Entity[]
    parent: Entity | null
    visible: boolean
    locked: boolean
    castShadows: boolean
    receiveShadows: boolean
    mesh: MeshData | null
    material: Material | null
    light: Light | null
    terrain: Terrain | null
    rigidBody: RigidBodySettings | null
    character: CharacterSettings | null
    skin: unknown | null
    rig: unknown | null
    csg: CsgSettings | null
    csgBrush: CsgBrushSettings | null
    audioSource: AudioSourceSettings | null
    audioZone: AudioZoneSettings | null
    guiSurface: GuiSurfaceSettings | null
    vfx: VfxSettings | null
    script: ScriptSettings | null
    readonly tags: Set<string>
    meta: Record<string, JsonValue>
    add(child: Entity): Entity
    insert(child: Entity, index: number): Entity
    remove(child: Entity): void
    contains(other: Entity): boolean
  }

  export interface SpawnOptions {
    name?: string
    position?: Vec3Like
    rotation?: Vec3Like
    scale?: Vec3Like | number
    visible?: boolean
    tags?: readonly string[]
    parent?: Entity
    mesh?: MeshData
    material?: Material
    light?: Light
    terrain?: Partial<TerrainOptions>
    rigidBody?: SettingsInput<RigidBodySettings>
    character?: SettingsInput<CharacterSettings>
    csg?: SettingsInput<CsgSettings>
    csgBrush?: SettingsInput<CsgBrushSettings>
    audioSource?: SettingsInput<AudioSourceSettings>
    audioZone?: SettingsInput<AudioZoneSettings>
    guiSurface?: SettingsInput<GuiSurfaceSettings>
    vfx?: SettingsInput<VfxSettings> | string
    script?: SettingsInput<ScriptSettings> | string
    castShadows?: boolean
    receiveShadows?: boolean
    locked?: boolean
    trigger?: { shape: 'box' | 'sphere'; size?: Vec3Like; radius?: number }
  }

  export type AssetKind = 'model' | 'texture' | 'audio' | 'animation' | 'gui' | 'font' | 'video' | 'vfx' | 'script' | 'prefab'
  export interface LibraryAsset {
    readonly id: string
    readonly name: string
    readonly kind: AssetKind
    readonly format: string
    readonly size: number
    readonly tags: string[]
    readonly contentHash: string
    readonly createdAt: number
    readonly updatedAt: number
    readonly files: string[]
    readonly details: Record<string, unknown> & { kind: AssetKind }
  }
                                                                                       
  export type AssetRef = LibraryAsset | string
`;
const ROOT_TYPES = `
  export type RunContext = 'shared' | 'client' | 'server'
  export interface ScriptHandle {
    readonly assetId: string
    readonly name: string
    readonly language: 'javascript' | 'typescript' | string
    readonly runContext: RunContext
                                                                    
    readonly actor: Entity | null
    readonly enabled: boolean
    enable(): void
    disable(): void
  }
  export interface EngineInfo {
    readonly name: string
    readonly version: string
    readonly apiVersion: string
  }
  export interface TaskHandle {
    readonly id: number
    readonly done: Promise<void>
    readonly cancelled: boolean
    readonly finished: boolean
    cancel(): void
  }
  export interface FrameInfo {
    readonly gl: WebGL2RenderingContext | null
    readonly width: number
    readonly height: number
    readonly pixelRatio: number
    readonly elapsed: number
    readonly delta: number
    readonly frame: number
    readonly view: Mat4
    readonly projection: Mat4
    readonly viewProjection: Mat4
    readonly cameraPosition: Vec3
    readonly sceneColor: WebGLTexture | null
    readonly sceneDepth: WebGLTexture | null
    readonly hdr: boolean
  }
  export interface Contact {
    readonly point: Vec3
    readonly normal: Vec3
    readonly impulse: number
    readonly relativeVelocity: number
  }

  export interface TimeApi {
                                                                                          
    readonly now: number
    readonly delta: number
    readonly fixedDelta: number
    readonly unscaledDelta: number
    readonly frame: number
                                                                    
    readonly realtime: number
    scale: number
    wait(seconds: number): Promise<void>
    waitFrames(frames: number): Promise<void>
    delay(seconds: number, fn: () => void): Unsubscribe
    every(seconds: number, fn: () => void): Unsubscribe
    nextFrame(fn: () => void): Unsubscribe
  }
  export interface TaskApi {
    spawn(fn: () => unknown | Promise<unknown>): TaskHandle
    cancel(handle: TaskHandle): void
    all(handles: readonly TaskHandle[]): Promise<void[]>
    readonly running: number
  }
  export interface LogApi {
    info(message: unknown, ...rest: unknown[]): void
    info(source: string, message: unknown, ...rest: unknown[]): void
    warn(message: unknown, ...rest: unknown[]): void
    warn(source: string, message: unknown, ...rest: unknown[]): void
    error(message: unknown, ...rest: unknown[]): void
    error(source: string, message: unknown, ...rest: unknown[]): void
    debug(message: unknown, ...rest: unknown[]): void
    debug(source: string, message: unknown, ...rest: unknown[]): void
    assert(condition: unknown, message?: unknown): asserts condition
    trace(...args: unknown[]): void
    clear(): void
  }
  export interface DebugApi {
    line(a: Vec3Like, b: Vec3Like, color?: ColorLike, seconds?: number): void
    ray(origin: Vec3Like, direction: Vec3Like, length?: number, color?: ColorLike, seconds?: number): void
    sphere(center: Vec3Like, radius: number, color?: ColorLike, seconds?: number): void
    box(box: { min: Vec3Like; max: Vec3Like } | { center: Vec3Like; size: Vec3Like }, color?: ColorLike, seconds?: number): void
    bounds(entity: Entity, color?: ColorLike, seconds?: number): void
    axes(entity: Entity, size?: number, seconds?: number): void
    text(position: Vec3Like, text: unknown, color?: string, seconds?: number): void
    clear(): void
  }
  export type EventHandler<T = unknown> = (payload: T) => void
  export interface EventsApi {
    on<T = unknown>(name: string, handler: EventHandler<T>): Unsubscribe
    once<T = unknown>(name: string, handler: EventHandler<T>): Unsubscribe
    off(name: string, handler: EventHandler<never>): void
    emit(name: string, payload?: unknown): number
    onEntity<T = unknown>(entity: Entity, name: string, handler: EventHandler<T>): Unsubscribe
    emitEntity(entity: Entity, name: string, payload?: unknown): number
    listenerCount(name: string): number
    names(): string[]
  }

  export type PropType = 'number' | 'boolean' | 'string' | 'vec3' | 'color' | 'entity' | 'asset' | 'enum' | 'range'
  export interface PropDefinition {
    readonly name: string
    readonly type: PropType
    readonly default: JsonValue
    readonly label?: string
    readonly hint?: string
    readonly min?: number
    readonly max?: number
    readonly step?: number
    readonly options?: readonly string[]
    readonly assetKind?: AssetKind
  }
  export interface PropSpec {
    type?: PropType
    default?: unknown
    label?: string
    hint?: string
    min?: number
    max?: number
    step?: number
    options?: readonly string[]
    assetKind?: AssetKind
  }
  export interface PropsApi {
                                                                                                                        
    define(spec: Record<string, PropSpec | number | string | boolean | Vec3Like | Entity | null> | ReadonlyArray<PropSpec & { name: string }>): void
    get<T = unknown>(name: string): T
    set(name: string, value: unknown): void
    has(name: string): boolean
    all(): Record<string, unknown>
    definitions(): PropDefinition[]
    onChanged(name: string, handler: (value: unknown, previous: unknown) => void): Unsubscribe
    reset(name?: string): void
    executionOrder: number
  }
`;
