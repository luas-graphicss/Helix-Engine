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
