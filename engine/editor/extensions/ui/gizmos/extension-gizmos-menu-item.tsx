'use client';
import { Shapes } from 'lucide-react';
import { DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu';
import { MENU_ITEM_CLASS } from '@/engine/editor/menus/menu-styles';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { useContributions } from '../use-contributions';
export function ExtensionGizmosMenuItem() {
    const { extensions } = useSessionTopic('view');
    const gizmos = useContributions(extensions.gizmos);
    const { gizmoLayer } = extensions;
    if (gizmos.length === 0)
        return null;
    return (<DropdownMenuCheckboxItem className={MENU_ITEM_CLASS} checked={gizmoLayer.visible} onCheckedChange={() => gizmoLayer.setVisible(!gizmoLayer.visible)}>
      <Shapes aria-hidden/>
      Gizmos das extensões ({gizmos.length})
    </DropdownMenuCheckboxItem>);
}
