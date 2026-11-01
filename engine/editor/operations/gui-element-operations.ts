import { GUI_ELEMENT_LABELS, GUI_ROOT_ID, createGuiNode, defaultRect, transparentAppearance, udim2, type GuiDocument, type GuiElementKind, type GuiNode, type GuiPoint, type GuiRect, } from '@/engine/gui/document/gui-document';
import { cloneGuiNode, findGuiNode, findGuiParent, insertGuiNode, moveGuiNode, removeGuiNodes, topLevelGuiIds, uniqueGuiName, updateGuiNode } from '@/engine/gui/document/gui-tree';
import { hitTestGui } from '@/engine/gui/layout/gui-hit-test';
import type { GuiBox, GuiLayoutEntry, GuiLayoutResult } from '@/engine/gui/layout/gui-layout';
import { applyMatrix } from '@/engine/gui/layout/gui-matrix';
import type { GuiDesigner } from '@/engine/editor/gui/gui-designer';
import { GUI_ANCHOR_PRESETS, entryBox, parentContentFrame, rectFromBox, screenPointToParent, toPixels, toProportional, unionBoxes, withAnchor, withAnchorPreset, type GuiUnitTarget } from '@/engine/editor/gui/gui-geometry';
import type { EditorSession } from '@/engine/editor/session/editor-session';
const LOG_SOURCE = 'Interface';
const DUPLICATE_OFFSET = 16;
export type GuiAlignment = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';
export type GuiReorder = 'front' | 'forward' | 'backward' | 'back';
export function isGuiContainer(node: GuiNode): boolean {
    return node.kind === 'frame' || node.kind === 'scroll';
}
function plural(count: number, singular: string, pluralForm: string): string {
    return `${count} ${count === 1 ? singular : pluralForm}`;
}
export function pickGuiNodeAt(layout: GuiLayoutResult, x: number, y: number): GuiLayoutEntry | null {
    return hitTestGui(layout, x, y, (entry) => entry.node.id !== GUI_ROOT_ID && entry.node.visible && !entry.node.locked && !hasHiddenOrLockedAncestor(layout, entry));
}
export function pickGuiContainerAt(layout: GuiLayoutResult, x: number, y: number): GuiLayoutEntry {
    return hitTestGui(layout, x, y, (entry) => isGuiContainer(entry.node) && entry.node.visible && !entry.node.locked && !hasHiddenOrLockedAncestor(layout, entry)) ?? layout.entries.get(GUI_ROOT_ID)!;
}
function hasHiddenOrLockedAncestor(layout: GuiLayoutResult, entry: GuiLayoutEntry): boolean {
    let parentId = entry.parentId;
    while (parentId) {
        const parent = layout.entries.get(parentId);
        if (!parent)
            return false;
        if (!parent.node.visible || parent.node.locked)
            return true;
        parentId = parent.parentId;
    }
    return false;
}
export function insertionParentId(designer: GuiDesigner): string {
    const { document } = designer;
    if (!document)
        return GUI_ROOT_ID;
    const primary = designer.primaryNode;
    if (!primary)
        return GUI_ROOT_ID;
    if (isGuiContainer(primary))
        return primary.id;
    return findGuiParent(document.root, primary.id)?.id ?? GUI_ROOT_ID;
}
export interface AddGuiElementOptions {
    readonly at?: GuiPoint;
    readonly box?: GuiBox;
    readonly parentId?: string;
    readonly name?: string;
}
export function addGuiElement(session: EditorSession, kind: GuiElementKind, options: AddGuiElementOptions = {}): string | null {
    const designer = session.gui;
    const layout = designer.layout();
    if (!layout || !designer.document)
        return null;
    const root = designer.document.root;
    const point = options.box ? { x: options.box.x, y: options.box.y } : options.at;
    const parentId = options.parentId ?? (point ? pickGuiContainerAt(layout, point.x, point.y).node.id : insertionParentId(designer));
    const parent = findGuiNode(root, parentId) ?? root;
    const node = createGuiNode(kind, { name: uniqueGuiName(root, options.name ?? GUI_ELEMENT_LABELS[kind]) });
    const s = layout.offsetScale;
    const frame = parentContentFrame(layout, parent.id);
    let rect: GuiRect = node.rect;
    if (parent.layout.kind === 'none') {
        const defaultSize = { x: node.rect.size.x.offset * s, y: node.rect.size.y.offset * s };
        let box: GuiBox;
        if (options.box) {
            const a = screenPointToParent(layout, parent.id, options.box.x, options.box.y);
            const b = screenPointToParent(layout, parent.id, options.box.x + options.box.width, options.box.y + options.box.height);
            box = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.max(1, Math.abs(b.x - a.x)), height: Math.max(1, Math.abs(b.y - a.y)) };
        }
        else if (options.at) {
            const local = screenPointToParent(layout, parent.id, options.at.x, options.at.y);
            box = { x: local.x, y: local.y, width: defaultSize.x, height: defaultSize.y };
        }
        else {
            box = { x: (frame.width - defaultSize.x) / 2, y: (frame.height - defaultSize.y) / 2, width: defaultSize.x, height: defaultSize.y };
        }
        rect = rectFromBox(node.rect, box, frame, s);
        if (kind === 'text')
            rect = { ...rect, autoSize: options.box ? 'y' : 'xy' };
        if (node.rect.aspectRatio && !options.box)
            rect = { ...rect, size: { x: rect.size.x, y: rect.size.x } };
    }
    const created = { ...node, rect };
    const added = designer.apply(`Adicionar ${GUI_ELEMENT_LABELS[kind].toLowerCase()}`, (document) => ({ ...document, root: insertGuiNode(document.root, parent.id, created) }));
    if (!added)
        return null;
    designer.select([created.id]);
    designer.setTool('select');
    return created.id;
}
export function defaultGuiElementSize(kind: GuiElementKind, offsetScale: number): GuiPoint {
    const { size } = createGuiNode(kind).rect;
    return { x: size.x.offset * offsetScale, y: size.y.offset * offsetScale };
}
export function centeredGuiDropPoint(session: EditorSession, kind: GuiElementKind, at: GuiPoint): GuiPoint {
    const layout = session.gui.layout();
    const size = defaultGuiElementSize(kind, layout?.offsetScale ?? 1);
    return { x: at.x - size.x / 2, y: at.y - size.y / 2 };
}
export function addGuiImageElement(session: EditorSession, assetId: string, assetName: string, at?: GuiPoint): string | null {
    const id = addGuiElement(session, 'image', { at: at ? centeredGuiDropPoint(session, 'image', at) : undefined, name: assetName });
    if (!id)
        return null;
    session.gui.updateNodes(`Usar imagem ${assetName}`, [id], (node) => (node.image ? { ...node, image: { ...node.image, assetId } } : node), `gui-image-${id}`);
    session.gui.endMerge();
    return id;
}
export function addGuiVideoElement(session: EditorSession, assetId: string, assetName: string, at?: GuiPoint): string | null {
    const asset = session.library.get(assetId);
    const details = asset?.details.kind === 'video' ? asset.details : null;
    const aspect = details && details.width > 0 && details.height > 0 ? details.width / details.height : 16 / 9;
    const scale = session.gui.layout()?.offsetScale ?? 1;
    const width = 480 * scale;
    const height = Math.round(width / aspect);
    const id = addGuiElement(session, 'video', { box: at ? { x: at.x - width / 2, y: at.y - height / 2, width, height } : undefined, name: assetName.replace(/\.[^.]+$/, '') });
    if (!id)
        return null;
    session.gui.updateNodes(`Usar vídeo ${assetName}`, [id], (node) => (node.control?.kind === 'video' ? { ...node, control: { ...node.control, assetId } } : node), `gui-video-${id}`);
    session.gui.endMerge();
    return id;
}
export function dropGuiIcon(session: EditorSession, name: string, at: GuiPoint): string | null {
    const designer = session.gui;
    const layout = designer.layout();
    const target = layout ? pickGuiNodeAt(layout, at.x, at.y) : null;
    if (target && (target.node.kind === 'icon' || target.node.kind === 'button')) {
        setGuiIcon(session, [target.node.id], name);
        designer.select([target.node.id]);
        return target.node.id;
    }
    const id = addGuiElement(session, 'icon', { at: centeredGuiDropPoint(session, 'icon', at), name });
    if (id)
        setGuiIcon(session, [id], name);
    return id;
}
export function setGuiIcon(session: EditorSession, ids: readonly string[], name: string): void {
    session.gui.updateNodes(`Ícone ${name}`, ids, (node) => {
        if (node.kind === 'icon' && node.icon)
            return node.icon.name === name ? node : { ...node, icon: { ...node.icon, name } };
        if (node.kind === 'button' && node.control?.kind === 'button')
            return { ...node, control: { ...node.control, iconName: name } };
        return node;
    });
}
export function deleteSelectedGuiNodes(session: EditorSession): void {
    const designer = session.gui;
    if (!designer.document)
        return;
    const ids = topLevelGuiIds(designer.document.root, [...designer.selectedIds]);
    if (ids.length === 0)
        return;
    const set = new Set(ids);
    designer.apply(`Excluir ${plural(ids.length, 'elemento', 'elementos')}`, (document) => ({ ...document, root: removeGuiNodes(document.root, set) }));
    designer.clearSelection();
}
function shiftRect(rect: GuiRect, dx: number, dy: number): GuiRect {
    return { ...rect, position: { x: { ...rect.position.x, offset: rect.position.x.offset + dx }, y: { ...rect.position.y, offset: rect.position.y.offset + dy } } };
}
export function duplicateSelectedGuiNodes(session: EditorSession, offset = true): void {
    const designer = session.gui;
    if (!designer.document)
        return;
    const ids = topLevelGuiIds(designer.document.root, [...designer.selectedIds]);
    if (ids.length === 0)
        return;
    const created: string[] = [];
    designer.apply(`Duplicar ${plural(ids.length, 'elemento', 'elementos')}`, (document) => {
        let root = document.root;
        for (const id of ids) {
            const node = findGuiNode(root, id);
            const parent = findGuiParent(root, id);
            if (!node || !parent)
                continue;
            const clone = cloneGuiNode(node, (name) => uniqueGuiName(root, name));
            const placed = offset && parent.layout.kind === 'none' ? { ...clone, rect: shiftRect(clone.rect, DUPLICATE_OFFSET, DUPLICATE_OFFSET) } : clone;
            root = insertGuiNode(root, parent.id, placed, parent.children.indexOf(node) + 1);
            created.push(placed.id);
        }
        return { ...document, root };
    });
    if (created.length > 0)
        designer.select(created);
}
export function copySelectedGuiNodes(session: EditorSession): boolean {
    const designer = session.gui;
    if (!designer.document)
        return false;
    const ids = topLevelGuiIds(designer.document.root, [...designer.selectedIds]);
    const nodes = ids.map((id) => findGuiNode(designer.document!.root, id)).filter((node): node is GuiNode => node !== null);
    if (nodes.length === 0)
        return false;
    designer.setClipboard(nodes);
    return true;
}
export function cutSelectedGuiNodes(session: EditorSession): void {
    if (copySelectedGuiNodes(session))
        deleteSelectedGuiNodes(session);
}
export function pasteGuiNodes(session: EditorSession): void {
    const designer = session.gui;
    if (!designer.document || designer.clipboard.length === 0)
        return;
    const parentId = insertionParentId(designer);
    const created: string[] = [];
    designer.apply(`Colar ${plural(designer.clipboard.length, 'elemento', 'elementos')}`, (document) => {
        let root = document.root;
        const parent = findGuiNode(root, parentId) ?? root;
        for (const source of designer.clipboard) {
            const clone = cloneGuiNode(source, (name) => uniqueGuiName(root, name));
            const sameParent = parent.children.some((child) => child.id === source.id);
            const placed = sameParent && parent.layout.kind === 'none' ? { ...clone, rect: shiftRect(clone.rect, DUPLICATE_OFFSET, DUPLICATE_OFFSET) } : clone;
            root = insertGuiNode(root, parent.id, placed);
            created.push(placed.id);
        }
        return { ...document, root };
    });
    if (created.length > 0)
        designer.select(created);
}
function siblingSelection(designer: GuiDesigner): {
    parent: GuiNode;
    ids: string[];
} | null {
    const { document } = designer;
    if (!document)
        return null;
    const top = topLevelGuiIds(document.root, [...designer.selectedIds]);
    if (top.length === 0)
        return null;
    const reference = designer.primaryId && top.includes(designer.primaryId) ? designer.primaryId : top[0];
    const parent = findGuiParent(document.root, reference);
    if (!parent)
        return null;
    const ids = top.filter((id) => parent.children.some((child) => child.id === id));
    return { parent, ids };
}
export function groupSelectedGuiNodes(session: EditorSession): void {
    const designer = session.gui;
    const layout = designer.layout();
    const selection = siblingSelection(designer);
    if (!layout || !selection || selection.ids.length === 0)
        return;
    const { parent, ids } = selection;
    const boxes = ids.map((id) => layout.entries.get(id)).filter((entry): entry is GuiLayoutEntry => entry !== undefined).map(entryBox);
    const union = unionBoxes(boxes);
    if (!union)
        return;
    const s = layout.offsetScale;
    const parentFrame = parentContentFrame(layout, parent.id);
    let groupId: string | null = null;
    designer.apply('Agrupar elementos', (document) => {
        const root = document.root;
        const base = createGuiNode('frame', { name: uniqueGuiName(root, 'Grupo') });
        const group: GuiNode = { ...base, appearance: transparentAppearance(), interactable: false, rect: rectFromBox(defaultRect(udim2(0, 0, 0, 0)), union, parentFrame, s) };
        const groupFrame = { width: union.width, height: union.height };
        const children = parent.children
            .filter((child) => ids.includes(child.id))
            .map((child) => {
            const entry = layout.entries.get(child.id);
            if (!entry)
                return child;
            const box = { x: entry.x - union.x, y: entry.y - union.y, width: entry.width, height: entry.height };
            return { ...child, rect: rectFromBox(child.rect, box, groupFrame, s) };
        });
        const index = Math.min(...ids.map((id) => parent.children.findIndex((child) => child.id === id)).filter((value) => value >= 0));
        const without = removeGuiNodes(root, new Set(ids));
        groupId = group.id;
        return { ...document, root: insertGuiNode(without, parent.id, { ...group, children }, index) };
    });
    if (groupId)
        designer.select([groupId]);
}
export function ungroupSelectedGuiNodes(session: EditorSession): void {
    const designer = session.gui;
    const layout = designer.layout();
    if (!layout || !designer.document)
        return;
    const groups = topLevelGuiIds(designer.document.root, [...designer.selectedIds])
        .map((id) => findGuiNode(designer.document!.root, id))
        .filter((node): node is GuiNode => node !== null && isGuiContainer(node) && node.children.length > 0);
    if (groups.length === 0)
        return;
    const released: string[] = [];
    designer.apply(`Desagrupar ${plural(groups.length, 'quadro', 'quadros')}`, (document) => {
        let root = document.root;
        const s = layout.offsetScale;
        for (const group of groups) {
            const parent = findGuiParent(root, group.id);
            const groupEntry = layout.entries.get(group.id);
            if (!parent || !groupEntry)
                continue;
            const parentFrame = parentContentFrame(layout, parent.id);
            const padding = group.layout.padding;
            const children = group.children.map((child) => {
                const entry = layout.entries.get(child.id);
                if (!entry)
                    return child;
                const box = { x: groupEntry.x + padding.left * s + entry.x, y: groupEntry.y + padding.top * s + entry.y, width: entry.width, height: entry.height };
                return { ...child, rect: rectFromBox(child.rect, box, parentFrame, s) };
            });
            const index = parent.children.findIndex((child) => child.id === group.id);
            root = removeGuiNodes(root, new Set([group.id]));
            children.forEach((child, offset) => {
                root = insertGuiNode(root, parent.id, child, index + offset);
                released.push(child.id);
            });
        }
        return { ...document, root };
    });
    if (released.length > 0)
        designer.select(released);
}
export function reorderSelectedGuiNodes(session: EditorSession, direction: GuiReorder): void {
    const designer = session.gui;
    if (!designer.document)
        return;
    const ids = topLevelGuiIds(designer.document.root, [...designer.selectedIds]);
    if (ids.length === 0)
        return;
    const labels: Record<GuiReorder, string> = { front: 'Trazer para a frente', forward: 'Avançar', backward: 'Recuar', back: 'Enviar para trás' };
    designer.apply(labels[direction], (document) => {
        let root = document.root;
        const ordered = [...ids].sort((a, b) => indexIn(root, a) - indexIn(root, b));
        const sequence = direction === 'front' || direction === 'backward' ? ordered : [...ordered].reverse();
        for (const id of sequence) {
            const parent = findGuiParent(root, id);
            if (!parent)
                continue;
            const current = parent.children.findIndex((child) => child.id === id);
            const count = parent.children.length;
            const target = direction === 'front' ? count : direction === 'back' ? 0 : direction === 'forward' ? Math.min(count, current + 2) : Math.max(0, current - 1);
            root = moveGuiNode(root, id, parent.id, target);
        }
        return { ...document, root };
    });
}
function indexIn(root: GuiNode, id: string): number {
    const parent = findGuiParent(root, id);
    return parent ? parent.children.findIndex((child) => child.id === id) : -1;
}
export function alignSelectedGuiNodes(session: EditorSession, alignment: GuiAlignment): void {
    const designer = session.gui;
    const layout = designer.layout();
    const selection = siblingSelection(designer);
    if (!layout || !selection || selection.ids.length === 0)
        return;
    const { parent, ids } = selection;
    if (parent.layout.kind !== 'none') {
        session.log.info(LOG_SOURCE, `${parent.name} usa layout automático: o alinhamento �� controlado pelas opções do layout.`);
        return;
    }
    const s = layout.offsetScale;
    const frame = parentContentFrame(layout, parent.id);
    const entries = ids.map((id) => layout.entries.get(id)).filter((entry): entry is GuiLayoutEntry => entry !== undefined);
    const reference: GuiBox = entries.length === 1 ? { x: 0, y: 0, width: frame.width, height: frame.height } : (unionBoxes(entries.map(entryBox)) ?? { x: 0, y: 0, width: frame.width, height: frame.height });
    const labels: Record<GuiAlignment, string> = { left: 'Alinhar à esquerda', hcenter: 'Centralizar na horizontal', right: 'Alinhar à direita', top: 'Alinhar ao topo', vcenter: 'Centralizar na vertical', bottom: 'Alinhar à base' };
    designer.updateNodes(labels[alignment], ids, (node) => {
        const entry = layout.entries.get(node.id);
        if (!entry)
            return node;
        const box = entryBox(entry);
        let x = box.x;
        let y = box.y;
        switch (alignment) {
            case 'left':
                x = reference.x;
                break;
            case 'hcenter':
                x = reference.x + (reference.width - box.width) / 2;
                break;
            case 'right':
                x = reference.x + reference.width - box.width;
                break;
            case 'top':
                y = reference.y;
                break;
            case 'vcenter':
                y = reference.y + (reference.height - box.height) / 2;
                break;
            case 'bottom':
                y = reference.y + reference.height - box.height;
                break;
        }
        return { ...node, rect: rectFromBox(node.rect, { ...box, x, y }, frame, s) };
    });
}
export function distributeSelectedGuiNodes(session: EditorSession, axis: 'x' | 'y'): void {
    const designer = session.gui;
    const layout = designer.layout();
    const selection = siblingSelection(designer);
    if (!layout || !selection || selection.ids.length < 3)
        return;
    const { parent, ids } = selection;
    if (parent.layout.kind !== 'none')
        return;
    const s = layout.offsetScale;
    const frame = parentContentFrame(layout, parent.id);
    const entries = ids
        .map((id) => layout.entries.get(id))
        .filter((entry): entry is GuiLayoutEntry => entry !== undefined)
        .sort((a, b) => (axis === 'x' ? a.x - b.x : a.y - b.y));
    const first = entries[0];
    const last = entries[entries.length - 1];
    const span = axis === 'x' ? last.x + last.width - first.x : last.y + last.height - first.y;
    const occupied = entries.reduce((total, entry) => total + (axis === 'x' ? entry.width : entry.height), 0);
    const gap = (span - occupied) / (entries.length - 1);
    const positions = new Map<string, number>();
    let cursor = axis === 'x' ? first.x : first.y;
    for (const entry of entries) {
        positions.set(entry.node.id, cursor);
        cursor += (axis === 'x' ? entry.width : entry.height) + gap;
    }
    designer.updateNodes(axis === 'x' ? 'Distribuir na horizontal' : 'Distribuir na vertical', ids, (node) => {
        const entry = layout.entries.get(node.id);
        const position = positions.get(node.id);
        if (!entry || position === undefined)
            return node;
        const box = entryBox(entry);
        return { ...node, rect: rectFromBox(node.rect, axis === 'x' ? { ...box, x: position } : { ...box, y: position }, frame, s) };
    });
}
export function nudgeSelectedGuiNodes(session: EditorSession, dx: number, dy: number): void {
    const designer = session.gui;
    if (!designer.document)
        return;
    const ids = topLevelGuiIds(designer.document.root, [...designer.selectedIds]);
    if (ids.length === 0)
        return;
    designer.updateNodes('Mover elementos', ids, (node) => ({ ...node, rect: shiftRect(node.rect, dx, dy) }), 'gui-nudge');
}
export interface GuiBoxChange {
    readonly id: string;
    readonly box: GuiBox;
}
export function setGuiNodeBoxes(session: EditorSession, changes: readonly GuiBoxChange[], label: string, mergeKey: string): void {
    const designer = session.gui;
    const layout = designer.layout();
    if (!layout || changes.length === 0)
        return;
    const s = layout.offsetScale;
    const byId = new Map(changes.map((change) => [change.id, change.box]));
    designer.updateNodes(label, byId.keys(), (node) => {
        const entry = layout.entries.get(node.id);
        const box = byId.get(node.id);
        if (!entry || !box)
            return node;
        const frame = parentContentFrame(layout, entry.parentId);
        const rect = rectFromBox(node.rect, box, frame, s);
        const widthChanged = Math.abs(box.width - entry.width) > 0.01;
        const heightChanged = Math.abs(box.height - entry.height) > 0.01;
        let autoSize = rect.autoSize;
        if (widthChanged && (autoSize === 'x' || autoSize === 'xy'))
            autoSize = autoSize === 'xy' ? 'y' : 'none';
        if (heightChanged && (autoSize === 'y' || autoSize === 'xy'))
            autoSize = autoSize === 'xy' ? 'x' : 'none';
        return { ...node, rect: { ...rect, autoSize } };
    }, mergeKey);
}
export function setSelectedRotation(session: EditorSession, rotation: number, mergeKey?: string): void {
    session.gui.updateSelected('Girar elementos', (node) => ({ ...node, rect: { ...node.rect, rotation } }), mergeKey);
}
export function setSelectedAnchorPreset(session: EditorSession, presetId: string): void {
    const designer = session.gui;
    const layout = designer.layout();
    const preset = GUI_ANCHOR_PRESETS.find((candidate) => candidate.id === presetId);
    if (!layout || !preset)
        return;
    designer.updateSelected(`Ancorar em ${preset.label.toLowerCase()}`, (node) => {
        const entry = layout.entries.get(node.id);
        if (!entry)
            return node;
        return { ...node, rect: withAnchorPreset(node.rect, entryBox(entry), parentContentFrame(layout, entry.parentId), layout.offsetScale, preset.anchor) };
    });
}
export function setSelectedAnchor(session: EditorSession, anchor: GuiPoint): void {
    const designer = session.gui;
    const layout = designer.layout();
    if (!layout)
        return;
    designer.updateSelected('Alterar ponto de âncora', (node) => {
        const entry = layout.entries.get(node.id);
        if (!entry)
            return node;
        return { ...node, rect: withAnchor(node.rect, entryBox(entry), parentContentFrame(layout, entry.parentId), layout.offsetScale, anchor) };
    });
}
export function convertSelectedUnits(session: EditorSession, mode: 'proportional' | 'pixels', target: GuiUnitTarget): void {
    const designer = session.gui;
    const layout = designer.layout();
    if (!layout)
        return;
    designer.updateSelected(mode === 'proportional' ? 'Converter para proporcional' : 'Converter para pixels', (node) => {
        const entry = layout.entries.get(node.id);
        if (!entry)
            return node;
        const box = entryBox(entry);
        const rect = mode === 'proportional' ? toProportional(node.rect, box, parentContentFrame(layout, entry.parentId), target) : toPixels(node.rect, box, layout.offsetScale, target);
        return { ...node, rect };
    });
}
export function moveGuiNodeTo(session: EditorSession, id: string, parentId: string, index: number, keepPlace = true, mergeKey?: string): void {
    const designer = session.gui;
    const layout = designer.layout();
    if (!layout || !designer.document)
        return;
    const node = findGuiNode(designer.document.root, id);
    const target = findGuiNode(designer.document.root, parentId);
    if (!node || !target || !isGuiContainer(target))
        return;
    const entry = layout.entries.get(id);
    const currentParent = findGuiParent(designer.document.root, id);
    let rect = node.rect;
    if (keepPlace && entry && currentParent && currentParent.id !== parentId && target.layout.kind === 'none') {
        const screen = applyMatrix(entry.world, 0, 0);
        const local = screenPointToParent(layout, parentId, screen.x, screen.y);
        rect = rectFromBox(node.rect, { x: local.x, y: local.y, width: entry.width, height: entry.height }, parentContentFrame(layout, parentId), layout.offsetScale);
    }
    designer.apply(`Mover ${node.name} para ${target.name}`, (document) => {
        const moved = moveGuiNode(document.root, id, parentId, index);
        if (moved === document.root)
            return document;
        return { ...document, root: rect === node.rect ? moved : updateGuiNode(moved, id, (current) => ({ ...current, rect })) };
    }, mergeKey);
}
export function renameGuiNode(session: EditorSession, id: string, name: string): void {
    const designer = session.gui;
    if (!designer.document)
        return;
    const trimmed = name.trim();
    const node = findGuiNode(designer.document.root, id);
    if (!node || !trimmed || trimmed === node.name)
        return;
    const unique = uniqueGuiName(designer.document.root, trimmed, id);
    designer.updateNodes(`Renomear ${node.name} para ${unique}`, [id], (current) => ({ ...current, name: unique }));
}
export function setGuiNodesVisible(session: EditorSession, ids: readonly string[], visible: boolean): void {
    session.gui.updateNodes(visible ? 'Mostrar elementos' : 'Ocultar elementos', ids, (node) => (node.visible === visible ? node : { ...node, visible }));
}
export function setGuiNodesLocked(session: EditorSession, ids: readonly string[], locked: boolean): void {
    const designer = session.gui;
    designer.updateNodes(locked ? 'Bloquear elementos' : 'Desbloquear elementos', ids, (node) => (node.locked === locked ? node : { ...node, locked }));
    if (locked)
        designer.select([...designer.selectedIds].filter((id) => !ids.includes(id)));
}
export function selectGuiParent(session: EditorSession): void {
    const designer = session.gui;
    if (!designer.document || !designer.primaryId)
        return;
    const parent = findGuiParent(designer.document.root, designer.primaryId);
    if (parent && parent.id !== GUI_ROOT_ID)
        designer.select([parent.id]);
}
