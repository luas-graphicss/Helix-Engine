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
const MATH_TYPES = `
  export interface Vec3Math {
    create(x?: number, y?: number, z?: number): Vec3
    from(value: Vec3Like): Vec3
    clone(a: Vec3Like): Vec3
    copy(out: Vec3, a: Vec3Like): Vec3
    set(out: Vec3, x: number, y: number, z: number): Vec3
    add(a: Vec3Like, b: Vec3Like): Vec3
    sub(a: Vec3Like, b: Vec3Like): Vec3
    subtract(a: Vec3Like, b: Vec3Like): Vec3
    scale(a: Vec3Like, s: number): Vec3
    multiply(a: Vec3Like, b: Vec3Like): Vec3
    scaleAndAdd(a: Vec3Like, b: Vec3Like, s: number): Vec3
    negate(a: Vec3Like): Vec3
    dot(a: Vec3Like, b: Vec3Like): number
    cross(a: Vec3Like, b: Vec3Like): Vec3
    length(a: Vec3Like): number
    squaredLength(a: Vec3Like): number
    normalize(a: Vec3Like): Vec3
    lerp(a: Vec3Like, b: Vec3Like, t: number): Vec3
    distance(a: Vec3Like, b: Vec3Like): number
    squaredDistance(a: Vec3Like, b: Vec3Like): number
    transformMat4(a: Vec3Like, m: Mat4): Vec3
    transformQuat(a: Vec3Like, r: QuatLike): Vec3
    transformDirection(a: Vec3Like, m: Mat4): Vec3
    rotateY(a: Vec3Like, radians: number): Vec3
    rotateAroundAxis(a: Vec3Like, axis: Vec3Like, radians: number): Vec3
    min(a: Vec3Like, b: Vec3Like): Vec3
    max(a: Vec3Like, b: Vec3Like): Vec3
    abs(a: Vec3Like): Vec3
    equals(a: Vec3Like, b: Vec3Like, epsilon?: number): boolean
    angle(a: Vec3Like, b: Vec3Like): number
    project(a: Vec3Like, onto: Vec3Like): Vec3
    reflect(a: Vec3Like, normal: Vec3Like): Vec3
    moveTowards(a: Vec3Like, b: Vec3Like, maxDelta: number): Vec3
    toArray(a: Vec3Like): number[]
    toObject(a: Vec3Like): { x: number; y: number; z: number }
    zero(): Vec3
    one(): Vec3
    up(): Vec3
    down(): Vec3
    right(): Vec3
    left(): Vec3
    forward(): Vec3
    back(): Vec3
  }
  export interface QuatMath {
    create(): Quat
    identity(): Quat
    from(value: QuatLike): Quat
    clone(a: QuatLike): Quat
    set(out: Quat, x: number, y: number, z: number, w: number): Quat
    fromEuler(eulerDegrees: Vec3Like): Quat
    toEuler(a: QuatLike): Vec3
    fromAxisAngle(axis: Vec3Like, degrees: number): Quat
    fromMat4(m: Mat4): Quat
    multiply(a: QuatLike, b: QuatLike): Quat
    normalize(a: QuatLike): Quat
    conjugate(a: QuatLike): Quat
    inverse(a: QuatLike): Quat
    dot(a: QuatLike, b: QuatLike): number
    slerp(a: QuatLike, b: QuatLike, t: number): Quat
    nlerp(a: QuatLike, b: QuatLike, t: number): Quat
    rotateVec3(a: QuatLike, vector: Vec3Like): Vec3
    lookRotation(forward: Vec3Like, up?: Vec3Like): Quat
    angle(a: QuatLike, b: QuatLike): number
    toArray(a: QuatLike): number[]
  }
  export interface Mat4Math {
    create(): Mat4
    identity(): Mat4
    clone(a: Mat4): Mat4
    copy(out: Mat4, a: Mat4): Mat4
    multiply(a: Mat4, b: Mat4): Mat4
    invert(a: Mat4): Mat4 | null
    compose(translation: Vec3Like, rotation: QuatLike, scale: Vec3Like): Mat4
    fromTRS(translation: Vec3Like, rotationDegrees: Vec3Like, scale: Vec3Like): Mat4
    decompose(a: Mat4): { translation: Vec3; rotation: Vec3; scale: Vec3 }
    fromAxisAngle(axis: Vec3Like, degrees: number): Mat4
    fromRotationDegrees(euler: Vec3Like): Mat4
    fromQuat(rotation: QuatLike): Mat4
    getTranslation(a: Mat4): Vec3
    getRotation(a: Mat4): Quat
    getScale(a: Mat4): Vec3
    transformPoint(a: Mat4, point: Vec3Like): Vec3
    transformDirection(a: Mat4, direction: Vec3Like): Vec3
    perspective(fovDegrees: number, aspect: number, near: number, far: number): Mat4
    ortho(left: number, right: number, bottom: number, top: number, near: number, far: number): Mat4
    lookAt(eye: Vec3Like, target: Vec3Like, up?: Vec3Like): Mat4
    normalMatrix(a: Mat4): Mat3 | null
    toArray(a: Mat4): number[]
  }
  export interface Mat3Math {
    create(): Mat3
    identity(): Mat3
    clone(a: Mat3): Mat3
    multiply(a: Mat3, b: Mat3): Mat3
    fromQuat(rotation: QuatLike): Mat3
    fromAxisAngle(axis: Vec3Like, degrees: number): Mat3
    transformVec3(a: Mat3, vector: Vec3Like): Vec3
    invert(a: Mat3): Mat3 | null
    toArray(a: Mat3): number[]
  }
  export interface AabbMath {
    create(min?: Vec3Like, max?: Vec3Like): Aabb
    fromPoints(points: ArrayLike<number> | readonly Vec3Like[]): Aabb
    fromCenterSize(center: Vec3Like, size: Vec3Like): Aabb
    isEmpty(a: Aabb): boolean
    contains(a: Aabb, point: Vec3Like): boolean
    intersects(a: Aabb, b: Aabb): boolean
    union(a: Aabb, b: Aabb): Aabb
    expand(a: Aabb, amount: number | Vec3Like): Aabb
    expandByPoint(a: Aabb, point: Vec3Like): Aabb
    center(a: Aabb): Vec3
    size(a: Aabb): Vec3
    halfDiagonal(a: Aabb): number
    distanceToPoint(a: Aabb, point: Vec3Like): number
    transform(a: Aabb, matrix: Mat4): Aabb
  }
  export interface RayMath {
    create(origin?: Vec3Like, direction?: Vec3Like): Ray
    at(r: Ray, t: number): Vec3
    transform(r: Ray, matrix: Mat4): Ray
    intersectAabb(r: Ray, a: Aabb): number | null
    intersectPlane(r: Ray, planePoint: Vec3Like, planeNormal: Vec3Like): number | null
    intersectSphere(r: Ray, center: Vec3Like, radius: number): number | null
  }
  export interface ScalarMath {
    clamp(value: number, min: number, max: number): number
    clamp01(value: number): number
    lerp(a: number, b: number, t: number): number
    inverseLerp(a: number, b: number, value: number): number
    remap(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number
    smoothstep(edge0: number, edge1: number, value: number): number
                                                                                  
    damp(current: number, target: number, lambda: number, dt: number): number
    wrap(value: number, min: number, max: number): number
    wrapAngle(degrees: number): number
    deltaAngle(from: number, to: number): number
    degToRad(degrees: number): number
    radToDeg(radians: number): number
    sign(value: number): number
    approximately(a: number, b: number, epsilon?: number): boolean
    pingPong(value: number, length: number): number
    readonly DEG_TO_RAD: number
    readonly RAD_TO_DEG: number
    readonly EPSILON: number
    readonly TAU: number
  }
  export interface NoiseMath {
    perlin2(x: number, y: number, period?: number, seed?: number): number
    perlin3(x: number, y: number, z: number, seed?: number): number
    value2(x: number, y: number, seed?: number): number
    value3(x: number, y: number, z: number, seed?: number): number
    worley2(x: number, y: number, cells?: number, seed?: number): number
    worley3(x: number, y: number, z: number, cells?: number, seed?: number): number
    fbm(x: number, y: number, z?: number, octaves?: number, seed?: number, gain?: number): number
    fbm2(x: number, y: number, period?: number, octaves?: number, seed?: number): number
    ridged(x: number, y: number, z?: number, octaves?: number, seed?: number): number
  }
  export interface ColorMath {
    srgbToLinear(channel: number): number
    linearToSrgb(channel: number): number
    hexToVec3(hex: string): Vec3
    vec3ToHex(rgb: Vec3Like): string
    vec3ToCss(rgb: Vec3Like): string
    parse(value: ColorLike): Vec3
    temperatureToColor(kelvin: number): Vec3
    lerp(a: ColorLike, b: ColorLike, t: number): Vec3
    luminance(rgb: Vec3Like): number
    rgb(r: number, g: number, b: number): Vec3
    hsl(h: number, s: number, l: number): Vec3
  }
  export interface RandomSource {
    seed(value: number | string): void
    value(): number
    range(min: number, max: number): number
    int(min: number, max: number): number
    gaussian(mean?: number, deviation?: number): number
    unitVector(): Vec3
    pick<T>(list: readonly T[]): T | undefined
  }
  export interface RandomMath extends RandomSource {
    bool(probability?: number): boolean
    shuffle<T>(list: readonly T[]): T[]
    insideSphere(radius?: number): Vec3
    onCircle(radius?: number): Vec3
    color(): Vec3
                                                                         
    create(seed: number | string): RandomSource
  }
  export interface MathApi {
    readonly vec3: Vec3Math
    readonly quat: QuatMath
    readonly mat4: Mat4Math
    readonly mat3: Mat3Math
    readonly aabb: AabbMath
    readonly ray: RayMath
    readonly scalar: ScalarMath
    readonly noise: NoiseMath
    readonly color: ColorMath
    readonly random: RandomMath
    clamp(value: number, min: number, max: number): number
    lerp(a: number, b: number, t: number): number
    degToRad(degrees: number): number
    radToDeg(radians: number): number
    readonly PI: number
    readonly TAU: number
  }
`;
const SCENE_API = `
  export interface SceneApi {
    readonly root: Entity
    readonly sun: Entity | null
    readonly activeCamera: Entity | null
    find(name: string, from?: Entity): Entity | null
    findAll(name: string, from?: Entity): Entity[]
    byId(id: number): Entity | null
    byKind(kind: EntityKind): Entity[]
    byTag(tag: string): Entity[]
    traverse(visitor: (entity: Entity) => void, from?: Entity): void
    traverseVisible(visitor: (entity: Entity) => void, from?: Entity): void
    all(): Entity[]
    count(): number
    spawn(kind: EntityKind, options?: SpawnOptions, parent?: Entity): Entity
    spawnPrimitive(kind: PrimitiveKind, options?: SpawnOptions, parent?: Entity): Entity
    clone(entity: Entity, deep?: boolean, parent?: Entity): Entity
    destroy(entity: Entity): void
    reparent(entity: Entity, parent: Entity, index?: number): void
    insert(parent: Entity, child: Entity, index: number): void
    remove(parent: Entity, child: Entity): void
    contains(ancestor: Entity, descendant: Entity): boolean
    instantiate(asset: AssetRef, options?: SpawnOptions & { convertUnits?: boolean }): Promise<Entity>
    addComponent(entity: Entity, kind: ComponentKind, settings?: Record<string, unknown>): unknown
    removeComponent(entity: Entity, kind: ComponentKind): void
    rename(entity: Entity, name: string): void
    setVisible(entity: Entity, visible: boolean): void
    path(entity: Entity): string
    addTag(entity: Entity, tag: string): void
    removeTag(entity: Entity, tag: string): boolean
    hasTag(entity: Entity, tag: string): boolean
    getMeta(entity: Entity, key: string): JsonValue
    setMeta(entity: Entity, key: string, data: JsonValue): void
    isAttached(entity: Entity): boolean
    saveAsPrefab(entity: Entity, name: string): Promise<LibraryAsset>
    instantiatePrefab(asset: AssetRef, parent?: Entity): Promise<Entity>
    kinds(): EntityKind[]
    components(): ComponentKind[]
  }
  export interface TransformApi {
    position(entity: Entity): Vec3
    rotation(entity: Entity): Vec3
    scale(entity: Entity): Vec3
    setPosition(entity: Entity, position: Vec3Like): void
    setRotation(entity: Entity, rotation: Vec3Like): void
    setScale(entity: Entity, scale: Vec3Like | number): void
    localMatrix(entity: Entity): Mat4
    worldMatrix(entity: Entity): Mat4
    updateLocalMatrix(entity: Entity): boolean
    worldPosition(entity: Entity): Vec3
    worldRotation(entity: Entity): Quat
    worldRotationEuler(entity: Entity): Vec3
    worldScale(entity: Entity): Vec3
    setWorldPosition(entity: Entity, position: Vec3Like): void
    setWorldRotation(entity: Entity, rotation: QuatLike | Vec3Like): void
    setWorldMatrix(entity: Entity, matrix: Mat4): void
    forward(entity: Entity): Vec3
    back(entity: Entity): Vec3
    right(entity: Entity): Vec3
    left(entity: Entity): Vec3
    up(entity: Entity): Vec3
    down(entity: Entity): Vec3
    translate(entity: Entity, delta: Vec3Like, space?: Space): void
    rotate(entity: Entity, eulerDelta: Vec3Like, space?: Space): void
    rotateAround(entity: Entity, point: Vec3Like, axis: Vec3Like, degrees: number): void
    lookAt(entity: Entity, target: Vec3Like | Entity, up?: Vec3Like): void
    setParentKeepWorld(entity: Entity, parent: Entity): void
    localToWorld(entity: Entity, point: Vec3Like): Vec3
    worldToLocal(entity: Entity, point: Vec3Like): Vec3
    localToWorldDirection(entity: Entity, direction: Vec3Like): Vec3
    worldToLocalDirection(entity: Entity, direction: Vec3Like): Vec3
    bounds(entity: Entity): Aabb
    distance(a: Entity | Vec3Like, b: Entity | Vec3Like): number
    directionTo(a: Entity | Vec3Like, b: Entity | Vec3Like): Vec3
    reset(entity: Entity): void
  }

  export interface LodOverride { enabled: boolean; bias: number; forceLevel: number | null }
  export interface MeshApi {
    box(width?: number, height?: number, depth?: number, uvTileSize?: number): MeshData
    roundedBox(width?: number, height?: number, depth?: number, radius?: number): MeshData
    plane(width?: number, depth?: number, segments?: number): MeshData
    sphere(radius?: number, widthSegments?: number, heightSegments?: number): MeshData
    cylinder(radius?: number, height?: number, radialSegments?: number): MeshData
    cone(radius?: number, height?: number, radialSegments?: number): MeshData
    torus(radius?: number, tube?: number, radialSegments?: number, tubularSegments?: number): MeshData
    capsule(radius?: number, height?: number, radialSegments?: number, capSegments?: number): MeshData
    rock(radius?: number, segments?: number, seed?: number): MeshData
    denseSphere(radius?: number, segments?: number): MeshData
    torusKnot(radius?: number, tube?: number, p?: number, q?: number): MeshData
    flutedColumn(radius?: number, height?: number): MeshData
    engravedTorus(radius?: number, tube?: number): MeshData
    create(options: { name?: string; positions: Float32Array | number[]; normals?: Float32Array | number[]; uvs?: Float32Array | number[]; indices?: Uint16Array | Uint32Array | number[]; tangents?: Float32Array | number[] }): MeshData
    clone(mesh: MeshData, name?: string): MeshData
                                                                                 
    markDirty(mesh: MeshData): void
    version(mesh: MeshData): number
    vertexCount(mesh: MeshData): number
    triangleCount(mesh: MeshData): number
    computeNormals(mesh: MeshData): void
    computeBounds(mesh: MeshData): Aabb
    flipWinding(mesh: MeshData): MeshData
    merge(...meshes: MeshData[]): MeshData
    transform(mesh: MeshData, matrix: Mat4, name?: string): MeshData
    translate(mesh: MeshData, offset: Vec3Like): MeshData
    scale(mesh: MeshData, factor: number | Vec3Like): MeshData
    raycast(ray: Ray, mesh: MeshData, maxDistance?: number): number | null
    simplify(mesh: MeshData, ratio: number): MeshData
    fromModelAsset(asset: AssetRef, nodeName?: string): Promise<MeshData>
    toModelAsset(mesh: MeshData, name: string): Promise<LibraryAsset>
    positions(mesh: MeshData): Float32Array
    normals(mesh: MeshData): Float32Array
    uvs(mesh: MeshData): Float32Array
    indices(mesh: MeshData): Uint16Array | Uint32Array
    forEachVertex(mesh: MeshData, visitor: (position: Vec3, index: number) => void): void
    lod(entity: Entity, settings?: Partial<LodOverride>): LodOverride | null
    myriad(entity: Entity, enabled?: boolean): boolean
  }
  export interface CsgApi {
    operations(): CsgOperation[]
    makeTarget(entity: Entity, options?: Partial<CsgSettings>): CsgSettings
    makeBrush(entity: Entity, operation?: CsgOperation, enabled?: boolean): CsgBrushSettings
    rebuild(entity: Entity): void
    invalidate(entity: Entity): void
    stats(entity: Entity): CsgTargetStats | null
    onRebuilt(handler: (entity: Entity) => void): Unsubscribe
    collectBrushes(target: Entity): Entity[]
    brushTarget(brush: Entity): Entity | null
    boolean(a: MeshData, b: MeshData, operation: CsgOperation, brushMatrix?: Mat4, exact?: boolean): MeshData
    sourceMesh(entity: Entity): MeshData | null
  }

                                                                                                                                                                  
  export type ShaderUniformValue = number | boolean | ArrayLike<number> | Texture | ReadonlyArray<number | boolean | ArrayLike<number>>
                                                                                                            
  export interface ShaderUniforms {
    set(name: string, value: ShaderUniformValue | null): void
    set(values: Record<string, ShaderUniformValue | null>): void
    get(name: string): ShaderUniformValue | undefined
    has(name: string): boolean
    list(): { name: string; type: string; arraySize: number; active: boolean }[]
  }
                                                                                             
  export type ShaderMaterial = Material & { readonly uniforms: ShaderUniforms }
  export interface MaterialApi {
    create(options?: Partial<Omit<Material, 'baseColor' | 'emissive' | 'uvTiling'>> & { baseColor?: ColorLike; emissive?: ColorLike; uvTiling?: Vec3Like }): Material
    clone(material: Material): Material
    copy(target: Material, source: Material): Material
    set(material: Material, patch: Partial<Omit<Material, 'baseColor' | 'emissive' | 'uvTiling'>> & { baseColor?: ColorLike; emissive?: ColorLike; uvTiling?: Vec3Like }): Material
    hasAnyTexture(material: Material): boolean
    of(entity: Entity): Material | null
    assign(entity: Entity, material: Material | null): Material | null
                                                                               
    own(entity: Entity): Material
    setColor(target: Entity | Material, color: ColorLike): void
    setEmissive(target: Entity | Material, color: ColorLike, intensity?: number): void
    setTexture(target: Entity | Material, slot: MaterialTextureSlot, texture: Texture | null): void
    slots(): { slot: MaterialTextureSlot; label: string; colorSpace: 'linear' | 'srgb' }[]
       
                                                                                           
                                                                                                                    
                                                                               
       
    fromShader(asset: AssetRef, uniforms?: Record<string, ShaderUniformValue | null>): ShaderMaterial
                                                                                               
    uniforms(target: Entity | Material): ShaderUniforms
    generateNormalFromHeight(image: ImageData | ImageBitmap | HTMLCanvasElement, strength?: number): Promise<ImageData | null>
    generateMaps(image: ImageData | ImageBitmap | HTMLCanvasElement, settings?: Record<string, unknown>): Promise<Record<string, ImageData | null>>
    packOrm(sources: { occlusion?: ImageData; roughness?: ImageData; metallic?: ImageData }): ImageData | null
  }
  export interface MaterialLibraryApi {
    get(idOrName: string): MaterialDocument | null
    list(): MaterialDocument[]
    names(): string[]
    save(material: Material, name: string): MaterialDocument | null
    remove(idOrName: string): void
    rename(idOrName: string, name: string): void
    instantiate(idOrName: string): Material
    apply(entity: Entity, idOrName: string, withPhysics?: boolean): boolean
    update(idOrName: string, patch: Partial<Material>): void
    forMaterial(material: Material): MaterialDocument | null
    onChanged(handler: (document: MaterialDocument) => void): Unsubscribe
  }
  export interface TextureApi {
    create(options: Partial<Texture> & { width: number; height: number }): Texture
    fromAsset(asset: AssetRef, options?: Partial<Texture>): Promise<Texture>
    fromImage(image: ImageBitmap | HTMLCanvasElement | HTMLImageElement | ImageData, options?: Partial<Texture>): Texture
    fromPixels(width: number, height: number, pixels: Uint8Array | Uint8ClampedArray | Float32Array, options?: Partial<Texture>): Texture
    setImage(texture: Texture, image: ImageBitmap | HTMLCanvasElement | HTMLImageElement | ImageData): void
                                                                                        
    touch(texture: Texture): void
    readPixels(texture: Texture): ImageData
    canvas(width: number, height: number, options?: Partial<Texture>): { texture: Texture; context: CanvasRenderingContext2D; canvas: HTMLCanvasElement; update: () => void }
    isTexture(value: unknown): value is Texture
  }

  export type LightPresetId = string
  export interface LightApi {
    types(): LightType[]
    localTypes(): LocalLightType[]
    create<T extends LightType>(type: T, options?: Record<string, unknown>): Extract<Light, { type: T }>
    clone(light: Light): Light
    fromPreset(id: LightPresetId): LocalLight
    presets(): { id: LightPresetId; label: string; description: string; type: LocalLightType }[]
    spawn(typeOrPreset: LightType | LightPresetId, options?: SpawnOptions & Record<string, unknown>, parent?: Entity): Entity
    set(target: Entity | Light, patch: Record<string, unknown>): void
    convert(target: Entity | Light, type: LocalLightType): LocalLight
    all(query?: { type?: LightType; local?: boolean }): { entity: Entity; light: Light }[]
    sun(): Entity | null
    ambient(): Entity | null
    syncSunToSky(): boolean
    driveSun: boolean
    isLocal(light: Light | Entity): boolean
    effectiveRange(light: LocalLight | Entity): number
    resolvedColor(light: LocalLight | Entity): Vec3
    temperatureToColor(kelvin: number): Vec3
    setTemperature(target: Entity | LocalLight, kelvin: number | null): void
    setColor(target: Entity | Light, color: ColorLike): void
    cssColor(light: Light | Entity): string
    readonly temperatureRange: { readonly min: number; readonly max: number }
  }

  export interface CameraApi {
                                                                                                               
    readonly main: Entity | null
    setMain(entity: Entity | null): void
    onMainChanged(handler: (entity: Entity | null) => void): Unsubscribe
    readonly position: Vec3
    readonly target: Vec3
    readonly forward: Vec3
    fov: number
    near: number
    far: number
    exposure: number
    readonly aspect: number
    setPose(position: Vec3Like, target: Vec3Like): void
    lookAt(target: Vec3Like | Entity): void
    readonly viewport: { readonly width: number; readonly height: number; readonly pixelRatio: number }
    readonly viewMatrix: Mat4
    readonly projectionMatrix: Mat4
    readonly viewProjectionMatrix: Mat4
    screenToRay(x: number, y: number): Ray | null
    worldToScreen(point: Vec3Like): { x: number; y: number; depth: number; behind: boolean } | null
    pick(x: number, y: number, options?: { includeHidden?: boolean }): Entity | null
    pickPoint(x: number, y: number): Vec3 | null
    shake(amplitude: number, seconds?: number): void
    readonly shaking: boolean
    fade(color?: ColorLike, seconds?: number, direction?: 'in' | 'out'): Promise<void>
    readonly player: { readonly settings: PlayerCameraSettings; set(patch: Partial<PlayerCameraSettings>): void; control: 'engine' | 'script'; yaw: number; pitch: number }
    frame(entity: Entity): void
    mainForward(): Vec3
    distanceTo(target: Entity | Vec3Like): number
  }

  export interface CloudSettings {
    enabled: boolean
    coverage: number
    density: number
    altitude: number
    thickness: number
    detail: number
    windSpeed: number
    windDirection: number
    shadows: boolean
    quality: 'low' | 'medium' | 'high'
  }
  export interface SkySettings {
    enabled: boolean
    timeOfDay: number
    cycleSpeed: number
    latitude: number
    sunAzimuth: number
    haze: number
    sunDiskScale: number
    moonPhase: number
    moonScale: number
    moonlight: number
    starsIntensity: number
    skyLighting: number
    readonly clouds: CloudSettings
  }
  export type SkyPresetId = 'dawn' | 'noon' | 'dusk' | 'night' | 'overcast' | 'storm'
  export interface SkyApi {
    readonly settings: SkySettings
    readonly clouds: CloudSettings
    set(patch: Partial<Omit<SkySettings, 'clouds'>> & { clouds?: Partial<CloudSettings> }): void
    enabled: boolean
    timeOfDay: number
    cycleSpeed: number
                                                                                             
    driveSun: boolean
    advance(deltaSeconds: number): boolean
    syncSun(): boolean
    wrapTimeOfDay(hours: number): number
    formatTimeOfDay(hours?: number): string
    sunDirection(timeOfDay?: number, latitude?: number, azimuth?: number): Vec3
    moonDirection(timeOfDay?: number, latitude?: number, azimuth?: number): Vec3
    readonly isDay: boolean
    moonPhaseName(phase?: number): string
    moonLitFraction(): number
    hourAngle(timeOfDay?: number): number
    presets(): { id: SkyPresetId; label: string }[]
    preset(id: SkyPresetId): void
    onHourChanged(handler: (hour: number) => void): Unsubscribe
    onSunrise(handler: (timeOfDay: number) => void): Unsubscribe
    onSunset(handler: (timeOfDay: number) => void): Unsubscribe
  }
  export interface WorldApi {
    readonly wind: { readonly direction: Vec3; speed: number; set(options: { direction?: Vec3Like | number; speed?: number }): void }
    readonly gravity: Vec3
    readonly sky: SkySettings
    readonly player: PlayerSettings
  }
`;
const RENDER_API = `
  export type ToneMapper = 'aces' | 'agx' | 'filmic' | 'neutral' | 'reinhard' | 'none'
  export interface PostProcessSettings {
    enabled: boolean
    exposure: number
    toneMapper: ToneMapper
    whiteBalance: { temperature: number; tint: number }
    grading: { contrast: number; saturation: number; vibrance: number; shadows: number; midtones: number; highlights: number; shadowTint: Vec3; highlightTint: Vec3; toneBalance: number }
    bloom: { enabled: boolean; intensity: number; threshold: number; softKnee: number; radius: number }
    depthOfField: { enabled: boolean; focusDistance: number; focalLength: number; aperture: number; maxBlur: number }
    vignette: { enabled: boolean; intensity: number; smoothness: number; roundness: number }
    chromaticAberration: { enabled: boolean; intensity: number }
    filmGrain: { enabled: boolean; intensity: number; size: number; luminanceResponse: number }
    lensDistortion: { enabled: boolean; intensity: number; scale: number }
    sharpen: { enabled: boolean; intensity: number }
  }
  export type Easing = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'
  export interface PostApi {
    readonly settings: PostProcessSettings
    set(patch: Partial<PostProcessSettings>): void
    enabled: boolean
    exposure: number
    toneMapper: ToneMapper
    toneMappers(): ToneMapper[]
    readonly whiteBalance: PostProcessSettings['whiteBalance']
    readonly grading: PostProcessSettings['grading']
    readonly bloom: PostProcessSettings['bloom']
    readonly depthOfField: PostProcessSettings['depthOfField']
    readonly vignette: PostProcessSettings['vignette']
    readonly chromaticAberration: PostProcessSettings['chromaticAberration']
    readonly filmGrain: PostProcessSettings['filmGrain']
    readonly lensDistortion: PostProcessSettings['lensDistortion']
    readonly sharpen: PostProcessSettings['sharpen']
    presets(): { id: string; label: string; description: string }[]
    applyPreset(id: string): void
    currentPreset(): string | null
    assign(target: PostProcessSettings, source: PostProcessSettings): void
    create(options?: Partial<PostProcessSettings>): PostProcessSettings
    snapshot(): PostProcessSettings
                                                                                    
    focusOn(entity: Entity): number
    compareSplit: number | null
                                                                                                  
    tween(path: string, value: number, seconds: number, easing?: Easing): Promise<void>
       
                                                                                                          
                                                                                                          
                                                                                                      
       
    readonly custom: {
      add(pass: { fragment: AssetRef; name?: string; uniforms?: Record<string, ShaderUniformValue | null>; enabled?: boolean }): CustomPostEffect
      get(nameOrEffect: string | CustomPostEffect): CustomPostEffect | null
      remove(nameOrEffect: string | CustomPostEffect): boolean
      list(): { name: string; shader: string; enabled: boolean }[]
      clear(): void
    }
  }
                                                                                                     
  export interface CustomPostEffect {
    readonly name: string
    enabled: boolean
    readonly uniforms: ShaderUniforms
    remove(): void
  }

  export type RenderPassName = 'shadow' | 'localShadow' | 'depthPrepass' | 'mesh' | 'terrain' | 'grass' | 'water' | 'sky' | 'vfx' | 'guiSurface' | 'post' | 'overlays'
  export type FrameHook = (gl: WebGL2RenderingContext | null, frame: FrameInfo) => void
  export interface RenderProfile {
    tier: string
    shadowMapSize: number
    antialias: 'smaa' | 'taa' | 'none'
    maxLocalLights: number
    hdrFormat: string
    [key: string]: unknown
  }
  export interface RenderStats {
    drawCalls: number
    triangles: number
    width: number
    height: number
    pixelRatio: number
    gpuName: string
    gpuTier: string
                                                                                 
    gpuTierSource: string
                                                                                                     
    gpuScore: number
    softwareRenderer: boolean
    shadersPending: number
    shadersTotal: number
    cpuMs: number
    gpuMs: number
    fps: number
    idle: boolean
    [key: string]: unknown
  }
  export interface ShaderProgram {
    readonly program: WebGLProgram | null
    readonly ready: boolean
    use(): void
    uniform(name: string): WebGLUniformLocation | null
    dispose(): void
  }
  export interface RenderApi {
                                                                                                             
    enabled: boolean
    readonly passes: Record<RenderPassName, { enabled: boolean }>
    passNames(): RenderPassName[]
    showGrid: boolean
    shadows: boolean
    showCsgBrushes: boolean
    lightHelpers: 'all' | 'selected' | 'off'
    soundHelpers: 'all' | 'selected' | 'off'
    vfxHelpers: 'all' | 'selected' | 'off'
    readonly culling: { frustumCulling: boolean; minPixelSize: number }
    readonly lod: { enabled: boolean; bias: number }
    readonly myriad: { enabled: boolean; pixelError: number; occlusionCulling: boolean; shadowClusters: boolean; freeze: boolean; debugView: string; hzbLevel: number; wireframe: boolean }
    terrainMaterialCache: boolean
    profileGpu: boolean
    renderOnDemand: boolean
    readonly pixelRatio: number
    readonly profile: RenderProfile
    setProfile(patch: Partial<RenderProfile>): void
    readonly stats: RenderStats
    readonly frame: FrameInfo
    onBeforeFrame(fn: FrameHook): Unsubscribe
    onAfterFrame(fn: FrameHook): Unsubscribe
    onBeforePass(name: RenderPassName, fn: FrameHook): Unsubscribe
    onAfterPass(name: RenderPassName, fn: FrameHook): Unsubscribe
    readonly custom: { add(pass: { name: string; after: RenderPassName; render: FrameHook }): Unsubscribe; list(): { name: string; after: string }[] }
    readonly gl: WebGL2RenderingContext
    readonly canvas: HTMLCanvasElement | null
    readonly capabilities: Record<string, unknown>
    createProgram(vertexSource: string, fragmentSource: string, defines?: Record<string, string | number | boolean>): ShaderProgram
    createTexture(options: Record<string, unknown>): never
    createRenderTarget(width: number, height: number, format?: string): never
    createMesh(mesh: MeshData): never
    fullscreenTriangle(): never
    readonly shaders: { override(target: string, asset: AssetRef): never }
    skybox(texture: Texture): never
  }
`;
const PHYSICS_API = `
  export interface PhysicsSettings {
    gravity: Vec3
    fixedTimestep: number
    substeps: number
    solverIterations: number
    relaxIterations: number
    contactHertz: number
    contactDampingRatio: number
    contactPushMaxVelocity: number
    linearSlop: number
    speculativeDistance: number
    restitutionThreshold: number
    maxLinearSpeed: number
    sleepEnabled: boolean
    sleepLinearThreshold: number
    sleepAngularThreshold: number
    timeToSleep: number
    fallLimitY: number
    warmStarting: boolean
    waterDensity: number
    waterDrag: number
    waterAngularDrag: number
  }
  export interface PhysicsStats {
    bodies: number
    awake: number
    manifolds: number
    contactPoints: number
                                                                                             
    joints: number
    stepMs: number
                                                             
    stepMsAverage: number
                                                              
    stepsLastAdvance: number
                                                                                                                                     
    catchUpSteps: number
                                                               
    simulatedSeconds: number
                                                        
    advanceMs: number
                                                                                                                                                
    droppedSeconds: number
                                                                                                                                                                     
    backend: 'local' | 'worker-shared' | 'worker-copy'
  }
  export interface RigidBodyHandle {
    readonly raw: unknown
    readonly entity: Entity | null
    readonly id: number
    readonly type: 'static' | 'kinematic' | 'dynamic'
    readonly isStatic: boolean
    readonly isKinematic: boolean
    readonly isDynamic: boolean
    readonly isMoving: boolean
    readonly isResting: boolean
    readonly isActive: boolean
    readonly isSleeping: boolean
    readonly motionSpeed: number
    readonly position: Vec3
    readonly orientation: Quat
    readonly mass: number
    readonly invMass: number
    readonly aabb: Aabb
    linearVelocity: Vec3
    angularVelocity: Vec3
    readonly friction: number
    readonly restitution: number
    gravityScale: number
                                                                                            
    readonly layer: string
    applyImpulse(impulse: Vec3Like, point?: Vec3Like): void
    applyAngularImpulse(impulse: Vec3Like): void
    applyForce(force: Vec3Like, point?: Vec3Like): void
    applyTorque(torque: Vec3Like): void
    setPose(position: Vec3Like, orientation?: QuatLike): void
    teleport(position: Vec3Like, orientation?: QuatLike): void
    moveKinematic(position: Vec3Like, orientation?: QuatLike, step?: number): void
    setMaterial(material: { friction?: number; restitution?: number; linearDamping?: number; angularDamping?: number; gravityScale?: number; canSleep?: boolean }): void
    wake(): void
    sleep(): void
    lockRotation(x: boolean, y: boolean, z: boolean): void
    lockPosition(x: boolean, y: boolean, z: boolean): void
  }
  export type JointType = 'ball' | 'hinge' | 'slider' | 'fixed' | 'distance' | 'cone-twist' | 'wheel'
  export interface JointLimits { enabled: boolean; min: number; max: number }
  export interface JointMotor { enabled: boolean; targetVelocity: number; maxForce: number }
  export interface JointSpring { enabled: boolean; hertz: number; dampingRatio: number; target: number }
                                                                                                                                                          
  export interface JointParams {
    enabled?: boolean
                                                                    
    collideConnected?: boolean
                                                                                                                                                                                                
    limits?: [number, number] | Partial<JointLimits> | null
                                                                                                                                   
    motor?: Partial<JointMotor> | null
                                                                                                                                                    
    spring?: Partial<JointSpring> | null
                                                                            
    breakForce?: number | null
    breakTorque?: number | null
                                                                                            
    length?: number
                                                                     
    coneAngle?: number
                                                                 
    brakeTorque?: number
                                                             
    steeringAngle?: number
  }
                                                                              
  export interface JointFrame {
                                                                                           
    anchor?: Vec3Like
                                                                                
    anchorA?: Vec3Like
    anchorB?: Vec3Like
                                                                                                         
    axis?: Vec3Like
                                                                                                   
    secondaryAxis?: Vec3Like
    axle?: Vec3Like
  }
  export type JointOptions = JointFrame & JointParams
  export interface JointHandle {
    readonly raw: unknown
    readonly id: number
    readonly type: JointType
                                                                                                
    readonly isAngular: boolean
    readonly bodyA: RigidBodyHandle
                                               
    readonly bodyB: RigidBodyHandle | null
    readonly entityA: Entity | null
    readonly entityB: Entity | null
                                                                        
    readonly anchorA: Vec3
    readonly anchorB: Vec3
    readonly axis: Vec3
    enabled: boolean
    collideConnected: boolean
    readonly isBroken: boolean
    readonly isActive: boolean
                                                                                                                          
    readonly coordinate: number
                                                                                 
    readonly speed: number
                                                                  
    readonly reactionForce: Vec3
    readonly reactionTorque: Vec3
                                                                        
    readonly axialForce: number
                                                                            
    readonly motorForce: number
    readonly limits: JointLimits
    setLimits(min: number, max: number): void
    clearLimits(): void
    readonly motor: JointMotor
    setMotor(targetVelocity: number, maxForce?: number): void
    stopMotor(): void
    readonly spring: JointSpring
    setSpring(hertz: number, dampingRatio?: number, target?: number): void
    clearSpring(): void
    breakForce: number
    breakTorque: number
    length: number
    coneAngle: number
    brakeTorque: number
    steeringAngle: number
    set(patch: JointParams): void
                                                                                                      
    break(): void
    remove(): void
  }
  export type FieldMode = 'acceleration' | 'force'
  export type FieldRegion = { readonly kind: 'everywhere' } | { readonly kind: 'sphere'; readonly center: Vec3; radius: number; falloff: number } | { readonly kind: 'box'; readonly center: Vec3; readonly halfExtents: Vec3; falloff: number }
  export type FieldRegionLike = FieldRegion | { center: Vec3Like; radius: number; falloff?: number } | { center: Vec3Like; halfExtents: Vec3Like; falloff?: number }
  export interface ForceFieldHandle {
    readonly raw: unknown
    readonly kind: 'directional' | 'radial' | 'vortex' | 'drag'
    enabled: boolean
    region: FieldRegion
    readonly attached: boolean
    remove(): void
  }
  export interface DirectionalFieldHandle extends ForceFieldHandle {
    readonly kind: 'directional'
    direction: Vec3
                                                                                                        
    strength: number
    mode: FieldMode
  }
  export interface RadialFieldHandle extends ForceFieldHandle {
    readonly kind: 'radial'
    center: Vec3
                                                                
    strength: number
                                              
    radius: number
                                                                                                
    falloff: 'none' | 'linear' | 'inverse-square'
    mode: FieldMode
  }
  export interface VortexFieldHandle extends ForceFieldHandle {
    readonly kind: 'vortex'
    center: Vec3
    axis: Vec3
    strength: number
    inwardStrength: number
    liftStrength: number
    radius: number
    falloff: 'none' | 'linear'
    mode: FieldMode
  }
  export interface DragFieldHandle extends ForceFieldHandle {
    readonly kind: 'drag'
                                       
    linear: number
                                                                     
    quadratic: number
                                             
    angular: number
  }
  export interface ExplosionOptions {
    falloff?: 'none' | 'linear' | 'inverse-square'
                                                              
    upwardBias?: number
                                                                                                               
    mode?: 'impulse' | 'velocity'
  }
  export interface RaycastHit {
    readonly entity: Entity | null
    readonly body: RigidBodyHandle | null
    readonly point: Vec3
    readonly normal: Vec3
    readonly distance: number
  }
  export interface QueryFilter {
    exclude?: readonly Entity[]
    tags?: readonly string[]
    kinds?: readonly EntityKind[]
    layers?: readonly string[]
    includeTriggers?: boolean
  }
  export interface PhysicsApi {
    readonly running: boolean
                                                                                    
    enabled: boolean
    readonly stats: PhysicsStats
    readonly fixedTimestep: number
    readonly interpolation: number
    readonly bodyCount: number
    stepOnce(): void
    discardAccumulatedTime(): void
    onPreStep(fn: (h: number) => void): Unsubscribe
    addForceField(field: { wakeAffected?(bodies: readonly unknown[], time: number): void; apply(bodies: readonly unknown[], h: number, time: number): void }): Unsubscribe
    bodyOf(entity: Entity): RigidBodyHandle
    hasBody(entity: Entity): boolean
    bodies(): { entity: Entity; body: RigidBodyHandle }[]
    entityOf(body: RigidBodyHandle | unknown): Entity | null
    raycast(origin: Vec3Like, direction: Vec3Like, maxDistance?: number, filter?: QueryFilter): RaycastHit | null
    raycastAll(origin: Vec3Like, direction: Vec3Like, maxDistance?: number, filter?: QueryFilter): RaycastHit[]
    overlapAabb(box: Aabb | { min: Vec3Like; max: Vec3Like }, filter?: QueryFilter): Entity[]
    overlapSphere(center: Vec3Like, radius: number, filter?: QueryFilter): Entity[]
    overlapBox(center: Vec3Like, halfExtents: Vec3Like, rotation?: QuatLike, filter?: QueryFilter): Entity[]
    sweep(shape: unknown, from: Vec3Like, to: Vec3Like, filter?: QueryFilter): RaycastHit | null
    closestPoint(point: Vec3Like, target: Entity): Vec3
    fitCollider(entity: Entity): RigidBodySettings
    massProperties(entity: Entity): { mass: number; density: number; volume: number }
    colliderRequiresStatic(kind: RigidBodySettings['collider']): boolean
    colliderVolume(entity: Entity): number
    readonly physical: {
      presets(): { id: string; label: string; properties: PhysicalProperties }[]
      create(overrides?: Partial<PhysicalProperties>): PhysicalProperties
      match(properties: PhysicalProperties): string | null
      apply(entity: Entity, presetOrProperties: string | PhysicalProperties): RigidBodySettings
    }
    readonly shapes: {
      box(halfX: number, halfY: number, halfZ: number): unknown
      sphere(radius: number): unknown
      capsule(radius: number, halfHeight: number): unknown
      mesh(mesh: MeshData | Entity, scale?: Vec3Like): unknown | null
      volume(shape: unknown): number
      aabb(shape: unknown, position: Vec3Like, orientation?: QuatLike): Aabb
    }
    waterAt(point: Vec3Like): { height: number; normal: Vec3; velocity: Vec3 } | null
       
                                                                                            
                                                                                            
                                                                                            
       
    readonly layers: {
                                                                                                                                                        
      define(layers: readonly string[]): string[]
                                                                              
      setCollision(a: string, b: string, enabled: boolean): void
      collides(a: string, b: string): boolean
      list(): string[]
                                                                       
      of(entity: Entity): string
      readonly default: string
    }
    backend: unknown
    onOutOfBounds(handler: (entity: Entity) => void): Unsubscribe
    onUnstable(handler: (entity: Entity) => void): Unsubscribe
    onCollisionBegin(handler: (event: { a: Entity; b: Entity; contact: Contact }) => void): Unsubscribe
    onCollisionEnd(handler: (event: { a: Entity; b: Entity }) => void): Unsubscribe
       
                                                                                                   
                                                                                                      
                                                                                                                          
       
    readonly joints: {
      readonly types: JointType[]
      create(type: JointType, a: Entity | RigidBodyHandle, b: Entity | RigidBodyHandle | null, options?: JointOptions): JointHandle
                                                                         
      ball(a: Entity | RigidBodyHandle, b: Entity | RigidBodyHandle | null, options?: JointOptions): JointHandle
                                                                       
      hinge(a: Entity | RigidBodyHandle, b: Entity | RigidBodyHandle | null, options?: JointOptions): JointHandle
                                                                                            
      slider(a: Entity | RigidBodyHandle, b: Entity | RigidBodyHandle | null, options?: JointOptions): JointHandle
                                                           
      fixed(a: Entity | RigidBodyHandle, b: Entity | RigidBodyHandle | null, options?: JointOptions): JointHandle
                                                                                                             
      distance(a: Entity | RigidBodyHandle, b: Entity | RigidBodyHandle | null, options?: JointOptions): JointHandle
                                                                                                                
      coneTwist(a: Entity | RigidBodyHandle, b: Entity | RigidBodyHandle | null, options?: JointOptions): JointHandle
                                                                                                                                                
      wheel(chassis: Entity | RigidBodyHandle, wheel: Entity | RigidBodyHandle, options?: JointOptions): JointHandle
      remove(joint: JointHandle): void
      all(): JointHandle[]
                                                    
      of(target: Entity | RigidBodyHandle): JointHandle[]
      readonly count: number
                                                                                         
      onBreak(handler: (event: { joint: JointHandle; a: Entity | null; b: Entity | null }) => void): Unsubscribe
    }
       
                                                                                                      
                                                                                                                                        
       
    readonly forces: {
      everywhere(): FieldRegion
                                                                                                                  
      sphere(center: Vec3Like, radius: number, falloff?: number): FieldRegion
      box(center: Vec3Like, halfExtents: Vec3Like, falloff?: number): FieldRegion
                                                                   
      directional(options: { direction: Vec3Like; strength: number; mode?: FieldMode; region?: FieldRegionLike; enabled?: boolean }): DirectionalFieldHandle
                                                                        
      radial(options: { center: Vec3Like; strength: number; radius?: number; falloff?: 'none' | 'linear' | 'inverse-square'; mode?: FieldMode; region?: FieldRegionLike; enabled?: boolean }): RadialFieldHandle
                                                                                                                                
      vortex(options: { center: Vec3Like; axis?: Vec3Like; strength: number; inwardStrength?: number; liftStrength?: number; radius?: number; falloff?: 'none' | 'linear'; mode?: FieldMode; region?: FieldRegionLike; enabled?: boolean }): VortexFieldHandle
                                                                                                         
      drag(options?: { linear?: number; quadratic?: number; angular?: number; region?: FieldRegionLike; enabled?: boolean }): DragFieldHandle
                                                                                                                           
      explode(center: Vec3Like, radius: number, strength: number, options?: ExplosionOptions): number
      remove(field: ForceFieldHandle): void
    }
    readonly settings: PhysicsSettings
    set(patch: Partial<PhysicsSettings>): void
    readonly gravity: Vec3
    quality: 'low' | 'medium' | 'high' | null
    resetSettings(): void
  }

  export interface CharacterIntent { x: number; z: number; run: boolean; jump: boolean; crouch: boolean; lookX: number; lookY: number }
  export interface CharacterHandle {
    readonly entity: Entity
    readonly settings: CharacterSettings
    readonly isGrounded: boolean
    readonly isCrouching: boolean
    readonly horizontalSpeed: number
    readonly velocity: Vec3
    readonly position: Vec3
    readonly groundNormal: Vec3
    readonly height: number
    readonly yaw: number
    readonly rigidBody: RigidBodyHandle | null
    readonly intent: CharacterIntent
    readonly hasRig: boolean
    readonly isPossessed: boolean
    move(x: number, z: number): void
    moveRelative(forward: number, right: number): void
    look(dx: number, dy: number): void
    jump(): void
    run(value: boolean): void
    crouch(value: boolean): void
    stop(): void
    teleport(position: Vec3Like, yaw?: number): void
    setIntent(partial: Partial<CharacterIntent>): void
  }
  export interface CharacterApi {
    of(entity: Entity): CharacterHandle
    has(entity: Entity): boolean
    all(): CharacterHandle[]
                                                                         
    inputSource: 'engine' | 'script'
    readonly inputFrame: { x: number; z: number; run: boolean; jump: boolean; crouchToggles: number; lookX: number; lookY: number; wheel: number } | null
    settingsOf(entity: Entity): CharacterSettings | null
    spawn(options?: SpawnOptions & { character?: Partial<CharacterSettings> }): Entity
    findPossessable(): Entity | null
    controllerClass: unknown
    onLanded(handler: (event: { entity: Entity; speed: number }) => void): Unsubscribe
    onJumped(handler: (event: { entity: Entity }) => void): Unsubscribe
  }
  export interface PlayerApi {
    readonly settings: PlayerSettings
    set(patch: Partial<Omit<PlayerSettings, 'character' | 'camera'>> & { character?: Partial<CharacterSettings>; camera?: Partial<PlayerCameraSettings> }): void
    enabled: boolean
    readonly possessed: Entity | null
    readonly isPossessing: boolean
    possess(entity: Entity): void
    unpossess(): void
                                                                                        
    cameraControl: 'engine' | 'script'
    readonly pointerLocked: boolean
    readonly transientCharacter: Entity | null
    readonly spawnPoint: Vec3
    onPossessed(handler: (entity: Entity | null) => void): Unsubscribe
  }
`;
