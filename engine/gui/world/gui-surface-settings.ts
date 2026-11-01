import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { defaultVideoControl, defaultViewportControl, type GuiVideoControl, type GuiViewportControl } from '@/engine/gui/document/gui-document';
export interface GuiSurfaceScreenContent {
    readonly kind: 'screen';
    readonly assetId: string | null;
}
export interface GuiSurfaceVideoContent {
    readonly kind: 'video';
    readonly video: GuiVideoControl;
}
export interface GuiSurfaceViewContent {
    readonly kind: 'view';
    readonly view: GuiViewportControl;
}
export type GuiSurfaceContent = GuiSurfaceScreenContent | GuiSurfaceVideoContent | GuiSurfaceViewContent;
export type GuiSurfaceContentKind = GuiSurfaceContent['kind'];
export type GuiSurfaceFace = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom';
export const GUI_SURFACE_FACES: readonly GuiSurfaceFace[] = ['front', 'back', 'left', 'right', 'top', 'bottom'];
export interface GuiSurfaceFaceMount {
    readonly kind: 'face';
    readonly face: GuiSurfaceFace;
    readonly offset: number;
    readonly inset: number;
}
export interface GuiSurfacePanelMount {
    readonly kind: 'panel';
    readonly position: Vec3;
    readonly rotation: Vec3;
    readonly width: number;
    readonly height: number;
}
export interface GuiSurfaceBillboardMount {
    readonly kind: 'billboard';
    readonly offset: Vec3;
    readonly width: number;
    readonly height: number;
    readonly lockY: boolean;
    readonly constantSize: boolean;
}
export type GuiSurfaceMount = GuiSurfaceFaceMount | GuiSurfacePanelMount | GuiSurfaceBillboardMount;
export type GuiSurfaceMountKind = GuiSurfaceMount['kind'];
export type GuiSurfaceShading = 'lit' | 'screen' | 'overlay';
export type GuiSurfaceBlend = 'opaque' | 'cutout' | 'transparent';
export interface GuiSurfaceSettings {
    readonly version: 1;
    readonly content: GuiSurfaceContent;
    readonly mount: GuiSurfaceMount;
    readonly pixelsPerMeter: number;
    readonly shading: GuiSurfaceShading;
    readonly brightness: number;
    readonly blend: GuiSurfaceBlend;
    readonly opacity: number;
    readonly doubleSided: boolean;
    readonly backdropColor: string;
    readonly backdropAlpha: number;
    readonly interactive: boolean;
    readonly interactionDistance: number;
    readonly frameRate: number;
    readonly alwaysOnTop: boolean;
    readonly cullDistance: number;
    readonly spatialAudio: boolean;
    readonly audioRange: number;
}
export const SURFACE_PIXELS_PER_METER_MIN = 32;
export const SURFACE_PIXELS_PER_METER_MAX = 1024;
export const SURFACE_MAX_TEXTURE_SIDE = 2048;
export const SURFACE_MIN_TEXTURE_SIDE = 8;
export const SURFACE_BRIGHTNESS_MAX = 8;
export const SURFACE_SIZE_MIN = 0.01;
export const SURFACE_SIZE_MAX = 500;
export const SURFACE_INSET_MAX = 0.45;
export const SURFACE_OFFSET_MAX = 5;
export const SURFACE_DISTANCE_MAX = 2000;
export const SURFACE_FRAME_RATE_MAX = 120;
export const SURFACE_DEFAULT_FACE_OFFSET = 0.002;
export const GUI_SURFACE_FACE_LABEL: Record<GuiSurfaceFace, string> = {
    front: 'Frente',
    back: 'Trás',
    left: 'Esquerda',
    right: 'Direita',
    top: 'Topo',
    bottom: 'Base',
};
export const GUI_SURFACE_MOUNT_LABEL: Record<GuiSurfaceMountKind, string> = {
    face: 'Colada na face',
    panel: 'Painel livre',
    billboard: 'Placa que encara a câmera',
};
export const GUI_SURFACE_MOUNT_DESCRIPTION: Record<GuiSurfaceMountKind, string> = {
    face: 'Preenche uma face da caixa do ator e acompanha a malha: monitor numa TV, pôster na parede, mostrador num painel.',
    panel: 'Retângulo com posição, rotação e tamanho próprios no espaço do ator: holograma, telão, janela flutuante.',
    billboard: 'Gira para encarar a câmera a partir de um ponto do ator: nome e vida sobre a cabeça, marcador, legenda.',
};
export const GUI_SURFACE_SHADING_LABEL: Record<GuiSurfaceShading, string> = {
    lit: 'Material',
    screen: 'Tela emissiva',
    overlay: 'Sobreposta',
};
export const GUI_SURFACE_SHADING_DESCRIPTION: Record<GuiSurfaceShading, string> = {
    lit: 'Recebe luz, sombra e névoa como qualquer material: pôster, placa pintada, mapa na mesa.',
    screen: 'Emite a própria luz com as cores exatas da tela; brilho acima de 1 ganha bloom: monitor, neon, holograma.',
    overlay: 'Desenhada por cima da imagem final, nítida e sem iluminação: nomes, marcadores, interface de jogo no mundo.',
};
export const GUI_SURFACE_BLEND_LABEL: Record<GuiSurfaceBlend, string> = {
    opaque: 'Opaca',
    cutout: 'Recorte',
    transparent: 'Transparente',
};
export const GUI_SURFACE_CONTENT_LABEL: Record<GuiSurfaceContentKind, string> = {
    screen: 'Tela',
    video: 'Vídeo',
    view: 'Visão 3D',
};
export function createFaceMount(options: Partial<Omit<GuiSurfaceFaceMount, 'kind'>> = {}): GuiSurfaceFaceMount {
    return { kind: 'face', face: options.face ?? 'front', offset: options.offset ?? SURFACE_DEFAULT_FACE_OFFSET, inset: options.inset ?? 0 };
}
export function createPanelMount(options: Partial<Omit<GuiSurfacePanelMount, 'kind'>> = {}): GuiSurfacePanelMount {
    return {
        kind: 'panel',
        position: options.position ? vec3.copy(vec3.create(), options.position) : vec3.create(),
        rotation: options.rotation ? vec3.copy(vec3.create(), options.rotation) : vec3.create(),
        width: options.width ?? 1.6,
        height: options.height ?? 0.9,
    };
}
export function createBillboardMount(options: Partial<Omit<GuiSurfaceBillboardMount, 'kind'>> = {}): GuiSurfaceBillboardMount {
    return {
        kind: 'billboard',
        offset: options.offset ? vec3.copy(vec3.create(), options.offset) : vec3.create(0, 1.2, 0),
        width: options.width ?? 1.2,
        height: options.height ?? 0.3,
        lockY: options.lockY ?? false,
        constantSize: options.constantSize ?? true,
    };
}
export function cloneGuiSurfaceMount(mount: GuiSurfaceMount): GuiSurfaceMount {
    switch (mount.kind) {
        case 'face':
            return { ...mount };
        case 'panel':
            return { ...mount, position: vec3.copy(vec3.create(), mount.position), rotation: vec3.copy(vec3.create(), mount.rotation) };
        case 'billboard':
            return { ...mount, offset: vec3.copy(vec3.create(), mount.offset) };
    }
}
export function createScreenContent(assetId: string | null = null): GuiSurfaceScreenContent {
    return { kind: 'screen', assetId };
}
export function createVideoContent(assetId: string | null = null, overrides: Partial<GuiVideoControl> = {}): GuiSurfaceVideoContent {
    return { kind: 'video', video: { ...defaultVideoControl(assetId), fit: 'cover', ...overrides } };
}
export function createViewContent(overrides: Partial<GuiViewportControl> = {}): GuiSurfaceViewContent {
    return { kind: 'view', view: { ...defaultViewportControl(), ...overrides } };
}
export function createGuiSurfaceSettings(options: Partial<GuiSurfaceSettings> = {}): GuiSurfaceSettings {
    return {
        version: 1,
        content: options.content ?? createScreenContent(),
        mount: options.mount ?? createFaceMount(),
        pixelsPerMeter: options.pixelsPerMeter ?? 320,
        shading: options.shading ?? 'screen',
        brightness: options.brightness ?? 1,
        blend: options.blend ?? 'transparent',
        opacity: options.opacity ?? 1,
        doubleSided: options.doubleSided ?? false,
        backdropColor: options.backdropColor ?? '#000000',
        backdropAlpha: options.backdropAlpha ?? 0,
        interactive: options.interactive ?? true,
        interactionDistance: options.interactionDistance ?? 0,
        frameRate: options.frameRate ?? 0,
        alwaysOnTop: options.alwaysOnTop ?? false,
        cullDistance: options.cullDistance ?? 0,
        spatialAudio: options.spatialAudio ?? true,
        audioRange: options.audioRange ?? 25,
    };
}
export function cloneGuiSurfaceSettings(settings: GuiSurfaceSettings): GuiSurfaceSettings {
    return { ...settings, mount: cloneGuiSurfaceMount(settings.mount) };
}
export function guiSurfaceAssetId(content: GuiSurfaceContent): string | null {
    switch (content.kind) {
        case 'screen':
            return content.assetId;
        case 'video':
            return content.video.assetId;
        case 'view':
            return null;
    }
}
export function guiSurfaceMountAspect(mount: GuiSurfaceMount): number | null {
    if (mount.kind === 'face')
        return null;
    return mount.height > 0 ? mount.width / mount.height : null;
}
export function convertGuiSurfaceContent(current: GuiSurfaceContent, kind: GuiSurfaceContentKind): GuiSurfaceContent {
    if (current.kind === kind)
        return current;
    switch (kind) {
        case 'screen':
            return createScreenContent();
        case 'video':
            return createVideoContent();
        case 'view':
            return createViewContent();
    }
}
export function convertGuiSurfaceMount(current: GuiSurfaceMount, kind: GuiSurfaceMountKind): GuiSurfaceMount {
    if (current.kind === kind)
        return current;
    const size = current.kind === 'face' ? null : { width: current.width, height: current.height };
    switch (kind) {
        case 'face':
            return createFaceMount();
        case 'panel':
            return createPanelMount(size ?? {});
        case 'billboard':
            return createBillboardMount(size ? { ...size, offset: current.kind === 'panel' ? current.position : undefined } : {});
    }
}
export function surfaceAudioGain(settings: GuiSurfaceSettings, distance: number): number {
    if (!settings.spatialAudio)
        return 1;
    const range = Math.max(settings.audioRange, 0.1);
    const full = range * 0.25;
    if (distance <= full)
        return 1;
    if (distance >= range)
        return 0;
    const t = (distance - full) / (range - full);
    return 1 - t * t * (3 - 2 * t);
}
export interface GuiSurfacePreset {
    readonly id: string;
    readonly label: string;
    readonly description: string;
    readonly actorName: string;
    readonly apply: (current: GuiSurfaceSettings | null) => GuiSurfaceSettings;
}
function keepAsset(current: GuiSurfaceSettings | null, content: GuiSurfaceContent): GuiSurfaceContent {
    if (!current || current.content.kind !== content.kind)
        return content;
    switch (content.kind) {
        case 'screen':
            return { ...content, assetId: (current.content as GuiSurfaceScreenContent).assetId };
        case 'video':
            return { ...content, video: { ...content.video, assetId: (current.content as GuiSurfaceVideoContent).video.assetId } };
        case 'view':
            return content;
    }
}
export const GUI_SURFACE_PRESETS: readonly GuiSurfacePreset[] = [
    {
        id: 'screen-panel',
        label: 'Tela no mundo',
        description: 'Uma tela .hxgui num painel em pé, emissiva e interativa: menu num quiosque, janela flutuante, placar.',
        actorName: 'TelaNoMundo',
        apply: (current) => createGuiSurfaceSettings({
            content: keepAsset(current, createScreenContent()),
            mount: createPanelMount({ width: 1.6, height: 0.9 }),
            shading: 'screen',
            blend: 'transparent',
            interactive: true,
        }),
    },
    {
        id: 'tv',
        label: 'Telão / TV',
        description: 'Vídeo na face da frente do ator, opaco e brilhante, com som que cai com a distância.',
        actorName: 'Telao',
        apply: (current) => createGuiSurfaceSettings({
            content: keepAsset(current, createVideoContent(null, { fit: 'cover', loop: true, muted: false, volume: 0.8 })),
            mount: current?.mount.kind === 'face' ? current.mount : createFaceMount(),
            shading: 'screen',
            brightness: 1.15,
            blend: 'opaque',
            backdropColor: '#000000',
            backdropAlpha: 1,
            interactive: false,
            spatialAudio: true,
            audioRange: 30,
        }),
    },
    {
        id: 'poster',
        label: 'Pôster / Placa',
        description: 'Tela colada na face como material do mundo: recebe luz, sombra e névoa, sem brilho próprio.',
        actorName: 'Poster',
        apply: (current) => createGuiSurfaceSettings({
            content: keepAsset(current, createScreenContent()),
            mount: current?.mount.kind === 'face' ? current.mount : createFaceMount(),
            shading: 'lit',
            blend: 'cutout',
            backdropColor: '#f2eee6',
            backdropAlpha: 1,
            interactive: false,
        }),
    },
    {
        id: 'hologram',
        label: 'Holograma',
        description: 'Painel translúcido, brilhante e visível dos dois lados; a tela flutua sem fundo.',
        actorName: 'Holograma',
        apply: (current) => createGuiSurfaceSettings({
            content: keepAsset(current, createScreenContent()),
            mount: current?.mount.kind === 'panel' ? current.mount : createPanelMount({ width: 1.2, height: 1.2 }),
            shading: 'screen',
            brightness: 1.6,
            blend: 'transparent',
            opacity: 0.9,
            doubleSided: true,
            backdropAlpha: 0,
            interactive: true,
        }),
    },
    {
        id: 'nameplate',
        label: 'Placa flutuante',
        description: 'Encara a câmera acima do ator, sempre do mesmo tamanho na tela e visível através das paredes: nome, vida, marcador.',
        actorName: 'Placa',
        apply: (current) => createGuiSurfaceSettings({
            content: keepAsset(current, createScreenContent()),
            mount: createBillboardMount({ offset: vec3.create(0, 1.2, 0), width: 1.6, height: 0.4, lockY: false, constantSize: true }),
            shading: 'overlay',
            blend: 'transparent',
            alwaysOnTop: true,
            interactive: false,
            cullDistance: 60,
        }),
    },
    {
        id: 'monitor',
        label: 'Monitor de câmera',
        description: 'Mostra o que uma câmera da cena vê, na face da frente do ator: circuito interno, retrovisor, portal.',
        actorName: 'Monitor',
        apply: (current) => createGuiSurfaceSettings({
            content: current?.content.kind === 'view' ? current.content : createViewContent({ camera: 'entity', frameRate: 30, resolutionScale: 0.75 }),
            mount: current?.mount.kind === 'face' ? current.mount : createFaceMount(),
            shading: 'screen',
            brightness: 1.1,
            blend: 'opaque',
            backdropColor: '#000000',
            backdropAlpha: 1,
            interactive: false,
        }),
    },
    {
        id: 'showcase',
        label: 'Vitrine 3D',
        description: 'Órbita automática em torno de um ator da cena, num painel: exibidor de item, retrato animado.',
        actorName: 'Vitrine',
        apply: (current) => createGuiSurfaceSettings({
            content: current?.content.kind === 'view' ? current.content : createViewContent({ camera: 'orbit', autoRotate: 20, distance: 4, pitch: -15, frameRate: 30, resolutionScale: 0.75 }),
            mount: current?.mount.kind === 'panel' ? current.mount : createPanelMount({ width: 1, height: 1 }),
            shading: 'screen',
            blend: 'opaque',
            backdropColor: '#0b0f1a',
            backdropAlpha: 1,
            interactive: true,
        }),
    },
    {
        id: 'kiosk',
        label: 'Terminal interativo',
        description: 'Tela opaca na face do ator que o jogador opera de perto: caixa eletrônico, painel de comando, cardápio.',
        actorName: 'Terminal',
        apply: (current) => createGuiSurfaceSettings({
            content: keepAsset(current, createScreenContent()),
            mount: current?.mount.kind === 'face' ? current.mount : createFaceMount({ inset: 0.04 }),
            shading: 'screen',
            blend: 'opaque',
            backdropColor: '#0b0f1a',
            backdropAlpha: 1,
            interactive: true,
            interactionDistance: 3,
            pixelsPerMeter: 512,
        }),
    },
];
export function findGuiSurfacePreset(id: string): GuiSurfacePreset | null {
    return GUI_SURFACE_PRESETS.find((preset) => preset.id === id) ?? null;
}
