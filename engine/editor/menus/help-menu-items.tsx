'use client';
import { BookOpen, Braces, GraduationCap, Info, Keyboard, MessagesSquare } from 'lucide-react';
import { DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { editorDialogs } from '../dialogs/editor-dialogs';
import { openApiReference, openDocumentation, openTutorial } from '../operations/help-operations';
import { MenuShortcut } from './menu-shortcut';
import { MENU_ITEM_CLASS } from './menu-styles';
function SoonBadge() {
    return <span className="ml-auto rounded-xs border border-border-strong px-1 py-px font-mono text-3xs tracking-wider text-muted-foreground uppercase">Em breve</span>;
}
export function HelpMenuItems() {
    return (<>
      <DropdownMenuGroup>
        <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => openDocumentation()}>
          <BookOpen aria-hidden/>
          Documentação
          <MenuShortcut action="help.documentation"/>
        </DropdownMenuItem>
        <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => openTutorial()}>
          <GraduationCap aria-hidden/>
          Tutorial
          <MenuShortcut action="help.tutorial"/>
        </DropdownMenuItem>
        <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => openApiReference()}>
          <Braces aria-hidden/>
          Referência da API
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem className={MENU_ITEM_CLASS} disabled>
          <MessagesSquare aria-hidden/>
          Dev Fórum
          <SoonBadge />
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => editorDialogs.open('shortcuts')}>
          <Keyboard aria-hidden/>
          Atalhos de teclado…
          <MenuShortcut action="helix.shortcuts"/>
        </DropdownMenuItem>
        <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => editorDialogs.open('about')}>
          <Info aria-hidden/>
          Sobre a Helix Engine
          <MenuShortcut action="helix.about"/>
        </DropdownMenuItem>
      </DropdownMenuGroup>
    </>);
}
