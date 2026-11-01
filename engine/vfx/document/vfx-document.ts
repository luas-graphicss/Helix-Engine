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
