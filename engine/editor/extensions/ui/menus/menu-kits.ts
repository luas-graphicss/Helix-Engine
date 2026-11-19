import { ContextMenuCheckboxItem, ContextMenuGroup, ContextMenuItem, ContextMenuSeparator, ContextMenuShortcut, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger } from '@/components/ui/context-menu';
import { DropdownMenuCheckboxItem, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from '@/components/ui/dropdown-menu';
export const MENU_KITS = {
    dropdown: {
        Group: DropdownMenuGroup,
        Item: DropdownMenuItem,
        CheckboxItem: DropdownMenuCheckboxItem,
        Separator: DropdownMenuSeparator,
        Shortcut: DropdownMenuShortcut,
        Sub: DropdownMenuSub,
        SubTrigger: DropdownMenuSubTrigger,
        SubContent: DropdownMenuSubContent,
    },
    context: {
        Group: ContextMenuGroup,
        Item: ContextMenuItem,
        CheckboxItem: ContextMenuCheckboxItem,
        Separator: ContextMenuSeparator,
        Shortcut: ContextMenuShortcut,
        Sub: ContextMenuSub,
        SubTrigger: ContextMenuSubTrigger,
        SubContent: ContextMenuSubContent,
    },
} as const;
export type MenuFlavor = keyof typeof MENU_KITS;
