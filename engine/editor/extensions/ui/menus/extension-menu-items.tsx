'use client';
import type { LibraryAsset } from '@/engine/assets/library/asset-types';
import type { Entity } from '@/engine/core/scene/entity';
import { useEditorSession, useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { selectionMenuTarget } from '../../menus/menu-commands';
import type { MenuLocation, MenuTarget } from '../../menus/menu-contribution';
import { buildMenuTree, customMenuLabels } from '../../menus/menu-tree';
import { useContributions } from '../use-contributions';
import { ExtensionMenuNodes } from './extension-menu-nodes';
import { MENU_KITS, type MenuFlavor } from './menu-kits';
function MenuSection({ location, root, target, menu, separated }: {
    location: MenuLocation;
    root: string | null;
    target: MenuTarget;
    menu: MenuFlavor;
    separated: boolean;
}) {
    const contributions = useContributions(useEditorSession().extensions.menus);
    const nodes = buildMenuTree(contributions, location, root);
    const kit = MENU_KITS[menu];
    if (nodes.length === 0)
        return null;
    return (<>
      {separated && <kit.Separator />}
      <kit.Group>
        <ExtensionMenuNodes nodes={nodes} target={target} menu={menu}/>
      </kit.Group>
    </>);
}
export function ExtensionMainMenuItems({ menu, separated }: {
    menu: string;
    separated: boolean;
}) {
    const session = useSessionTopic('selection');
    return <MenuSection location="main" root={menu} target={selectionMenuTarget(session)} menu="dropdown" separated={separated}/>;
}
export function ExtensionActorMenuItems({ actors }: {
    actors: readonly Entity[];
}) {
    return <MenuSection location="actor" root={null} target={{ actors, asset: null }} menu="context" separated/>;
}
export function ExtensionAssetMenuItems({ asset }: {
    asset: LibraryAsset;
}) {
    const session = useEditorSession();
    return <MenuSection location="asset" root={null} target={{ actors: session.selectedEntities(), asset }} menu="context" separated/>;
}
export function useCustomMenuLabels(): string[] {
    return customMenuLabels(useContributions(useEditorSession().extensions.menus));
}
