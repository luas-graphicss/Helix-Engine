import { GUI_THEME, emptyStateStyle, shadow as makeShadow, stroke as makeStroke, type GuiAppearance, type GuiAutoLayout, type GuiControl, type GuiFill, type GuiFontFamily, type GuiGradient, type GuiIcon, type GuiImage, type GuiNode, type GuiRadii, type GuiRect, type GuiShadow, type GuiStateStyle, type GuiStates, type GuiStroke, type GuiTextStyle, type UDim, } from '@/engine/gui/document/gui-document';
import type { EditorSession } from '@/engine/editor/session/editor-session';
const LOG_SOURCE = 'Interface';
export interface GuiEditOptions {
    readonly merge?: string;
}
type NodeUpdate = (node: GuiNode) => GuiNode;
function patched<T extends object>(current: T, patch: Partial<T>): T {
    let changed = false;
    for (const key of Object.keys(patch) as Array<keyof T>) {
        if (!Object.is(current[key], patch[key])) {
            changed = true;
            break;
        }
    }
    return changed ? { ...current, ...patch } : current;
}
function editSelected(session: EditorSession, label: string, update: NodeUpdate, options?: GuiEditOptions): boolean {
    return session.gui.updateSelected(label, update, options?.merge);
}
export function endGuiEdit(session: EditorSession): void {
    session.gui.endMerge();
}
export function setGuiRect(session: EditorSession, patch: Partial<GuiRect>, label = 'Alterar retângulo', options?: GuiEditOptions): boolean {
    return editSelected(session, label, (node) => {
        const rect = patched(node.rect, patch);
        return rect === node.rect ? node : { ...node, rect };
    }, options);
}
export type GuiRectDimension = 'position' | 'size';
export type GuiAxisKey = 'x' | 'y';
export type UDimPart = keyof UDim;
export function setGuiUDimPart(session: EditorSession, dimension: GuiRectDimension, axis: GuiAxisKey, part: UDimPart, value: number, options?: GuiEditOptions): boolean {
    const labels: Record<GuiRectDimension, string> = { position: 'Mover', size: 'Redimensionar' };
    return editSelected(session, `${labels[dimension]} (${axis.toUpperCase()})`, (node) => {
        const current = node.rect[dimension][axis];
        if (current[part] === value)
            return node;
        const udim: UDim = { ...current, [part]: value };
        const rect: GuiRect = { ...node.rect, [dimension]: { ...node.rect[dimension], [axis]: udim } };
        if (dimension === 'size' && (rect.autoSize === 'xy' || rect.autoSize === axis)) {
            return { ...node, rect: { ...rect, autoSize: rect.autoSize === 'xy' ? (axis === 'x' ? 'y' : 'x') : 'none' } };
        }
        return { ...node, rect };
    }, options);
}
export function setGuiAppearance(session: EditorSession, patch: Partial<GuiAppearance>, label: string, options?: GuiEditOptions): boolean {
    return editSelected(session, label, (node) => {
        const appearance = patched(node.appearance, patch);
        return appearance === node.appearance ? node : { ...node, appearance };
    }, options);
}
export function setGuiFill(session: EditorSession, patch: Partial<GuiFill>, label = 'Alterar preenchimento', options?: GuiEditOptions): boolean {
    return editSelected(session, label, (node) => {
        const fill = patched(node.appearance.fill, patch);
        return fill === node.appearance.fill ? node : { ...node, appearance: { ...node.appearance, fill } };
    }, options);
}
export function setGuiGradient(session: EditorSession, gradient: GuiGradient | null, label = 'Alterar gradiente', options?: GuiEditOptions): boolean {
    return setGuiFill(session, { gradient }, label, options);
}
export function setGuiStroke(session: EditorSession, patch: Partial<GuiStroke> | null, label = 'Alterar borda', options?: GuiEditOptions): boolean {
    return editSelected(session, label, (node) => {
        if (patch === null)
            return node.appearance.stroke ? { ...node, appearance: { ...node.appearance, stroke: null } } : node;
        const base = node.appearance.stroke ?? makeStroke(GUI_THEME.border, 0.4, 1);
        const stroke = patched(base, patch);
        return stroke === node.appearance.stroke ? node : { ...node, appearance: { ...node.appearance, stroke } };
    }, options);
}
export function setGuiShadow(session: EditorSession, patch: Partial<GuiShadow> | null, label = 'Alterar sombra', options?: GuiEditOptions): boolean {
    return editSelected(session, label, (node) => {
        if (patch === null)
            return node.appearance.shadow ? { ...node, appearance: { ...node.appearance, shadow: null } } : node;
        const base = node.appearance.shadow ?? makeShadow(16, 6);
        const shadow = patched(base, patch);
        return shadow === node.appearance.shadow ? node : { ...node, appearance: { ...node.appearance, shadow } };
    }, options);
}
export function setGuiRadii(session: EditorSession, radii: GuiRadii, label = 'Alterar cantos', options?: GuiEditOptions): boolean {
    return editSelected(session, label, (node) => {
        const current = node.appearance.radii;
        if (current.every((value, index) => value === radii[index]))
            return node;
        return { ...node, appearance: { ...node.appearance, radii } };
    }, options);
}
export function setGuiLayout(session: EditorSession, patch: Partial<GuiAutoLayout>, label = 'Alterar layout', options?: GuiEditOptions): boolean {
    return editSelected(session, label, (node) => {
        const layout = patched(node.layout, patch);
        return layout === node.layout ? node : { ...node, layout };
    }, options);
}
export function setGuiText(session: EditorSession, patch: Partial<GuiTextStyle>, label = 'Alterar texto', options?: GuiEditOptions): boolean {
    return editSelected(session, label, (node) => {
        if (!node.text)
            return node;
        const text = patched(node.text, patch);
        return text === node.text ? node : { ...node, text };
    }, options);
}
export function setGuiTextShadow(session: EditorSession, patch: Partial<GuiShadow> | null, options?: GuiEditOptions): boolean {
    return editSelected(session, 'Alterar sombra do texto', (node) => {
        if (!node.text)
            return node;
        if (patch === null)
            return node.text.shadow ? { ...node, text: { ...node.text, shadow: null } } : node;
        const shadow = patched(node.text.shadow ?? makeShadow(4, 2, 0.6), patch);
        return shadow === node.text.shadow ? node : { ...node, text: { ...node.text, shadow } };
    }, options);
}
export function setGuiTextOutline(session: EditorSession, patch: Partial<GuiStroke> | null, options?: GuiEditOptions): boolean {
    return editSelected(session, 'Alterar contorno do texto', (node) => {
        if (!node.text)
            return node;
        if (patch === null)
            return node.text.outline ? { ...node, text: { ...node.text, outline: null } } : node;
        const outline = patched(node.text.outline ?? makeStroke('#000000', 1, 2), patch);
        return outline === node.text.outline ? node : { ...node, text: { ...node.text, outline } };
    }, options);
}
export function setSelectedTextFamily(session: EditorSession, family: GuiFontFamily, label: string): boolean {
    const designer = session.gui;
    const targets = designer.selectedNodes.filter((node) => node.text);
    if (targets.length === 0) {
        session.log.info(LOG_SOURCE, `Selecione um texto na tela para aplicar a fonte ${label}.`);
        return false;
    }
    return designer.updateNodes(`Aplicar fonte ${label}`, targets.map((node) => node.id), (node) => (node.text && node.text.family !== family ? { ...node, text: { ...node.text, family } } : node));
}
export function setGuiImage(session: EditorSession, patch: Partial<GuiImage>, label = 'Alterar imagem', options?: GuiEditOptions): boolean {
    return editSelected(session, label, (node) => {
        if (!node.image)
            return node;
        const image = patched(node.image, patch);
        return image === node.image ? node : { ...node, image };
    }, options);
}
export function setGuiIconStyle(session: EditorSession, patch: Partial<GuiIcon>, label = 'Alterar ícone', options?: GuiEditOptions): boolean {
    return editSelected(session, label, (node) => {
        if (!node.icon)
            return node;
        const icon = patched(node.icon, patch);
        return icon === node.icon ? node : { ...node, icon };
    }, options);
}
type ControlOf<K extends GuiControl['kind']> = Extract<GuiControl, {
    kind: K;
}>;
export function setGuiControl<K extends GuiControl['kind']>(session: EditorSession, kind: K, patch: Partial<ControlOf<K>>, label: string, options?: GuiEditOptions): boolean {
    return editSelected(session, label, (node) => {
        if (!node.control || node.control.kind !== kind)
            return node;
        const control = patched(node.control as ControlOf<K>, patch);
        return control === node.control ? node : { ...node, control };
    }, options);
}
export type GuiStateKey = Exclude<keyof GuiStates, 'transitionMs'>;
export const GUI_STATE_LABELS: Record<GuiStateKey, string> = { hover: 'Ao passar o mouse', pressed: 'Pressionado', disabled: 'Desabilitado' };
export function setGuiState(session: EditorSession, state: GuiStateKey, patch: Partial<GuiStateStyle> | null, options?: GuiEditOptions): boolean {
    return editSelected(session, `Alterar estado ${GUI_STATE_LABELS[state].toLowerCase()}`, (node) => {
        const current = node.states[state];
        if (patch === null)
            return current ? { ...node, states: { ...node.states, [state]: null } } : node;
        const style = patched(current ?? emptyStateStyle(), patch);
        return style === current ? node : { ...node, states: { ...node.states, [state]: style } };
    }, options);
}
export function setGuiStateTransition(session: EditorSession, transitionMs: number, options?: GuiEditOptions): boolean {
    return editSelected(session, 'Alterar transição dos estados', (node) => (node.states.transitionMs === transitionMs ? node : { ...node, states: { ...node.states, transitionMs } }), options);
}
export type GuiFlagKey = 'visible' | 'locked' | 'interactable' | 'clipsContent';
const FLAG_LABELS: Record<GuiFlagKey, string> = { visible: 'Alterar visibilidade', locked: 'Alterar bloqueio', interactable: 'Alterar interação', clipsContent: 'Alterar recorte do conteúdo' };
export function setGuiFlag(session: EditorSession, flag: GuiFlagKey, value: boolean): boolean {
    const changed = editSelected(session, FLAG_LABELS[flag], (node) => (node[flag] === value ? node : { ...node, [flag]: value }));
    if (changed && flag === 'locked' && value)
        session.gui.clearSelection();
    return changed;
}
