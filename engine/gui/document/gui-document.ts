export const GUI_FORMAT_ID = 'helix-gui';
export const GUI_FORMAT_VERSION = 1;
export const GUI_EXTENSION = 'hxgui';
export const GUI_MIME_TYPE = 'application/vnd.helix.gui+json';
export type GuiElementKind = 'frame' | 'text' | 'image' | 'icon' | 'button' | 'toggle' | 'slider' | 'progress' | 'input' | 'scroll' | 'divider' | 'video' | 'viewport';
export const GUI_ELEMENT_KINDS: readonly GuiElementKind[] = ['frame', 'text', 'image', 'icon', 'button', 'toggle', 'slider', 'progress', 'input', 'scroll', 'divider', 'video', 'viewport'];
export interface UDim {
    readonly scale: number;
    readonly offset: number;
}
export interface UDim2 {
    readonly x: UDim;
    readonly y: UDim;
}
export interface GuiPoint {
    readonly x: number;
    readonly y: number;
}
export interface GuiInsets {
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
    readonly left: number;
}
export interface GuiGradientStop {
    readonly offset: number;
    readonly color: string;
    readonly alpha: number;
}
export interface GuiGradient {
    readonly kind: 'linear' | 'radial';
    readonly angle: number;
    readonly stops: readonly GuiGradientStop[];
}
export interface GuiFill {
    readonly color: string;
    readonly alpha: number;
    readonly gradient: GuiGradient | null;
}
export interface GuiStroke {
    readonly width: number;
    readonly color: string;
    readonly alpha: number;
}
export interface GuiShadow {
    readonly color: string;
    readonly alpha: number;
    readonly blur: number;
    readonly offsetX: number;
    readonly offsetY: number;
}
export type GuiRadii = readonly [
    number,
    number,
    number,
    number
];
export interface GuiAppearance {
    readonly fill: GuiFill;
    readonly stroke: GuiStroke | null;
    readonly radii: GuiRadii;
    readonly shadow: GuiShadow | null;
    readonly opacity: number;
}
export type GuiFontFamily = string;
export type GuiTextAlign = 'left' | 'center' | 'right';
export type GuiTextVerticalAlign = 'top' | 'middle' | 'bottom';
export interface GuiTextStyle {
    readonly content: string;
    readonly family: GuiFontFamily;
    readonly size: number;
    readonly weight: number;
    readonly italic: boolean;
    readonly color: string;
    readonly alpha: number;
    readonly align: GuiTextAlign;
    readonly verticalAlign: GuiTextVerticalAlign;
    readonly lineHeight: number;
    readonly letterSpacing: number;
    readonly wrap: boolean;
    readonly uppercase: boolean;
    readonly shadow: GuiShadow | null;
    readonly outline: GuiStroke | null;
    readonly fitToBox: boolean;
}
export type GuiImageFit = 'stretch' | 'contain' | 'cover' | 'tile' | 'slice';
export interface GuiImage {
    readonly assetId: string | null;
    readonly fit: GuiImageFit;
    readonly slice: GuiInsets;
    readonly tint: string;
    readonly tintAlpha: number;
    readonly flipX: boolean;
    readonly flipY: boolean;
}
export interface GuiIcon {
    readonly name: string;
    readonly color: string;
    readonly alpha: number;
    readonly strokeWidth: number;
}
export type GuiAutoLayoutKind = 'none' | 'list' | 'grid';
export type GuiAxis = 'horizontal' | 'vertical';
export type GuiMainAlign = 'start' | 'center' | 'end' | 'space-between' | 'space-around';
export type GuiCrossAlign = 'start' | 'center' | 'end' | 'stretch';
export interface GuiAutoLayout {
    readonly kind: GuiAutoLayoutKind;
    readonly direction: GuiAxis;
    readonly gap: number;
    readonly padding: GuiInsets;
    readonly mainAlign: GuiMainAlign;
    readonly crossAlign: GuiCrossAlign;
    readonly wrap: boolean;
    readonly cellSize: UDim2;
    readonly columns: number | null;
}
export type GuiAutoSize = 'none' | 'x' | 'y' | 'xy';
export interface GuiRect {
    readonly position: UDim2;
    readonly size: UDim2;
    readonly anchor: GuiPoint;
    readonly rotation: number;
    readonly zIndex: number;
    readonly autoSize: GuiAutoSize;
    readonly aspectRatio: number | null;
    readonly minSize: GuiPoint;
    readonly maxSize: GuiPoint | null;
    readonly ignoreLayout: boolean;
    readonly safeArea: boolean;
}
export interface GuiStateStyle {
    readonly fillColor: string | null;
    readonly fillAlpha: number | null;
    readonly strokeColor: string | null;
    readonly textColor: string | null;
    readonly scale: number;
    readonly opacity: number | null;
}
export interface GuiStates {
    readonly hover: GuiStateStyle | null;
    readonly pressed: GuiStateStyle | null;
    readonly disabled: GuiStateStyle | null;
    readonly transitionMs: number;
}
export interface GuiButtonControl {
    readonly kind: 'button';
    readonly disabled: boolean;
    readonly iconName: string | null;
    readonly iconPosition: 'left' | 'right' | 'top' | 'only';
    readonly iconSize: number;
    readonly iconGap: number;
}
export interface GuiToggleControl {
    readonly kind: 'toggle';
    readonly value: boolean;
    readonly style: 'switch' | 'checkbox';
    readonly onColor: string;
    readonly knobColor: string;
}
export interface GuiSliderControl {
    readonly kind: 'slider';
    readonly min: number;
    readonly max: number;
    readonly value: number;
    readonly step: number;
    readonly direction: GuiAxis;
    readonly trackColor: string;
    readonly trackAlpha: number;
    readonly fillColor: string;
    readonly knobColor: string;
    readonly knobSize: number;
    readonly trackThickness: number;
}
export interface GuiProgressControl {
    readonly kind: 'progress';
    readonly value: number;
    readonly direction: GuiAxis;
    readonly reverse: boolean;
    readonly fillColor: string;
    readonly fillAlpha: number;
    readonly fillGradient: GuiGradient | null;
    readonly showLabel: boolean;
    readonly segments: number;
}
export interface GuiInputControl {
    readonly kind: 'input';
    readonly value: string;
    readonly placeholder: string;
    readonly placeholderColor: string;
    readonly maxLength: number | null;
    readonly password: boolean;
    readonly multiline: boolean;
    readonly caretColor: string;
}
export interface GuiScrollControl {
    readonly kind: 'scroll';
    readonly canvasSize: UDim2;
    readonly direction: GuiAxis | 'both';
    readonly scrollbarThickness: number;
    readonly scrollbarColor: string;
    readonly scrollbarAlpha: number;
}
export interface GuiDividerControl {
    readonly kind: 'divider';
    readonly orientation: GuiAxis;
    readonly thickness: number;
    readonly color: string;
    readonly alpha: number;
    readonly dashed: boolean;
}
export type GuiVideoFit = 'cover' | 'contain' | 'stretch';
export type GuiVideoPlayOn = 'start' | 'hover' | 'manual';
export type GuiMediaBlend = 'normal' | 'screen' | 'multiply' | 'add' | 'overlay';
export const GUI_MEDIA_BLENDS: readonly GuiMediaBlend[] = ['normal', 'screen', 'multiply', 'add', 'overlay'];
export interface GuiVideoControl {
    readonly kind: 'video';
    readonly assetId: string | null;
    readonly fit: GuiVideoFit;
    readonly playOn: GuiVideoPlayOn;
    readonly loop: boolean;
    readonly muted: boolean;
    readonly volume: number;
    readonly speed: number;
    readonly startTime: number;
    readonly endTime: number | null;
    readonly clickToggles: boolean;
    readonly restartOnPlay: boolean;
    readonly showControls: boolean;
    readonly blend: GuiMediaBlend;
    readonly tint: string;
    readonly tintAlpha: number;
    readonly flipX: boolean;
    readonly flipY: boolean;
    readonly posterAssetId: string | null;
}
export type GuiViewportCamera = 'entity' | 'orbit';
export interface GuiViewportControl {
    readonly kind: 'viewport';
    readonly camera: GuiViewportCamera;
    readonly cameraName: string;
    readonly targetName: string;
    readonly distance: number;
    readonly yaw: number;
    readonly pitch: number;
    readonly autoRotate: number;
    readonly fov: number;
    readonly interactive: boolean;
    readonly minDistance: number;
    readonly maxDistance: number;
    readonly resolutionScale: number;
    readonly frameRate: number;
    readonly grid: boolean;
    readonly blend: GuiMediaBlend;
    readonly tint: string;
    readonly tintAlpha: number;
}
export type GuiControl = GuiButtonControl | GuiToggleControl | GuiSliderControl | GuiProgressControl | GuiInputControl | GuiScrollControl | GuiDividerControl | GuiVideoControl | GuiViewportControl;
export interface GuiNode {
    readonly id: string;
    readonly name: string;
    readonly kind: GuiElementKind;
    readonly visible: boolean;
    readonly locked: boolean;
    readonly interactable: boolean;
    readonly clipsContent: boolean;
    readonly rect: GuiRect;
    readonly appearance: GuiAppearance;
    readonly layout: GuiAutoLayout;
    readonly text: GuiTextStyle | null;
    readonly image: GuiImage | null;
    readonly icon: GuiIcon | null;
    readonly control: GuiControl | null;
    readonly states: GuiStates;
    readonly children: readonly GuiNode[];
}
export type GuiScaleMode = 'none' | 'width' | 'height' | 'shorter' | 'longer';
export interface GuiDocument {
    readonly name: string;
    readonly referenceSize: GuiPoint;
    readonly scaleMode: GuiScaleMode;
    readonly enabled: boolean;
    readonly displayOrder: number;
    readonly root: GuiNode;
    readonly createdAt: number;
}
export const GUI_ROOT_ID = 'root';
export const GUI_DEFAULT_REFERENCE_SIZE: GuiPoint = { x: 1920, y: 1080 };
export const GUI_THEME = {
    surface: '#1b2030',
    surfaceAlpha: 0.88,
    border: '#ffffff',
    borderAlpha: 0.1,
    text: '#f4f6fb',
    textMuted: '#9aa3b5',
    accent: '#4f7cff',
    accentText: '#ffffff',
    success: '#3ccf7a',
    danger: '#ff5c6c',
} as const;
export const GUI_DEFAULT_FONT: GuiFontFamily = 'builtin:sans';
export function udim(scale: number, offset: number): UDim {
    return { scale, offset };
}
export function udim2(xScale: number, xOffset: number, yScale: number, yOffset: number): UDim2 {
    return { x: udim(xScale, xOffset), y: udim(yScale, yOffset) };
}
export function hasGuiInsets(value: GuiInsets): boolean {
    return value.top > 0 || value.right > 0 || value.bottom > 0 || value.left > 0;
}
export function insets(top: number, right = top, bottom = top, left = right): GuiInsets {
    return { top, right, bottom, left };
}
export function uniformRadii(radius: number): GuiRadii {
    return [radius, radius, radius, radius];
}
export function solidFill(color: string, alpha = 1): GuiFill {
    return { color, alpha, gradient: null };
}
export function stroke(color: string, alpha = 1, width = 1): GuiStroke {
    return { width, color, alpha };
}
export function shadow(blur: number, offsetY: number, alpha = 0.35, color = '#000000', offsetX = 0): GuiShadow {
    return { color, alpha, blur, offsetX, offsetY };
}
export function emptyStateStyle(): GuiStateStyle {
    return { fillColor: null, fillAlpha: null, strokeColor: null, textColor: null, scale: 1, opacity: null };
}
export function defaultAppearance(): GuiAppearance {
    return { fill: solidFill(GUI_THEME.surface, GUI_THEME.surfaceAlpha), stroke: stroke(GUI_THEME.border, GUI_THEME.borderAlpha), radii: uniformRadii(10), shadow: null, opacity: 1 };
}
export function transparentAppearance(): GuiAppearance {
    return { fill: solidFill('#000000', 0), stroke: null, radii: uniformRadii(0), shadow: null, opacity: 1 };
}
export function defaultLayout(): GuiAutoLayout {
    return { kind: 'none', direction: 'vertical', gap: 8, padding: insets(0), mainAlign: 'start', crossAlign: 'start', wrap: false, cellSize: udim2(0, 96, 0, 96), columns: null };
}
export function defaultRect(size: UDim2, position: UDim2 = udim2(0, 0, 0, 0), anchor: GuiPoint = { x: 0, y: 0 }): GuiRect {
    return { position, size, anchor, rotation: 0, zIndex: 0, autoSize: 'none', aspectRatio: null, minSize: { x: 0, y: 0 }, maxSize: null, ignoreLayout: false, safeArea: false };
}
export function defaultStates(): GuiStates {
    return { hover: null, pressed: null, disabled: null, transitionMs: 120 };
}
export function defaultTextStyle(content: string, overrides: Partial<GuiTextStyle> = {}): GuiTextStyle {
    return {
        content,
        family: GUI_DEFAULT_FONT,
        size: 18,
        weight: 500,
        italic: false,
        color: GUI_THEME.text,
        alpha: 1,
        align: 'left',
        verticalAlign: 'middle',
        lineHeight: 1.25,
        letterSpacing: 0,
        wrap: true,
        uppercase: false,
        shadow: null,
        outline: null,
        fitToBox: false,
        ...overrides,
    };
}
export function defaultImage(assetId: string | null = null): GuiImage {
    return { assetId, fit: 'contain', slice: insets(16), tint: '#ffffff', tintAlpha: 1, flipX: false, flipY: false };
}
export function defaultIcon(name = 'Star'): GuiIcon {
    return { name, color: GUI_THEME.text, alpha: 1, strokeWidth: 2 };
}
let idCounter = 0;
export function createGuiId(): string {
    idCounter = (idCounter + 1) % 46656;
    return `${Date.now().toString(36).slice(-6)}${idCounter.toString(36).padStart(3, '0')}${Math.floor(Math.random() * 1296).toString(36).padStart(2, '0')}`;
}
export const GUI_ELEMENT_LABELS: Record<GuiElementKind, string> = {
    frame: 'Quadro',
    text: 'Texto',
    image: 'Imagem',
    icon: 'Ícone',
    button: 'Botão',
    toggle: 'Alternador',
    slider: 'Controle deslizante',
    progress: 'Barra de progresso',
    input: 'Campo de texto',
    scroll: 'Área rolável',
    divider: 'Divisor',
    video: 'Vídeo',
    viewport: 'Viewport 3D',
};
export const GUI_ELEMENT_DESCRIPTIONS: Record<GuiElementKind, string> = {
    frame: 'Contêiner para agrupar e posicionar outros elementos; aceita layout automático.',
    text: 'Rótulo de texto com fonte, tamanho, alinhamento e efeitos.',
    image: 'Imagem da biblioteca com ajuste, recorte em 9 fatias e tonalidade.',
    icon: 'Ícone vetorial do catálogo, sempre nítido em qualquer tamanho.',
    button: 'Botão com rótulo, ícone opcional e estados de hover e pressionado.',
    toggle: 'Interruptor ou caixa de seleção ligado/desligado.',
    slider: 'Valor numérico ajustável arrastando o botão pela trilha.',
    progress: 'Barra preenchida proporcionalmente a um valor (vida, carregamento).',
    input: 'Campo para o jogador digitar, com texto de ajuda.',
    scroll: 'Contêiner com conteúdo maior que a área, rolável.',
    divider: 'Linha separadora horizontal ou vertical.',
    video: 'Vídeo da biblioteca com laço, recorte, velocidade, modo de mistura e controles: fundos cinematográficos, cutscenes, telas.',
    viewport: 'Janela para a cena 3D vista por uma câmera ou orbitando um ator: retrato do personagem, vitrine de item, minimapa.',
};
export function defaultVideoControl(assetId: string | null = null): GuiVideoControl {
    return {
        kind: 'video',
        assetId,
        fit: 'cover',
        playOn: 'start',
        loop: true,
        muted: true,
        volume: 0.8,
        speed: 1,
        startTime: 0,
        endTime: null,
        clickToggles: false,
        restartOnPlay: true,
        showControls: false,
        blend: 'normal',
        tint: '#000000',
        tintAlpha: 0,
        flipX: false,
        flipY: false,
        posterAssetId: null,
    };
}
export function defaultViewportControl(): GuiViewportControl {
    return {
        kind: 'viewport',
        camera: 'orbit',
        cameraName: '',
        targetName: '',
        distance: 6,
        yaw: 35,
        pitch: -18,
        autoRotate: 0,
        fov: 45,
        interactive: false,
        minDistance: 1,
        maxDistance: 30,
        resolutionScale: 1,
        frameRate: 0,
        grid: false,
        blend: 'normal',
        tint: '#000000',
        tintAlpha: 0,
    };
}
function baseNode(kind: GuiElementKind, name: string, rect: GuiRect, appearance: GuiAppearance): GuiNode {
    return {
        id: createGuiId(),
        name,
        kind,
        visible: true,
        locked: false,
        interactable: kind === 'button' || kind === 'toggle' || kind === 'slider' || kind === 'input' || kind === 'scroll',
        clipsContent: kind === 'scroll' || kind === 'image' || kind === 'video' || kind === 'viewport',
        rect,
        appearance,
        layout: defaultLayout(),
        text: null,
        image: null,
        icon: null,
        control: null,
        states: defaultStates(),
        children: [],
    };
}
export function buttonStates(): GuiStates {
    return {
        hover: { ...emptyStateStyle(), fillColor: '#6b90ff' },
        pressed: { ...emptyStateStyle(), fillColor: '#3b63d9', scale: 0.97 },
        disabled: { ...emptyStateStyle(), opacity: 0.45 },
        transitionMs: 120,
    };
}
export function createGuiNode(kind: GuiElementKind, options: {
    readonly name?: string;
    readonly position?: UDim2;
    readonly size?: GuiPoint;
} = {}): GuiNode {
    const position = options.position ?? udim2(0, 0, 0, 0);
    const px = (width: number, height: number) => udim2(0, options.size?.x ?? width, 0, options.size?.y ?? height);
    const name = options.name ?? GUI_ELEMENT_LABELS[kind];
    switch (kind) {
        case 'frame':
            return baseNode(kind, name, defaultRect(px(320, 200), position), defaultAppearance());
        case 'text':
            return { ...baseNode(kind, name, { ...defaultRect(px(200, 32), position), autoSize: 'xy' }, transparentAppearance()), text: defaultTextStyle('Texto') };
        case 'image':
            return { ...baseNode(kind, name, defaultRect(px(200, 200), position), { ...transparentAppearance(), radii: uniformRadii(8) }), image: defaultImage() };
        case 'icon':
            return { ...baseNode(kind, name, { ...defaultRect(px(32, 32), position), aspectRatio: 1 }, transparentAppearance()), icon: defaultIcon() };
        case 'button':
            return {
                ...baseNode(kind, name, defaultRect(px(200, 48), position), { fill: solidFill(GUI_THEME.accent), stroke: null, radii: uniformRadii(10), shadow: shadow(12, 4, 0.25), opacity: 1 }),
                text: defaultTextStyle('Botão', { align: 'center', weight: 600, color: GUI_THEME.accentText }),
                control: { kind: 'button', disabled: false, iconName: null, iconPosition: 'left', iconSize: 20, iconGap: 8 },
                states: buttonStates(),
            };
        case 'toggle':
            return {
                ...baseNode(kind, name, defaultRect(px(56, 30), position), transparentAppearance()),
                control: { kind: 'toggle', value: true, style: 'switch', onColor: GUI_THEME.accent, knobColor: '#ffffff' },
                states: { ...defaultStates(), hover: { ...emptyStateStyle(), scale: 1.04 } },
            };
        case 'slider':
            return {
                ...baseNode(kind, name, defaultRect(px(240, 28), position), transparentAppearance()),
                control: { kind: 'slider', min: 0, max: 100, value: 60, step: 1, direction: 'horizontal', trackColor: '#ffffff', trackAlpha: 0.14, fillColor: GUI_THEME.accent, knobColor: '#ffffff', knobSize: 18, trackThickness: 6 },
            };
        case 'progress':
            return {
                ...baseNode(kind, name, defaultRect(px(260, 18), position), { fill: solidFill('#ffffff', 0.12), stroke: null, radii: uniformRadii(9), shadow: null, opacity: 1 }),
                text: defaultTextStyle('', { align: 'center', size: 12, weight: 600 }),
                control: { kind: 'progress', value: 0.65, direction: 'horizontal', reverse: false, fillColor: GUI_THEME.success, fillAlpha: 1, fillGradient: null, showLabel: false, segments: 0 },
            };
        case 'input':
            return {
                ...baseNode(kind, name, defaultRect(px(280, 44), position), { fill: solidFill('#0f1320', 0.9), stroke: stroke('#ffffff', 0.14), radii: uniformRadii(8), shadow: null, opacity: 1 }),
                text: defaultTextStyle('', { size: 16, weight: 400 }),
                control: { kind: 'input', value: '', placeholder: 'Digite aqui…', placeholderColor: GUI_THEME.textMuted, maxLength: null, password: false, multiline: false, caretColor: GUI_THEME.accent },
            };
        case 'scroll':
            return {
                ...baseNode(kind, name, defaultRect(px(320, 240), position), defaultAppearance()),
                control: { kind: 'scroll', canvasSize: udim2(1, 0, 2, 0), direction: 'vertical', scrollbarThickness: 6, scrollbarColor: '#ffffff', scrollbarAlpha: 0.35 },
            };
        case 'divider':
            return {
                ...baseNode(kind, name, defaultRect(px(240, 1), position), transparentAppearance()),
                control: { kind: 'divider', orientation: 'horizontal', thickness: 1, color: '#ffffff', alpha: 0.16, dashed: false },
            };
        case 'video':
            return {
                ...baseNode(kind, name, defaultRect(px(480, 270), position), { fill: solidFill('#000000', 1), stroke: null, radii: uniformRadii(12), shadow: null, opacity: 1 }),
                control: defaultVideoControl(),
            };
        case 'viewport':
            return {
                ...baseNode(kind, name, defaultRect(px(320, 320), position), { fill: solidFill('#0b0f1a', 1), stroke: stroke(GUI_THEME.border, GUI_THEME.borderAlpha), radii: uniformRadii(14), shadow: null, opacity: 1 }),
                control: defaultViewportControl(),
            };
    }
}
export function createGuiRoot(): GuiNode {
    return { ...baseNode('frame', 'Tela', defaultRect(udim2(1, 0, 1, 0)), transparentAppearance()), id: GUI_ROOT_ID, interactable: false };
}
export function createGuiDocument(name = 'Nova tela', referenceSize: GuiPoint = GUI_DEFAULT_REFERENCE_SIZE): GuiDocument {
    return { name, referenceSize, scaleMode: 'shorter', enabled: true, displayOrder: 0, root: createGuiRoot(), createdAt: Date.now() };
}
export function resolveUDim(dim: UDim, parentLength: number, offsetScale = 1): number {
    return dim.scale * parentLength + dim.offset * offsetScale;
}
