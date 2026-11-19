'use client';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS, MENU_SHORTCUT_CLASS } from '@/engine/editor/menus/menu-styles';
import { formatChord } from '@/engine/editor/shortcuts/key-chord';
import { useEngineSetting } from '@/engine/settings/engine-settings-store';
import type { MenuTarget } from '../../menus/menu-contribution';
import type { MenuItemNode, MenuNode } from '../../menus/menu-tree';
import { extensionIcon } from '../extension-icon';
import { MENU_KITS, type MenuFlavor } from './menu-kits';
function MenuItemView({ node, target, menu, separated }: {
    node: MenuItemNode;
    target: MenuTarget;
    menu: MenuFlavor;
    separated: boolean;
}) {
    const kit = MENU_KITS[menu];
    const shortcutsVisible = useEngineSetting('editor.ui.menuShortcuts');
    const { contribution } = node;
    const Icon = contribution.icon === null ? null : extensionIcon(contribution.icon);
    const disabled = !contribution.isEnabled(target);
    const content = (<>
      {Icon && <Icon aria-hidden/>}
      {node.label}
      {shortcutsVisible && contribution.shortcut && <kit.Shortcut className={MENU_SHORTCUT_CLASS}>{formatChord(contribution.shortcut)}</kit.Shortcut>}
    </>);
    return (<>
      {separated && <kit.Separator />}
      {contribution.checkable ? (<kit.CheckboxItem className={MENU_ITEM_CLASS} disabled={disabled} checked={contribution.isChecked(target)} onCheckedChange={() => contribution.run(target)}>
          {content}
        </kit.CheckboxItem>) : (<kit.Item className={MENU_ITEM_CLASS} disabled={disabled} onClick={() => contribution.run(target)}>
          {content}
        </kit.Item>)}
    </>);
}
export function ExtensionMenuNodes({ nodes, target, menu }: {
    nodes: readonly MenuNode[];
    target: MenuTarget;
    menu: MenuFlavor;
}) {
    const kit = MENU_KITS[menu];
    return (<>
      {nodes.map((node, index) => node.kind === 'submenu' ? (<kit.Sub key={node.key}>
            <kit.SubTrigger className={MENU_ITEM_CLASS}>{node.label}</kit.SubTrigger>
            <kit.SubContent className={MENU_CONTENT_CLASS}>
              <ExtensionMenuNodes nodes={node.children} target={target} menu={menu}/>
            </kit.SubContent>
          </kit.Sub>) : (<MenuItemView key={node.key} node={node} target={target} menu={menu} separated={index > 0 && node.contribution.separatorBefore}/>))}
    </>);
}
