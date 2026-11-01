import { GUI_ROOT_ID, GUI_THEME, createGuiNode, defaultIcon, defaultLayout, defaultRect, defaultStates, defaultTextStyle, insets, solidFill, stroke, transparentAppearance, udim2, uniformRadii, type GuiDocument, type GuiNode, type GuiPoint, } from '@/engine/gui/document/gui-document';
import type { GuiSurfaceVideoContent, GuiSurfaceViewContent } from './gui-surface-settings';
export type SurfacePlaceholder = 'empty' | 'loading' | 'missing';
export const SURFACE_MEDIA_NODE_ID = 'surface-media';
const PLACEHOLDER_COPY: Record<SurfacePlaceholder, {
    readonly icon: string;
    readonly title: string;
    readonly hint: string;
}> = {
    empty: { icon: 'LayoutTemplate', title: 'Nenhuma tela', hint: 'Escolha uma tela, um vídeo ou uma visão 3D no inspetor.' },
    loading: { icon: 'Loader', title: 'Carregando tela…', hint: 'A tela está sendo lida da biblioteca.' },
    missing: { icon: 'FileQuestion', title: 'Tela não encontrada', hint: 'O ativo foi removido da biblioteca ou ainda não foi importado.' },
};
function fullRect() {
    return defaultRect(udim2(1, 0, 1, 0));
}
function surfaceRoot(children: readonly GuiNode[]): GuiNode {
    return {
        id: GUI_ROOT_ID,
        name: 'Superfície',
        kind: 'frame',
        visible: true,
        locked: false,
        interactable: false,
        clipsContent: true,
        rect: fullRect(),
        appearance: transparentAppearance(),
        layout: defaultLayout(),
        text: null,
        image: null,
        icon: null,
        control: null,
        states: defaultStates(),
        children,
    };
}
function surfaceDocument(name: string, size: GuiPoint, root: GuiNode): GuiDocument {
    return { name, referenceSize: { x: size.x, y: size.y }, scaleMode: 'none', enabled: true, displayOrder: 0, root, createdAt: 0 };
}
export function mediaSurfaceDocument(content: GuiSurfaceVideoContent | GuiSurfaceViewContent, size: GuiPoint): GuiDocument {
    const kind = content.kind === 'video' ? 'video' : 'viewport';
    const control = content.kind === 'video' ? content.video : content.view;
    const interactable = content.kind === 'video' ? content.video.clickToggles || content.video.showControls : content.view.interactive;
    const media: GuiNode = {
        ...createGuiNode(kind, { name: content.kind === 'video' ? 'Vídeo' : 'Visão 3D' }),
        id: SURFACE_MEDIA_NODE_ID,
        interactable,
        rect: fullRect(),
        appearance: { ...transparentAppearance(), radii: uniformRadii(0) },
        control,
    };
    return surfaceDocument(media.name, size, surfaceRoot([media]));
}
export function placeholderSurfaceDocument(kind: SurfacePlaceholder, size: GuiPoint): GuiDocument {
    const copy = PLACEHOLDER_COPY[kind];
    const shorter = Math.max(Math.min(size.x, size.y), 1);
    const iconSize = Math.round(shorter * 0.22);
    const titleSize = Math.max(10, Math.round(shorter * 0.075));
    const hintSize = Math.max(8, Math.round(shorter * 0.045));
    const showHint = size.x >= 160 && size.y >= 96;
    const icon: GuiNode = {
        ...createGuiNode('icon', { name: 'Ícone', size: { x: iconSize, y: iconSize } }),
        id: 'surface-placeholder-icon',
        icon: defaultIcon(copy.icon),
        rect: { ...defaultRect(udim2(0, iconSize, 0, iconSize)), aspectRatio: 1 },
    };
    const title: GuiNode = {
        ...createGuiNode('text', { name: 'Título' }),
        id: 'surface-placeholder-title',
        rect: { ...defaultRect(udim2(1, 0, 0, Math.round(titleSize * 1.4))), autoSize: 'none' },
        text: defaultTextStyle(copy.title, { size: titleSize, weight: 600, align: 'center', color: GUI_THEME.text }),
    };
    const hint: GuiNode = {
        ...createGuiNode('text', { name: 'Dica' }),
        id: 'surface-placeholder-hint',
        rect: { ...defaultRect(udim2(0.9, 0, 0, Math.round(hintSize * 2.8))), autoSize: 'none' },
        text: defaultTextStyle(copy.hint, { size: hintSize, weight: 400, align: 'center', color: GUI_THEME.textMuted }),
    };
    const stack: GuiNode = {
        ...createGuiNode('frame', { name: 'Conteúdo' }),
        id: 'surface-placeholder-stack',
        rect: { ...defaultRect(udim2(1, 0, 0, 0), udim2(0.5, 0, 0.5, 0), { x: 0.5, y: 0.5 }), autoSize: 'y' },
        appearance: transparentAppearance(),
        layout: { ...defaultLayout(), kind: 'list', direction: 'vertical', gap: Math.round(shorter * 0.04), padding: insets(0), mainAlign: 'center', crossAlign: 'center' },
        children: showHint ? [icon, title, hint] : [icon, title],
    };
    const backdrop: GuiNode = {
        ...createGuiNode('frame', { name: 'Fundo' }),
        id: 'surface-placeholder-backdrop',
        rect: fullRect(),
        appearance: { fill: solidFill('#0b0f1a', 0.92), stroke: stroke(GUI_THEME.border, 0.08, Math.max(1, Math.round(shorter * 0.01))), radii: uniformRadii(0), shadow: null, opacity: 1 },
        children: [stack],
    };
    return surfaceDocument(copy.title, size, surfaceRoot([backdrop]));
}
