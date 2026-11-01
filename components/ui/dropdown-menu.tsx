"use client";
import * as React from "react";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { cn } from "@/lib/utils";
import { ChevronRightIcon, CheckIcon } from "lucide-react";
const MENU_POPUP_CLASS = "z-50 max-h-(--available-height) w-(--anchor-width) min-w-32 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-sm bg-popover p-1 text-popover-foreground shadow-overlay outline-none duration-75 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:overflow-hidden data-closed:fade-out-0";
const MENU_ITEM_BASE_CLASS = "relative flex cursor-default items-center gap-1.5 rounded-xs px-1.5 py-1 text-xs outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-inset:pl-7 data-disabled:pointer-events-none data-disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";
function DropdownMenu({ ...props }: MenuPrimitive.Root.Props) {
    return <MenuPrimitive.Root data-slot="dropdown-menu" {...props}/>;
}
function DropdownMenuPortal({ ...props }: MenuPrimitive.Portal.Props) {
    return <MenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props}/>;
}
function DropdownMenuTrigger({ ...props }: MenuPrimitive.Trigger.Props) {
    return <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props}/>;
}
function DropdownMenuContent({ align = "start", alignOffset = 0, side = "bottom", sideOffset = 4, className, ...props }: MenuPrimitive.Popup.Props & Pick<MenuPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">) {
    return (<MenuPrimitive.Portal>
      <MenuPrimitive.Positioner className="isolate z-50 outline-none" align={align} alignOffset={alignOffset} side={side} sideOffset={sideOffset}>
        <MenuPrimitive.Popup data-slot="dropdown-menu-content" className={cn(MENU_POPUP_CLASS, className)} {...props}/>
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>);
}
function DropdownMenuGroup({ ...props }: MenuPrimitive.Group.Props) {
    return <MenuPrimitive.Group data-slot="dropdown-menu-group" {...props}/>;
}
function DropdownMenuLabel({ className, inset, ...props }: MenuPrimitive.GroupLabel.Props & {
    inset?: boolean;
}) {
    return (<MenuPrimitive.GroupLabel data-slot="dropdown-menu-label" data-inset={inset} className={cn("px-1.5 py-1 text-3xs font-medium tracking-wider text-muted-foreground uppercase data-inset:pl-7", className)} {...props}/>);
}
function DropdownMenuItem({ className, inset, variant = "default", ...props }: MenuPrimitive.Item.Props & {
    inset?: boolean;
    variant?: "default" | "destructive";
}) {
    return (<MenuPrimitive.Item data-slot="dropdown-menu-item" data-inset={inset} data-variant={variant} className={cn("group/dropdown-menu-item", MENU_ITEM_BASE_CLASS, "not-data-[variant=destructive]:focus:**:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:*:[svg]:text-destructive", className)} {...props}/>);
}
function DropdownMenuSub({ ...props }: MenuPrimitive.SubmenuRoot.Props) {
    return <MenuPrimitive.SubmenuRoot data-slot="dropdown-menu-sub" {...props}/>;
}
function DropdownMenuSubTrigger({ className, inset, children, ...props }: MenuPrimitive.SubmenuTrigger.Props & {
    inset?: boolean;
}) {
    return (<MenuPrimitive.SubmenuTrigger data-slot="dropdown-menu-sub-trigger" data-inset={inset} className={cn(MENU_ITEM_BASE_CLASS, "focus:**:text-accent-foreground data-popup-open:bg-highlight data-popup-open:text-foreground data-open:bg-highlight data-open:text-foreground", className)} {...props}>
      {children}
      <ChevronRightIcon className="ml-auto"/>
    </MenuPrimitive.SubmenuTrigger>);
}
function DropdownMenuSubContent({ align = "start", alignOffset = -3, side = "right", sideOffset = 0, className, ...props }: React.ComponentProps<typeof DropdownMenuContent>) {
    return (<DropdownMenuContent data-slot="dropdown-menu-sub-content" className={cn("w-auto min-w-24", className)} align={align} alignOffset={alignOffset} side={side} sideOffset={sideOffset} {...props}/>);
}
function DropdownMenuCheckboxItem({ className, children, checked, inset, ...props }: MenuPrimitive.CheckboxItem.Props & {
    inset?: boolean;
}) {
    return (<MenuPrimitive.CheckboxItem data-slot="dropdown-menu-checkbox-item" data-inset={inset} className={cn(MENU_ITEM_BASE_CLASS, "pl-7 focus:**:text-accent-foreground", className)} checked={checked} {...props}>
      <span className="pointer-events-none absolute left-2 flex items-center justify-center text-primary" data-slot="dropdown-menu-checkbox-item-indicator">
        <MenuPrimitive.CheckboxItemIndicator>
          <CheckIcon strokeWidth={2.5}/>
        </MenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </MenuPrimitive.CheckboxItem>);
}
function DropdownMenuRadioGroup({ ...props }: MenuPrimitive.RadioGroup.Props) {
    return (<MenuPrimitive.RadioGroup data-slot="dropdown-menu-radio-group" {...props}/>);
}
function DropdownMenuRadioItem({ className, children, inset, ...props }: MenuPrimitive.RadioItem.Props & {
    inset?: boolean;
}) {
    return (<MenuPrimitive.RadioItem data-slot="dropdown-menu-radio-item" data-inset={inset} className={cn(MENU_ITEM_BASE_CLASS, "pl-7 focus:**:text-accent-foreground", className)} {...props}>
      <span className="pointer-events-none absolute left-2 flex items-center justify-center text-primary" data-slot="dropdown-menu-radio-item-indicator">
        <MenuPrimitive.RadioItemIndicator>
          <CheckIcon strokeWidth={2.5}/>
        </MenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </MenuPrimitive.RadioItem>);
}
function DropdownMenuSeparator({ className, ...props }: MenuPrimitive.Separator.Props) {
    return (<MenuPrimitive.Separator data-slot="dropdown-menu-separator" className={cn("-mx-1 my-1 h-px bg-border shadow-[0_1px_0_0_var(--bevel)]", className)} {...props}/>);
}
function DropdownMenuShortcut({ className, ...props }: React.ComponentProps<"span">) {
    return (<span data-slot="dropdown-menu-shortcut" className={cn("ml-auto font-mono text-3xs text-muted-foreground group-focus/dropdown-menu-item:text-accent-foreground", className)} {...props}/>);
}
export { DropdownMenu, DropdownMenuPortal, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, };
