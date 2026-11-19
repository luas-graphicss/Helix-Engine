import { menuContributionId, type MenuContribution, type MenuLocation, type MenuTarget } from '@/engine/editor/extensions/menus/menu-contribution';
import { menuLabelKey, parseMenuPath } from '@/engine/editor/extensions/menus/menu-path';
import { findMenuByShortcut, normalizeShortcut } from '@/engine/editor/extensions/menus/menu-shortcut';
import { buildMenuTree, customMenuLabels, type MenuNode } from '@/engine/editor/extensions/menus/menu-tree';
import { createCheckList } from '../../support/check-list';
const checks = createCheckList('Menus das extensões');
const NO_TARGET: MenuTarget = { actors: [], asset: null };
interface MenuSetup {
    readonly location?: MenuLocation;
    readonly order?: number;
    readonly shortcut?: string | null;
    readonly enabled?: boolean;
}
function menu(path: string, setup: MenuSetup = {}): MenuContribution {
    const location = setup.location ?? 'main';
    const segments = parseMenuPath(path) ?? [];
    return {
        id: menuContributionId(location, segments),
        location,
        path: segments,
        icon: null,
        order: setup.order ?? 0,
        shortcut: setup.shortcut ?? null,
        separatorBefore: false,
        checkable: false,
        run: () => undefined,
        isEnabled: () => setup.enabled !== false,
        isChecked: () => false,
    };
}
function outline(nodes: readonly MenuNode[]): string {
    return nodes.map((node) => (node.kind === 'item' ? node.label : `${node.label}[${outline(node.children)}]`)).join(',');
}
function keyEvent(code: string, modifiers: Partial<Pick<KeyboardEvent, 'ctrlKey' | 'shiftKey' | 'altKey' | 'metaKey'>> = {}): KeyboardEvent {
    return { code, key: code.replace('Key', '').toLowerCase(), ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, ...modifiers } as KeyboardEvent;
}
function paths(): void {
    checks.check('parseMenuPath separa por barra e apara os espaços', parseMenuPath(' Ferramentas / Alinhar ')?.join('|') === 'Ferramentas|Alinhar');
    checks.check('um nome vazio invalida o caminho', parseMenuPath('Ferramentas//Alinhar') === null && parseMenuPath('') === null);
    checks.check('mais de cinco níveis invalida o caminho', parseMenuPath('a/b/c/d/e/f') === null && parseMenuPath('a/b/c/d/e') !== null);
    checks.check('menuLabelKey ignora caixa e acentos', menuLabelKey('Código') === menuLabelKey('codigo'));
    checks.check('o id junta o local e o caminho normalizado', menuContributionId('main', ['Extensões', 'Girar']) === 'main:extensoes/girar', menuContributionId('main', ['Extensões', 'Girar']));
}
function trees(): void {
    const contributions = [
        menu('Ferramentas/Alinhar/Ao chão', { order: 5 }),
        menu('Ferramentas/Medir'),
        menu('Ferramentas/Alinhar/À grade', { order: 1 }),
        menu('editar/Inverter seleção'),
        menu('Girar 90°', { location: 'actor' }),
        menu('Lote/Renomear', { location: 'asset' }),
    ];
    checks.check('o menu reúne os itens do mesmo nome de topo', outline(buildMenuTree(contributions, 'main', 'Ferramentas')) === 'Medir,Alinhar[À grade,Ao chão]', outline(buildMenuTree(contributions, 'main', 'Ferramentas')));
    checks.check('um submenu herda a menor ordem dos filhos', buildMenuTree(contributions, 'main', 'Ferramentas')[1].order === 1);
    checks.check('o nome de topo casa com o menu embutido sem depender da caixa', outline(buildMenuTree(contributions, 'main', 'Editar')) === 'Inverter seleção');
    checks.check('um menu sem itens devolve uma árvore vazia', buildMenuTree(contributions, 'main', 'Ajuda').length === 0);
    checks.check('os menus de contexto usam o caminho inteiro', outline(buildMenuTree(contributions, 'actor')) === 'Girar 90°' && outline(buildMenuTree(contributions, 'asset')) === 'Lote[Renomear]');
    checks.check('só os menus fora da barra embutida viram menus novos', customMenuLabels(contributions).join(',') === 'Ferramentas', customMenuLabels(contributions).join(','));
    const ordered = [menu('Zeta/Item', { order: 1 }), menu('Alfa/Item', { order: 2 }), menu('zeta/Outro', { order: 9 })];
    checks.check('os menus novos seguem a ordem e não se repetem', customMenuLabels(ordered).join(',') === 'Zeta,Alfa', customMenuLabels(ordered).join(','));
    const keys = new Set<string>();
    const collect = (nodes: readonly MenuNode[]): void => nodes.forEach((node) => {
        keys.add(node.key);
        if (node.kind === 'submenu')
            collect(node.children);
    });
    collect(buildMenuTree([menu('Ferramentas/Alinhar'), menu('Ferramentas/Alinhar/Ao chão')], 'main', 'Ferramentas'));
    checks.check('um item e um submenu de mesmo nome têm chaves distintas', keys.size === 3, String(keys.size));
}
function shortcuts(): void {
    checks.check('normalizeShortcut aceita o formato com sinais de mais', normalizeShortcut('Ctrl+Shift+G') === 'ctrl shift g', String(normalizeShortcut('Ctrl+Shift+G')));
    checks.check('a ordem dos modificadores não importa', normalizeShortcut('shift+alt+ctrl+k') === 'ctrl shift alt k');
    checks.check('Cmd vale por Ctrl e Del por Delete', normalizeShortcut('Cmd+Del') === 'ctrl delete', String(normalizeShortcut('Cmd+Del')));
    checks.check('um atalho só com modificadores é recusado', normalizeShortcut('Ctrl+Shift') === null && normalizeShortcut('') === null);
    checks.check('um modificador desconhecido é recusado', normalizeShortcut('Super+G') === null);
    const contributions = [menu('Ferramentas/Parado', { shortcut: 'ctrl shift g', enabled: false }), menu('Ferramentas/Apoiar', { shortcut: 'ctrl shift g' }), menu('Ferramentas/Medir', { shortcut: 'm' })];
    const found = findMenuByShortcut(contributions, keyEvent('KeyG', { ctrlKey: true, shiftKey: true }), NO_TARGET);
    checks.check('o atalho encontra o primeiro item ligado', found?.path[1] === 'Apoiar', found?.path.join('/'));
    checks.check('uma tecla sem modificador também é atalho', findMenuByShortcut(contributions, keyEvent('KeyM'), NO_TARGET)?.path[1] === 'Medir');
    checks.check('uma combinação sem dono não encontra nada', findMenuByShortcut(contributions, keyEvent('KeyG', { ctrlKey: true }), NO_TARGET) === null);
    checks.check('pressionar só o modificador não dispara', findMenuByShortcut(contributions, { ...keyEvent('ControlLeft'), key: 'Control', ctrlKey: true } as KeyboardEvent, NO_TARGET) === null);
}
paths();
trees();
shortcuts();
checks.finish();
