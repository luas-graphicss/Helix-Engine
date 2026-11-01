import { bellCurve, colorConstant, constantCurve, fadeInOutGradient, linearCurve, scalarConstant, scalarRandom, type VfxColorValue, type VfxCurve, type VfxGradient, type VfxRgb, type VfxScalar, } from './vfx-curves';
export const VFX_EXTENSION = 'hxvfx';
export const VFX_FORMAT_VERSION = 1;
export const VFX_MIME_TYPE = 'application/vnd.helix.vfx+json';
export const VFX_MAX_PARTICLES_PER_EMITTER = 20000;
export const VFX_MAX_EMITTERS = 16;
export const VFX_MAX_DURATION = 120;
export type VfxShapeKind = 'point' | 'sphere' | 'hemisphere' | 'cone' | 'box' | 'circle' | 'edge';
export type VfxEmitFrom = 'volume' | 'surface' | 'edge';
export type VfxSimulationSpace = 'local' | 'world';
export type VfxRenderMode = 'billboard' | 'stretched' | 'horizontal' | 'vertical';
export type VfxBlendMode = 'alpha' | 'additive' | 'premultiplied' | 'multiply';
export type VfxSortMode = 'none' | 'distance' | 'oldest' | 'youngest';
export type VfxLighting = 'unlit' | 'lit';
export const VFX_SHAPE_KINDS: readonly VfxShapeKind[] = ['point', 'sphere', 'hemisphere', 'cone', 'box', 'circle', 'edge'];
export const VFX_SHAPE_LABEL: Record<VfxShapeKind, string> = {
    point: 'Ponto',
    sphere: 'Esfera',
    hemisphere: 'Hemisfério',
    cone: 'Cone',
    box: 'Caixa',
    circle: 'Círculo',
    edge: 'Linha',
};
export const VFX_SHAPE_DESCRIPTION: Record<VfxShapeKind, string> = {
    point: 'Todas as partículas nascem no centro e saem em todas as direções',
    sphere: 'Nascem dentro (ou na casca) de uma esfera, afastando-se do centro',
    hemisphere: 'Metade superior da esfera: fontes, chafarizes e explosões no chão',
    cone: 'Jato com abertura em graus: fogo, propulsores, respingos',
    box: 'Volume retangular: chuva, neve e poeira em áreas',
    circle: 'Disco horizontal: anéis de impacto, portais e auras',
    edge: 'Segmento de reta: cortinas, cascatas e lasers',
};
export const VFX_EMIT_FROM_LABEL: Record<VfxEmitFrom, string> = { volume: 'Volume', surface: 'Superfície', edge: 'Borda' };
export const VFX_SPACE_LABEL: Record<VfxSimulationSpace, string> = { local: 'Local (segue o ator)', world: 'Mundo (fica para trás)' };
export const VFX_RENDER_MODES: readonly VfxRenderMode[] = ['billboard', 'stretched', 'horizontal', 'vertical'];
export const VFX_RENDER_MODE_LABEL: Record<VfxRenderMode, string> = {
    billboard: 'Placa (encara a câmera)',
    stretched: 'Esticada pela velocidade',
    horizontal: 'Deitada (plano do chão)',
    vertical: 'Em pé (gira só no eixo Y)',
};
export const VFX_BLEND_MODES: readonly VfxBlendMode[] = ['alpha', 'additive', 'premultiplied', 'multiply'];
export const VFX_BLEND_LABEL: Record<VfxBlendMode, string> = {
    alpha: 'Transparente',
    additive: 'Aditivo (brilho)',
    premultiplied: 'Pré-multiplicado',
    multiply: 'Multiplicar (escurece)',
};
export const VFX_BLEND_DESCRIPTION: Record<VfxBlendMode, string> = {
    alpha: 'Cobre o fundo: fumaça, poeira, folhas',
    additive: 'Soma luz ao fundo: fogo, faíscas, magia, brilhos',
    premultiplied: 'Mistura que vira aditiva onde o alfa é baixo: fogo com fumaça na mesma textura',
    multiply: 'Escurece o fundo: sombras, tinta, fuligem',
};
export const VFX_SORT_LABEL: Record<VfxSortMode, string> = {
    none: 'Sem ordenação',
    distance: 'Por distância (de trás para a frente)',
    oldest: 'Mais velhas na frente',
    youngest: 'Mais novas na frente',
};
export const VFX_LIGHTING_LABEL: Record<VfxLighting, string> = { unlit: 'Emissiva (sem iluminação)', lit: 'Iluminada pela cena' };
export type VfxBuiltinTextureId = 'soft' | 'circle' | 'ring' | 'spark' | 'star' | 'smoke' | 'flare' | 'square' | 'cross' | 'drop' | 'shard' | 'bokeh' | 'noise';
export type VfxTextureRef = {
    readonly kind: 'builtin';
    readonly id: VfxBuiltinTextureId;
} | {
    readonly kind: 'asset';
    readonly assetId: string;
};
export interface VfxFlipbook {
    readonly columns: number;
    readonly rows: number;
    readonly fps: number;
    readonly loop: boolean;
    readonly randomStart: boolean;
}
export interface VfxBurst {
    readonly id: string;
    readonly time: number;
    readonly count: number;
    readonly countMax: number;
    readonly cycles: number;
    readonly interval: number;
    readonly probability: number;
}
export interface VfxShape {
    readonly kind: VfxShapeKind;
    readonly radius: number;
    readonly thickness: number;
    readonly angle: number;
    readonly length: number;
    readonly size: readonly [
        number,
        number,
        number
    ];
    readonly arc: number;
    readonly emitFrom: VfxEmitFrom;
    readonly randomizeDirection: number;
    readonly spherizeDirection: number;
    readonly offset: readonly [
        number,
        number,
        number
    ];
    readonly rotation: readonly [
        number,
        number,
        number
    ];
    readonly scale: readonly [
        number,
        number,
        number
    ];
}
export interface VfxSpawn {
    readonly rate: VfxScalar;
    readonly rateOverDistance: number;
    readonly bursts: readonly VfxBurst[];
}
export interface VfxInitial {
    readonly lifetime: VfxScalar;
    readonly speed: VfxScalar;
    readonly size: VfxScalar;
    readonly aspect: number;
    readonly rotation: VfxScalar;
    readonly angularVelocity: VfxScalar;
    readonly color: VfxColorValue;
    readonly inheritVelocity: number;
}
export type VfxModule = {
    readonly kind: 'sizeOverLife';
    readonly id: string;
    readonly enabled: boolean;
    readonly curve: VfxCurve;
    readonly separateAxes: boolean;
    readonly curveY: VfxCurve;
} | {
    readonly kind: 'colorOverLife';
    readonly id: string;
    readonly enabled: boolean;
    readonly gradient: VfxGradient;
} | {
    readonly kind: 'velocityOverLife';
    readonly id: string;
    readonly enabled: boolean;
    readonly speedCurve: VfxCurve;
    readonly linear: readonly [
        number,
        number,
        number
    ];
    readonly space: VfxSimulationSpace;
} | {
    readonly kind: 'limitVelocity';
    readonly id: string;
    readonly enabled: boolean;
    readonly speed: number;
    readonly dampen: number;
} | {
    readonly kind: 'gravity';
    readonly id: string;
    readonly enabled: boolean;
    readonly scale: number;
} | {
    readonly kind: 'force';
    readonly id: string;
    readonly enabled: boolean;
    readonly force: readonly [
        number,
        number,
        number
    ];
    readonly randomize: number;
    readonly space: VfxSimulationSpace;
} | {
    readonly kind: 'drag';
    readonly id: string;
    readonly enabled: boolean;
    readonly coefficient: number;
    readonly curve: VfxCurve;
} | {
    readonly kind: 'noise';
    readonly id: string;
    readonly enabled: boolean;
    readonly strength: number;
    readonly frequency: number;
    readonly scrollSpeed: number;
    readonly octaves: number;
    readonly curve: VfxCurve;
} | {
    readonly kind: 'vortex';
    readonly id: string;
    readonly enabled: boolean;
    readonly axis: readonly [
        number,
        number,
        number
    ];
    readonly strength: number;
    readonly pull: number;
} | {
    readonly kind: 'attractor';
    readonly id: string;
    readonly enabled: boolean;
    readonly position: readonly [
        number,
        number,
        number
    ];
    readonly strength: number;
    readonly radius: number;
    readonly kill: boolean;
} | {
    readonly kind: 'orbit';
    readonly id: string;
    readonly enabled: boolean;
    readonly speed: number;
    readonly radial: number;
    readonly axis: readonly [
        number,
        number,
        number
    ];
} | {
    readonly kind: 'rotationOverLife';
    readonly id: string;
    readonly enabled: boolean;
    readonly curve: VfxCurve;
    readonly alignToVelocity: boolean;
} | {
    readonly kind: 'collision';
    readonly id: string;
    readonly enabled: boolean;
    readonly planeHeight: number;
    readonly bounce: number;
    readonly friction: number;
    readonly lifetimeLoss: number;
    readonly killOnCollide: boolean;
} | {
    readonly kind: 'sizeBySpeed';
    readonly id: string;
    readonly enabled: boolean;
    readonly curve: VfxCurve;
    readonly speedMin: number;
    readonly speedMax: number;
} | {
    readonly kind: 'colorBySpeed';
    readonly id: string;
    readonly enabled: boolean;
    readonly gradient: VfxGradient;
    readonly speedMin: number;
    readonly speedMax: number;
};
export type VfxModuleKind = VfxModule['kind'];
export type VfxModuleOf<K extends VfxModuleKind> = Extract<VfxModule, {
    kind: K;
}>;
export type VfxModuleCategory = 'appearance' | 'motion' | 'forces' | 'world';
export interface VfxModuleInfo {
    readonly kind: VfxModuleKind;
    readonly label: string;
    readonly description: string;
    readonly category: VfxModuleCategory;
}
export const VFX_MODULE_CATEGORY_LABEL: Record<VfxModuleCategory, string> = {
    appearance: 'Aparência',
    motion: 'Movimento',
    forces: 'Forças',
    world: 'Mundo',
};
export const VFX_MODULE_CATALOG: readonly VfxModuleInfo[] = [
    { kind: 'sizeOverLife', label: 'Tamanho na vida', description: 'Cresce ou encolhe a partícula ao longo da vida com uma curva', category: 'appearance' },
    { kind: 'colorOverLife', label: 'Cor na vida', description: 'Multiplica a cor inicial por um gradiente: nasce de uma cor, morre em outra', category: 'appearance' },
    { kind: 'rotationOverLife', label: 'Rotação na vida', description: 'Velocidade de giro ao longo da vida, ou alinhar a imagem à direção do movimento', category: 'appearance' },
    { kind: 'sizeBySpeed', label: 'Tamanho pela velocidade', description: 'Partículas rápidas maiores (ou menores) do que as lentas', category: 'appearance' },
    { kind: 'colorBySpeed', label: 'Cor pela velocidade', description: 'Gradiente lido da velocidade: faísca quente ao sair, fria ao parar', category: 'appearance' },
    { kind: 'velocityOverLife', label: 'Velocidade na vida', description: 'Acelera ou freia a velocidade inicial com uma curva e soma uma deriva constante', category: 'motion' },
    { kind: 'limitVelocity', label: 'Limitar velocidade', description: 'Freia o que passa de uma velocidade máxima: faíscas que param no ar', category: 'motion' },
    { kind: 'orbit', label: 'Órbita', description: 'Gira as partículas em torno do emissor, com atração ou repulsão radial', category: 'motion' },
    { kind: 'gravity', label: 'Gravidade', description: 'Puxa para baixo com a gravidade da cena, escalada (negativo flutua)', category: 'forces' },
    { kind: 'force', label: 'Força constante', description: 'Vento ou empurrão numa direção, com variação por partícula', category: 'forces' },
    { kind: 'drag', label: 'Arrasto', description: 'Resistência do ar: tira velocidade proporcionalmente à rapidez', category: 'forces' },
    { kind: 'noise', label: 'Turbulência', description: 'Campo de ruído que agita o caminho: fumaça viva, vagalumes, cinzas', category: 'forces' },
    { kind: 'vortex', label: 'Vórtice', description: 'Redemoinho em torno de um eixo, com sucção para o centro', category: 'forces' },
    { kind: 'attractor', label: 'Atrator', description: 'Ponto que puxa (ou repele) as partículas; pode matá-las ao chegar', category: 'forces' },
    { kind: 'collision', label: 'Colisão com o chão', description: 'Quica num plano horizontal, com atrito e perda de vida', category: 'world' },
];
export function vfxModuleInfo(kind: VfxModuleKind): VfxModuleInfo {
    const info = VFX_MODULE_CATALOG.find((candidate) => candidate.kind === kind);
    if (!info)
        throw new Error(`Módulo de efeito desconhecido: ${kind}.`);
    return info;
}
export interface VfxRenderer {
    readonly mode: VfxRenderMode;
    readonly blend: VfxBlendMode;
    readonly texture: VfxTextureRef;
    readonly flipbook: VfxFlipbook | null;
    readonly sort: VfxSortMode;
    readonly lighting: VfxLighting;
    readonly intensity: number;
    readonly softness: number;
    readonly stretch: number;
    readonly stretchMinimum: number;
    readonly pivot: readonly [
        number,
        number
    ];
    readonly fadeNearCamera: number;
    readonly alphaCutoff: number;
}
export interface VfxEmitter {
    readonly id: string;
    readonly name: string;
    readonly enabled: boolean;
    readonly delay: number;
    readonly duration: number;
    readonly loop: boolean;
    readonly maxParticles: number;
    readonly space: VfxSimulationSpace;
    readonly spawn: VfxSpawn;
    readonly shape: VfxShape;
    readonly initial: VfxInitial;
    readonly modules: readonly VfxModule[];
    readonly renderer: VfxRenderer;
    readonly tint: VfxRgb;
}
export interface VfxDocument {
    readonly version: typeof VFX_FORMAT_VERSION;
    readonly name: string;
    readonly createdAt: number;
    readonly duration: number;
    readonly loop: boolean;
    readonly prewarm: number;
    readonly scale: number;
    readonly cullRadius: number;
    readonly emitters: readonly VfxEmitter[];
}
let idCounter = 0;
export function allocateVfxId(prefix = 'e'): string {
    idCounter++;
    const random = Math.random().toString(36).slice(2, 7);
    return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}${random}`;
}
export const VFX_DEFAULT_TEXTURE: VfxTextureRef = { kind: 'builtin', id: 'soft' };
export function createFlipbook(patch: Partial<VfxFlipbook> = {}): VfxFlipbook {
    return { columns: 4, rows: 4, fps: 0, loop: false, randomStart: false, ...patch };
}
export function createBurst(patch: Partial<Omit<VfxBurst, 'id'>> = {}): VfxBurst {
    return { id: allocateVfxId('b'), time: 0, count: 20, countMax: 0, cycles: 1, interval: 0.5, probability: 1, ...patch };
}
export function createShape(patch: Partial<VfxShape> = {}): VfxShape {
    return {
        kind: 'cone',
        radius: 0.25,
        thickness: 1,
        angle: 20,
        length: 1,
        size: [1, 1, 1],
        arc: 360,
        emitFrom: 'volume',
        randomizeDirection: 0,
        spherizeDirection: 0,
        offset: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        ...patch,
    };
}
export function createSpawn(patch: Partial<VfxSpawn> = {}): VfxSpawn {
    return { rate: scalarConstant(20), rateOverDistance: 0, bursts: [], ...patch };
}
export function createInitial(patch: Partial<VfxInitial> = {}): VfxInitial {
    return {
        lifetime: scalarRandom(1, 2),
        speed: scalarRandom(1, 2),
        size: scalarRandom(0.2, 0.4),
        aspect: 1,
        rotation: scalarRandom(0, 360),
        angularVelocity: scalarConstant(0),
        color: colorConstant([1, 1, 1], 1),
        inheritVelocity: 0,
        ...patch,
    };
}
export function createRenderer(patch: Partial<VfxRenderer> = {}): VfxRenderer {
    return {
        mode: 'billboard',
        blend: 'alpha',
        texture: VFX_DEFAULT_TEXTURE,
        flipbook: null,
        sort: 'none',
        lighting: 'unlit',
        intensity: 1,
        softness: 0.5,
        stretch: 0.1,
        stretchMinimum: 1,
        pivot: [0.5, 0.5],
        fadeNearCamera: 0,
        alphaCutoff: 0,
        ...patch,
    };
}
export function createModule<K extends VfxModuleKind>(kind: K, id = allocateVfxId('m')): VfxModuleOf<K> {
    return createModuleOfKind(kind, id) as VfxModuleOf<K>;
}
function createModuleOfKind(kind: VfxModuleKind, id: string): VfxModule {
    switch (kind) {
        case 'sizeOverLife':
            return { kind, id, enabled: true, curve: linearCurve(1, 0), separateAxes: false, curveY: linearCurve(1, 0) };
        case 'colorOverLife':
            return { kind, id, enabled: true, gradient: fadeInOutGradient([1, 1, 1], 1, 0.1, 0.6) };
        case 'velocityOverLife':
            return { kind, id, enabled: true, speedCurve: linearCurve(1, 0.2), linear: [0, 0, 0], space: 'local' };
        case 'limitVelocity':
            return { kind, id, enabled: true, speed: 1, dampen: 0.5 };
        case 'gravity':
            return { kind, id, enabled: true, scale: 1 };
        case 'force':
            return { kind, id, enabled: true, force: [1, 0, 0], randomize: 0, space: 'world' };
        case 'drag':
            return { kind, id, enabled: true, coefficient: 1, curve: constantCurve(1) };
        case 'noise':
            return { kind, id, enabled: true, strength: 1, frequency: 0.5, scrollSpeed: 0.5, octaves: 1, curve: constantCurve(1) };
        case 'vortex':
            return { kind, id, enabled: true, axis: [0, 1, 0], strength: 2, pull: 0.5 };
        case 'attractor':
            return { kind, id, enabled: true, position: [0, 2, 0], strength: 4, radius: 0.2, kill: false };
        case 'orbit':
            return { kind, id, enabled: true, speed: 2, radial: 0, axis: [0, 1, 0] };
        case 'rotationOverLife':
            return { kind, id, enabled: true, curve: constantCurve(90), alignToVelocity: false };
        case 'collision':
            return { kind, id, enabled: true, planeHeight: 0, bounce: 0.4, friction: 0.3, lifetimeLoss: 0, killOnCollide: false };
        case 'sizeBySpeed':
            return { kind, id, enabled: true, curve: linearCurve(0.5, 1.5), speedMin: 0, speedMax: 5 };
        case 'colorBySpeed':
            return { kind, id, enabled: true, gradient: { colors: [{ t: 0, color: [0.2, 0.4, 1] }, { t: 1, color: [1, 0.9, 0.5] }], alphas: [{ t: 0, alpha: 1 }] }, speedMin: 0, speedMax: 5 };
    }
}
export const VFX_EMITTER_TINTS: readonly VfxRgb[] = [
    [0.98, 0.62, 0.12],
    [0.36, 0.72, 1],
    [0.62, 0.86, 0.36],
    [0.92, 0.42, 0.62],
    [0.68, 0.56, 0.98],
    [0.3, 0.86, 0.78],
    [0.98, 0.82, 0.32],
    [0.86, 0.5, 0.36],
];
export function createEmitter(patch: Partial<Omit<VfxEmitter, 'id'>> = {}, id = allocateVfxId('e')): VfxEmitter {
    return {
        id,
        name: 'Emissor',
        enabled: true,
        delay: 0,
        duration: 0,
        loop: true,
        maxParticles: 500,
        space: 'local',
        spawn: createSpawn(),
        shape: createShape(),
        initial: createInitial(),
        modules: [
            { ...createModule('sizeOverLife'), curve: bellCurve(0.2, 1, 0.3) },
            { ...createModule('colorOverLife'), gradient: fadeInOutGradient([1, 1, 1], 1, 0.1, 0.6) },
        ],
        renderer: createRenderer(),
        tint: VFX_EMITTER_TINTS[0],
        ...patch,
    };
}
export function createVfxDocument(patch: Partial<Omit<VfxDocument, 'version'>> = {}): VfxDocument {
    return {
        version: VFX_FORMAT_VERSION,
        name: 'Efeito',
        createdAt: Date.now(),
        duration: 2,
        loop: true,
        prewarm: 0,
        scale: 1,
        cullRadius: 0,
        emitters: [],
        ...patch,
    };
}
export function emitterDuration(document: VfxDocument, emitter: VfxEmitter): number {
    const available = Math.max(0, document.duration - emitter.delay);
    return emitter.duration > 0 ? Math.min(emitter.duration, available) : available;
}
export function vfxParticleBudget(document: VfxDocument): number {
    return document.emitters.reduce((total, emitter) => total + (emitter.enabled ? emitter.maxParticles : 0), 0);
}
export function vfxReferencedTextures(document: VfxDocument): string[] {
    const ids = new Set<string>();
    for (const emitter of document.emitters) {
        if (emitter.renderer.texture.kind === 'asset')
            ids.add(emitter.renderer.texture.assetId);
    }
    return [...ids];
}
