import type { MenuContribution, MenuLocation } from './menu-contribution';
import { menuLabelKey } from './menu-path';
export const BUILTIN_MENU_LABELS: readonly string[] = ['Arquivo', 'Editar', 'Interface', 'Código', 'Simular', 'Exibir', 'Extensões', 'Ajuda'];
const BUILTIN_MENU_KEYS = new Set(BUILTIN_MENU_LABELS.map(menuLabelKey));
export interface MenuItemNode {
    readonly kind: 'item';
    readonly key: string;
    readonly label: string;
    readonly order: number;
    readonly contribution: MenuContribution;
}
export interface MenuSubmenuNode {
    readonly kind: 'submenu';
    readonly key: string;
    readonly label: string;
    order: number;
    readonly children: MenuNode[];
}
export type MenuNode = MenuItemNode | MenuSubmenuNode;
function insert(nodes: MenuNode[], segments: readonly string[], contribution: MenuContribution, parentKey: string): void {
    const [label, ...rest] = segments;
    const key = `${parentKey}/${menuLabelKey(label)}`;
    if (rest.length === 0) {
        nodes.push({ kind: 'item', key: `${key}#item`, label, order: contribution.order, contribution });
        return;
    }
    let submenu = nodes.find((node): node is MenuSubmenuNode => node.kind === 'submenu' && node.key === key);
    if (!submenu) {
        submenu = { kind: 'submenu', key, label, order: contribution.order, children: [] };
        nodes.push(submenu);
    }
    submenu.order = Math.min(submenu.order, contribution.order);
    insert(submenu.children, rest, contribution, key);
}
function sortByOrder(nodes: MenuNode[]): void {
    nodes.sort((a, b) => a.order - b.order);
    for (const node of nodes)
        if (node.kind === 'submenu')
            sortByOrder(node.children);
}
export function buildMenuTree(contributions: readonly MenuContribution[], location: MenuLocation, root: string | null = null): MenuNode[] {
    const nodes: MenuNode[] = [];
    const rootKey = root === null ? null : menuLabelKey(root);
    for (const contribution of contributions) {
        if (contribution.location !== location)
            continue;
        if (rootKey === null)
            insert(nodes, contribution.path, contribution, location);
        else if (contribution.path.length > 1 && menuLabelKey(contribution.path[0]) === rootKey)
            insert(nodes, contribution.path.slice(1), contribution, `${location}/${rootKey}`);
    }
    sortByOrder(nodes);
    return nodes;
}
export function customMenuLabels(contributions: readonly MenuContribution[]): string[] {
    const menus = new Map<string, {
        label: string;
        order: number;
    }>();
    for (const contribution of contributions) {
        if (contribution.location !== 'main')
            continue;
        const label = contribution.path[0];
        const key = menuLabelKey(label);
        if (BUILTIN_MENU_KEYS.has(key))
            continue;
        const known = menus.get(key);
        if (known)
            known.order = Math.min(known.order, contribution.order);
        else
            menus.set(key, { label, order: contribution.order });
    }
    return Array.from(menus.values())
        .sort((a, b) => a.order - b.order)
        .map((menu) => menu.label);
}
