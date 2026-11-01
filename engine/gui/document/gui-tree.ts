import { createGuiId, GUI_ROOT_ID, type GuiNode } from './gui-document';
export interface GuiFlatEntry {
    readonly node: GuiNode;
    readonly parent: GuiNode | null;
    readonly depth: number;
    readonly index: number;
}
export function findGuiNode(root: GuiNode, id: string): GuiNode | null {
    if (root.id === id)
        return root;
    for (const child of root.children) {
        const found = findGuiNode(child, id);
        if (found)
            return found;
    }
    return null;
}
export function findGuiParent(root: GuiNode, id: string): GuiNode | null {
    for (const child of root.children) {
        if (child.id === id)
            return root;
        const found = findGuiParent(child, id);
        if (found)
            return found;
    }
    return null;
}
export function guiAncestors(root: GuiNode, id: string): GuiNode[] {
    const path: GuiNode[] = [];
    const visit = (node: GuiNode): boolean => {
        if (node.id === id)
            return true;
        path.push(node);
        for (const child of node.children)
            if (visit(child))
                return true;
        path.pop();
        return false;
    };
    return visit(root) ? path : [];
}
export function isGuiDescendant(root: GuiNode, ancestorId: string, id: string): boolean {
    return guiAncestors(root, id).some((node) => node.id === ancestorId);
}
export function walkGui(node: GuiNode, visit: (node: GuiNode, parent: GuiNode | null, depth: number) => void, parent: GuiNode | null = null, depth = 0): void {
    visit(node, parent, depth);
    for (const child of node.children)
        walkGui(child, visit, node, depth + 1);
}
export function flattenGui(root: GuiNode): GuiFlatEntry[] {
    const entries: GuiFlatEntry[] = [];
    const visit = (node: GuiNode, depth: number) => {
        node.children.forEach((child, index) => {
            entries.push({ node: child, parent: node, depth, index });
            visit(child, depth + 1);
        });
    };
    visit(root, 0);
    return entries;
}
export function collectGuiIds(node: GuiNode, into: Set<string> = new Set()): Set<string> {
    into.add(node.id);
    for (const child of node.children)
        collectGuiIds(child, into);
    return into;
}
export function countGuiNodes(root: GuiNode): number {
    return collectGuiIds(root).size - 1;
}
export function updateGuiNode(root: GuiNode, id: string, update: (node: GuiNode) => GuiNode): GuiNode {
    if (root.id === id)
        return update(root);
    let changed = false;
    const children = root.children.map((child) => {
        const next = updateGuiNode(child, id, update);
        if (next !== child)
            changed = true;
        return next;
    });
    return changed ? { ...root, children } : root;
}
export function updateGuiNodes(root: GuiNode, ids: Iterable<string>, update: (node: GuiNode) => GuiNode): GuiNode {
    let next = root;
    for (const id of ids)
        next = updateGuiNode(next, id, update);
    return next;
}
export function removeGuiNodes(root: GuiNode, ids: ReadonlySet<string>): GuiNode {
    let changed = false;
    const children: GuiNode[] = [];
    for (const child of root.children) {
        if (ids.has(child.id)) {
            changed = true;
            continue;
        }
        const next = removeGuiNodes(child, ids);
        if (next !== child)
            changed = true;
        children.push(next);
    }
    return changed ? { ...root, children } : root;
}
export function insertGuiNode(root: GuiNode, parentId: string, node: GuiNode, index?: number): GuiNode {
    return updateGuiNode(root, parentId, (parent) => {
        const children = [...parent.children];
        const at = index === undefined ? children.length : Math.max(0, Math.min(children.length, index));
        children.splice(at, 0, node);
        return { ...parent, children };
    });
}
export function moveGuiNode(root: GuiNode, id: string, parentId: string, index: number): GuiNode {
    if (id === GUI_ROOT_ID || id === parentId || isGuiDescendant(root, id, parentId))
        return root;
    const node = findGuiNode(root, id);
    const oldParent = findGuiParent(root, id);
    if (!node || !oldParent)
        return root;
    let target = index;
    if (oldParent.id === parentId) {
        const current = oldParent.children.indexOf(node);
        if (current < target)
            target -= 1;
        if (current === target)
            return root;
    }
    const without = removeGuiNodes(root, new Set([id]));
    return insertGuiNode(without, parentId, node, target);
}
export function cloneGuiNode(node: GuiNode, rename: (name: string) => string = (name) => name): GuiNode {
    return { ...node, id: createGuiId(), name: rename(node.name), locked: false, children: node.children.map((child) => cloneGuiNode(child)) };
}
export function topLevelGuiIds(root: GuiNode, ids: readonly string[]): string[] {
    const set = new Set(ids);
    return ids.filter((id) => id !== GUI_ROOT_ID && !guiAncestors(root, id).some((ancestor) => set.has(ancestor.id)));
}
export function orderedGuiChildren(node: GuiNode): GuiNode[] {
    return node.children
        .map((child, index) => ({ child, index }))
        .sort((a, b) => a.child.rect.zIndex - b.child.rect.zIndex || a.index - b.index)
        .map((entry) => entry.child);
}
export function uniqueGuiName(root: GuiNode, base: string, exclude: string | null = null): string {
    const names = new Set<string>();
    walkGui(root, (node) => {
        if (node.id !== exclude)
            names.add(node.name);
    });
    if (!names.has(base))
        return base;
    const match = /^(.*?)(?: (\d+))?$/.exec(base);
    const stem = match?.[1] ?? base;
    let counter = match?.[2] ? Number(match[2]) + 1 : 2;
    while (names.has(`${stem} ${counter}`))
        counter += 1;
    return `${stem} ${counter}`;
}
