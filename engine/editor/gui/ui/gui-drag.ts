import type { GuiElementKind } from '@/engine/gui/document/gui-document';
const ELEMENT_DRAG_TYPE = 'application/x-helix-gui-element';
const ICON_DRAG_TYPE = 'application/x-helix-gui-icon';
export function setElementDragData(dataTransfer: DataTransfer, kind: GuiElementKind): void {
    dataTransfer.setData(ELEMENT_DRAG_TYPE, kind);
    dataTransfer.effectAllowed = 'copy';
}
export function readElementDragData(dataTransfer: DataTransfer): GuiElementKind | null {
    return (dataTransfer.getData(ELEMENT_DRAG_TYPE) as GuiElementKind) || null;
}
export function carriesElement(dataTransfer: DataTransfer): boolean {
    return Array.from(dataTransfer.types).includes(ELEMENT_DRAG_TYPE);
}
export function setIconDragData(dataTransfer: DataTransfer, name: string): void {
    dataTransfer.setData(ICON_DRAG_TYPE, name);
    dataTransfer.effectAllowed = 'copy';
}
export function readIconDragData(dataTransfer: DataTransfer): string | null {
    return dataTransfer.getData(ICON_DRAG_TYPE) || null;
}
export function carriesIcon(dataTransfer: DataTransfer): boolean {
    return Array.from(dataTransfer.types).includes(ICON_DRAG_TYPE);
}
