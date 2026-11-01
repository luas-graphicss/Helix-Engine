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
`;
