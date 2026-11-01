import { ENGINE_VERSION } from '@/engine/core/engine-info';
export const API_VERSION = ENGINE_VERSION;
export interface ApiNamespace {
    readonly name: string;
    readonly section: string;
    readonly members: readonly string[];
    readonly editorOnly?: boolean;
}
const VEC3 = ['create', 'from', 'clone', 'copy', 'set', 'add', 'sub', 'subtract', 'scale', 'multiply', 'scaleAndAdd', 'negate', 'dot', 'cross', 'length', 'squaredLength', 'normalize', 'lerp', 'distance', 'squaredDistance', 'transformMat4', 'transformQuat', 'transformDirection', 'rotateY', 'rotateAroundAxis', 'min', 'max', 'abs', 'equals', 'angle', 'project', 'reflect', 'moveTowards', 'toArray', 'toObject', 'zero', 'one', 'up', 'down', 'right', 'left', 'forward', 'back'];
const QUAT = ['create', 'identity', 'from', 'clone', 'set', 'fromEuler', 'toEuler', 'fromAxisAngle', 'fromMat4', 'multiply', 'normalize', 'conjugate', 'inverse', 'dot', 'slerp', 'nlerp', 'rotateVec3', 'lookRotation', 'angle', 'toArray'];
const MAT4 = ['create', 'identity', 'clone', 'copy', 'multiply', 'invert', 'compose', 'fromTRS', 'decompose', 'fromAxisAngle', 'fromRotationDegrees', 'fromQuat', 'getTranslation', 'getRotation', 'getScale', 'transformPoint', 'transformDirection', 'perspective', 'ortho', 'lookAt', 'normalMatrix', 'toArray'];
const MAT3 = ['create', 'identity', 'clone', 'multiply', 'fromQuat', 'fromAxisAngle', 'transformVec3', 'invert', 'toArray'];
const AABB = ['create', 'fromPoints', 'fromCenterSize', 'isEmpty', 'contains', 'intersects', 'union', 'expand', 'expandByPoint', 'center', 'size', 'halfDiagonal', 'distanceToPoint', 'transform'];
const RAY = ['create', 'at', 'transform', 'intersectAabb', 'intersectPlane', 'intersectSphere'];
const SCALAR = ['clamp', 'clamp01', 'lerp', 'inverseLerp', 'remap', 'smoothstep', 'damp', 'wrap', 'wrapAngle', 'deltaAngle', 'degToRad', 'radToDeg', 'sign', 'approximately', 'pingPong', 'DEG_TO_RAD', 'RAD_TO_DEG', 'EPSILON', 'TAU'];
const NOISE = ['perlin2', 'perlin3', 'value2', 'value3', 'worley2', 'worley3', 'fbm', 'fbm2', 'ridged'];
const COLOR = ['srgbToLinear', 'linearToSrgb', 'hexToVec3', 'vec3ToHex', 'vec3ToCss', 'parse', 'temperatureToColor', 'lerp', 'luminance', 'rgb', 'hsl'];
const RANDOM = ['seed', 'value', 'range', 'int', 'bool', 'pick', 'shuffle', 'gaussian', 'unitVector', 'insideSphere', 'onCircle', 'color', 'create'];
function nested(prefix: string, members: readonly string[]): string[] {
    return members.map((member) => `${prefix}.${member}`);
}
export const API_MANIFEST: readonly ApiNamespace[] = [
    { name: 'time', section: '1.3', members: ['now', 'delta', 'fixedDelta', 'unscaledDelta', 'frame', 'realtime', 'scale', 'wait', 'waitFrames', 'delay', 'every', 'nextFrame'] },
    { name: 'task', section: '1.3', members: ['spawn', 'cancel', 'all', 'running'] },
    { name: 'log', section: '1.4', members: ['info', 'warn', 'error', 'debug', 'assert', 'trace', 'clear'] },
    { name: 'debug', section: '1.4', members: ['line', 'ray', 'sphere', 'box', 'bounds', 'axes', 'text', 'clear'] },
    { name: 'events', section: '1.5', members: ['on', 'once', 'off', 'emit', 'onEntity', 'emitEntity', 'listenerCount', 'names'] },
    {
        name: 'math',
        section: '1.6',
        members: ['clamp', 'lerp', 'degToRad', 'radToDeg', 'PI', 'TAU', ...nested('vec3', VEC3), ...nested('quat', QUAT), ...nested('mat4', MAT4), ...nested('mat3', MAT3), ...nested('aabb', AABB), ...nested('ray', RAY), ...nested('scalar', SCALAR), ...nested('noise', NOISE), ...nested('color', COLOR), ...nested('random', RANDOM)],
    },
    { name: 'props', section: '1.7', members: ['define', 'get', 'set', 'has', 'all', 'definitions', 'onChanged', 'reset', 'executionOrder'] },
    {
        name: 'scene',
        section: '2',
        members: ['root', 'sun', 'activeCamera', 'find', 'findAll', 'byId', 'byKind', 'byTag', 'traverse', 'traverseVisible', 'all', 'count', 'spawn', 'spawnPrimitive', 'clone', 'destroy', 'reparent', 'insert', 'remove', 'contains', 'instantiate', 'addComponent', 'removeComponent', 'rename', 'setVisible', 'path', 'addTag', 'removeTag', 'hasTag', 'getMeta', 'setMeta', 'isAttached', 'saveAsPrefab', 'instantiatePrefab', 'kinds', 'components'],
    },
    {
        name: 'transform',
        section: '2.5',
        members: ['position', 'rotation', 'scale', 'setPosition', 'setRotation', 'setScale', 'localMatrix', 'worldMatrix', 'updateLocalMatrix', 'worldPosition', 'worldRotation', 'worldRotationEuler', 'worldScale', 'setWorldPosition', 'setWorldRotation', 'setWorldMatrix', 'forward', 'back', 'right', 'left', 'up', 'down', 'translate', 'rotate', 'rotateAround', 'lookAt', 'setParentKeepWorld', 'localToWorld', 'worldToLocal', 'localToWorldDirection', 'worldToLocalDirection', 'bounds', 'distance', 'directionTo', 'reset'],
    },
    {
        name: 'mesh',
        section: '3',
        members: ['box', 'roundedBox', 'plane', 'sphere', 'cylinder', 'cone', 'torus', 'capsule', 'rock', 'denseSphere', 'torusKnot', 'flutedColumn', 'engravedTorus', 'create', 'clone', 'markDirty', 'version', 'vertexCount', 'triangleCount', 'computeNormals', 'computeBounds', 'flipWinding', 'merge', 'transform', 'translate', 'scale', 'raycast', 'simplify', 'fromModelAsset', 'toModelAsset', 'positions', 'normals', 'uvs', 'indices', 'forEachVertex', 'lod', 'myriad'],
    },
    { name: 'csg', section: '3.4', members: ['operations', 'makeTarget', 'makeBrush', 'rebuild', 'invalidate', 'stats', 'onRebuilt', 'collectBrushes', 'brushTarget', 'boolean', 'sourceMesh'] },
    { name: 'material', section: '4.1', members: ['create', 'clone', 'copy', 'set', 'hasAnyTexture', 'of', 'assign', 'own', 'setColor', 'setEmissive', 'setTexture', 'slots', 'fromShader', 'uniforms', 'generateNormalFromHeight', 'generateMaps', 'packOrm'] },
    { name: 'materials', section: '4.1', members: ['get', 'list', 'names', 'save', 'remove', 'rename', 'instantiate', 'apply', 'update', 'forMaterial', 'onChanged'] },
    { name: 'texture', section: '4.2', members: ['create', 'fromAsset', 'fromImage', 'fromPixels', 'setImage', 'touch', 'readPixels', 'canvas', 'isTexture'] },
    { name: 'light', section: '5', members: ['types', 'localTypes', 'create', 'clone', 'fromPreset', 'presets', 'spawn', 'set', 'convert', 'all', 'sun', 'ambient', 'syncSunToSky', 'driveSun', 'isLocal', 'effectiveRange', 'resolvedColor', 'temperatureToColor', 'setTemperature', 'setColor', 'cssColor', 'temperatureRange'] },
    {
        name: 'camera',
        section: '6',
        members: ['main', 'setMain', 'onMainChanged', 'position', 'target', 'forward', 'fov', 'near', 'far', 'exposure', 'aspect', 'setPose', 'lookAt', 'viewport', 'viewMatrix', 'projectionMatrix', 'viewProjectionMatrix', 'screenToRay', 'worldToScreen', 'pick', 'pickPoint', 'shake', 'shaking', 'fade', 'player', 'frame', 'mainForward', 'distanceTo'],
    },
    { name: 'sky', section: '7', members: ['settings', 'clouds', 'set', 'enabled', 'timeOfDay', 'cycleSpeed', 'driveSun', 'advance', 'syncSun', 'wrapTimeOfDay', 'formatTimeOfDay', 'sunDirection', 'moonDirection', 'isDay', 'moonPhaseName', 'moonLitFraction', 'hourAngle', 'presets', 'preset', 'onHourChanged', 'onSunrise', 'onSunset'] },
    { name: 'world', section: '7', members: ['wind', 'gravity', 'sky', 'player'] },
    {
        name: 'post',
        section: '8.1',
        members: [
            'settings',
            'set',
            'enabled',
            'exposure',
            'toneMapper',
            'toneMappers',
            'whiteBalance',
            'grading',
            'bloom',
            'depthOfField',
            'vignette',
            'chromaticAberration',
            'filmGrain',
            'lensDistortion',
            'sharpen',
            'presets',
            'applyPreset',
            'currentPreset',
            'assign',
            'create',
            'snapshot',
            'focusOn',
            'compareSplit',
            'tween',
            'custom',
            ...nested('custom', ['add', 'get', 'remove', 'list', 'clear']),
        ],
    },
    {
        name: 'render',
        section: '8.2',
        members: ['enabled', 'passes', 'passNames', 'showGrid', 'shadows', 'showCsgBrushes', 'lightHelpers', 'soundHelpers', 'vfxHelpers', 'culling', 'lod', 'myriad', 'terrainMaterialCache', 'profileGpu', 'renderOnDemand', 'pixelRatio', 'profile', 'setProfile', 'stats', 'frame', 'onBeforeFrame', 'onAfterFrame', 'onBeforePass', 'onAfterPass', 'custom', 'gl', 'canvas', 'capabilities', 'createProgram', 'createTexture', 'createRenderTarget', 'createMesh', 'fullscreenTriangle', 'shaders', 'skybox'],
    },
    {
        name: 'physics',
        section: '9',
        members: [
            'running', 'enabled', 'stats', 'fixedTimestep', 'interpolation', 'bodyCount', 'stepOnce', 'discardAccumulatedTime', 'onPreStep', 'addForceField', 'bodyOf', 'hasBody', 'bodies', 'entityOf', 'raycast', 'raycastAll', 'overlapAabb', 'overlapSphere', 'overlapBox', 'sweep', 'closestPoint', 'fitCollider', 'massProperties', 'colliderRequiresStatic', 'colliderVolume', 'physical', 'shapes', 'waterAt', 'layers', 'backend', 'onOutOfBounds', 'onUnstable', 'onCollisionBegin', 'onCollisionEnd', 'settings', 'set', 'gravity', 'quality', 'resetSettings',
            ...nested('joints', ['types', 'create', 'ball', 'hinge', 'slider', 'fixed', 'distance', 'coneTwist', 'wheel', 'remove', 'all', 'of', 'count', 'onBreak']),
            ...nested('forces', ['everywhere', 'sphere', 'box', 'directional', 'radial', 'vortex', 'drag', 'explode', 'remove']),
        ],
    },
    { name: 'character', section: '9.5', members: ['of', 'has', 'all', 'inputSource', 'inputFrame', 'settingsOf', 'spawn', 'findPossessable', 'controllerClass', 'onLanded', 'onJumped'] },
    { name: 'player', section: '9.5', members: ['settings', 'set', 'enabled', 'possessed', 'isPossessing', 'possess', 'unpossess', 'cameraControl', 'pointerLocked', 'transientCharacter', 'spawnPoint', 'onPossessed'] },
    {
        name: 'terrain',
        section: '10',
        members: ['all', 'first', 'of', 'spawn', 'presets', 'resolutions', 'heightAt', 'normalAt', 'contains', 'raycast', 'worldToGrid', 'gridToWorld', 'markDirty', 'generate', 'generateWith', 'fill', 'autoPaint', 'resize', 'brush', 'falloffs', 'tools', 'sculpt', 'erode', 'layers', 'addLayer', 'removeLayer', 'moveLayer', 'cloneLayer', 'paint', 'weightsAt', 'materials', 'water', 'grass', 'shadingOf', 'scatter', 'stitch', 'fromImage', 'onRegionChanged'],
    },
    {
        name: 'gui',
        section: '11',
        members: ['visible', 'interactive', 'hasFocusedInput', 'screens', 'show', 'hide', 'isShown', 'create', 'kinds', 'add', 'remove', 'find', 'setText', 'setVisible', 'setInteractable', 'setRect', 'setAppearance', 'setStyle', 'value', 'setValue', 'onEvent', 'onActivate', 'onChange', 'cursor', 'surfaces', 'domRoot', 'html', 'css', 'svg', 'element', 'elements', 'bind', 'onAction', 'clear', 'canvas2d', 'size', 'pointerEvents', 'templates', 'documents'],
    },
    {
        name: 'audio',
        section: '12',
        members: ['mixer', 'sources', 'zones', 'supported', 'status', 'context', 'stats', 'voiceCount', 'sampleRate', 'enabled', 'unlock', 'play', 'playOnce', 'loop', 'stopAll', 'activeVoices', 'preload', 'clipSettingsOf', 'createClipSettings', 'clips', 'busInput', 'analysis', 'synth', 'export', 'onEnded'],
    },
    {
        name: 'animation',
        section: '13',
        members: ['document', 'documentSync', 'clip', 'player', 'hasPlayer', 'play', 'pause', 'resume', 'togglePlay', 'stop', 'seek', 'setSpeed', 'setLoop', 'rest', 'onEvent', 'locomotion', 'rig', 'hasRig', 'rigged', 'roles', 'joint', 'jointByRole', 'jointWorld', 'attach', 'evaluate', 'ik', 'paths', 'create', 'setKey', 'addEvent', 'setDuration', 'save', 'playing'],
    },
    {
        name: 'vfx',
        section: '14',
        members: ['settings', 'has', 'attach', 'detach', 'setEffect', 'play', 'pause', 'resume', 'stop', 'restart', 'reset', 'state', 'isPlaying', 'alive', 'time', 'instance', 'burst', 'emitAt', 'setParam', 'stats', 'document', 'create', 'fromTemplate', 'templates', 'textures', 'moduleKinds', 'modules', 'shapes', 'renderModes', 'blendModes', 'addEmitter', 'removeEmitter', 'setEmitter', 'addModule', 'removeModule', 'setModule', 'set', 'toJson', 'fromJson', 'save', 'particles'],
    },
    {
        name: 'input',
        section: '15',
        members: ['isDown', 'wasPressed', 'wasReleased', 'keysDown', 'onKeyDown', 'onKeyUp', 'onTextInput', 'pointer', 'pointerLocked', 'lockPointer', 'unlockPointer', 'onPointerDown', 'onPointerUp', 'onPointerMove', 'onWheel', 'cursor', 'cursors', 'touches', 'gamepads', 'axis', 'button', 'rumble', 'onGamepadButtonDown', 'onGamepadButtonUp', 'actions', 'action', 'axis2d', 'characterFrame', 'capture', 'guiHasFocus', 'shortcuts'],
    },
    {
        name: 'assets',
        section: '16',
        members: ['kinds', 'get', 'byName', 'list', 'byTag', 'search', 'exists', 'tags', 'setTags', 'rename', 'remove', 'file', 'files', 'url', 'text', 'bytes', 'data', 'model', 'image', 'audio', 'animation', 'gui', 'vfx', 'script', 'font', 'video', 'import', 'pickFiles', 'thumbnail', 'onChange', 'count', 'busy', 'status'],
    },
    {
        name: 'project',
        section: '17',
        members: ['id', 'name', 'template', 'formatVersion', 'createdAt', 'openedAt', 'updatedAt', 'stats', 'info', 'rename', 'settings', 'serialize', 'save', 'autosave', 'snapshots', 'loadSnapshot', 'restore', 'snapshotNow', 'exportProject', 'download', 'importProject', 'pickFiles', 'quota', 'persisted', 'requestPersistence'],
    },
    { name: 'storage', section: '17.4', members: ['ready', 'slot', 'slots', 'session', 'name', 'get', 'has', 'set', 'remove', 'keys', 'clear', 'snapshot', 'export', 'import'] },
    { name: 'play', section: '18', members: ['state', 'isRunning', 'isPossessing', 'pointerLocked', 'timeScale', 'elapsed', 'standalone', 'play', 'pause', 'togglePlayPause', 'stop', 'stepOnce', 'setTimeScale', 'restart', 'reloadScene', 'onStarted', 'onPaused', 'onResumed', 'onStopped', 'export'] },
    {
        name: 'net',
        section: '18',
        members: [
            'isServer',
            'isClient',
            'mode',
            'connected',
            'connecting',
            'transport',
            'room',
            'tickRate',
            'latency',
            'localPlayer',
            'players',
            'player',
            'rpc',
            'call',
            'emit',
            'send',
            'broadcast',
            'on',
            'hasRpc',
            'rpcs',
            'state',
            'state.get',
            'state.set',
            'state.remove',
            'state.has',
            'state.keys',
            'state.snapshot',
            'state.onChanged',
            'replicate',
            'replicatedFields',
            'onReplicated',
            'authenticate',
            'kick',
            'onPlayerJoined',
            'onPlayerLeft',
            'onConnected',
            'onDisconnected',
            'onConnecting',
            'connect',
            'disconnect',
        ],
    },
    {
        name: 'editor',
        section: '19',
        editorOnly: true,
        members: ['selection', 'selected', 'select', 'toggleSelect', 'selectAll', 'clearSelection', 'onSelectionChanged', 'history', 'undo', 'redo', 'execute', 'beginGroup', 'endGroup', 'revision', 'panels', 'dialogs', 'settings', 'gizmo', 'viewport', 'code', 'console', 'tools', 'notify'],
    },
];
export const API_ROOT_MEMBERS: readonly string[] = ['context', 'isEditor', 'isPlaying', 'engine', 'self', 'script', 'ActorScript'];
export interface BridgeAudit {
    readonly missing: readonly string[];
    readonly total: number;
}
function hasPath(root: unknown, path: string): boolean {
    const parts = path.split('.');
    let current: unknown = root;
    for (let index = 0; index < parts.length; index++) {
        const part = parts[index];
        if (current === null || (typeof current !== 'object' && typeof current !== 'function'))
            return false;
        if (!(part in (current as object)))
            return false;
        if (index === parts.length - 1)
            return true;
        try {
            current = (current as Record<string, unknown>)[part];
        }
        catch {
            return false;
        }
    }
    return true;
}
export function auditBridge(helix: Record<string, unknown>, options: {
    editor: boolean;
}): BridgeAudit {
    const missing: string[] = [];
    let total = 0;
    for (const member of API_ROOT_MEMBERS) {
        total++;
        if (!(member in helix))
            missing.push(member);
    }
    for (const namespace of API_MANIFEST) {
        if (namespace.editorOnly && !options.editor)
            continue;
        const target = helix[namespace.name];
        for (const member of namespace.members) {
            total++;
            if (!hasPath(target, member))
                missing.push(`${namespace.name}.${member}`);
        }
    }
    return { missing, total };
}
