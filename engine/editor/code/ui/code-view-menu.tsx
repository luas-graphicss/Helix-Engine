'use client';
import type { ComponentType, SVGProps } from 'react';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger, } from '@/components/ui/dropdown-menu';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS, MENU_LABEL_CLASS } from '@/engine/editor/menus/menu-styles';
import { revealCodeEditor } from '@/engine/editor/operations/script-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { openSettingsSection } from '@/engine/settings/ui/settings-navigation';
import { IconButton } from '@/engine/ui/icon-button';
import { cn } from '@/lib/utils';
import { CODE_PRESENTATION_HINT, CODE_PRESENTATION_LABEL, CODE_PRESENTATIONS, type CodePresentation } from '../code-editor';
import { CODE_FONT_SIZE_DEFAULT, CODE_FONT_SIZE_MAX, CODE_FONT_SIZE_MIN, resetCodeFontSize, stepCodeFontSize, toggleCodeOption, type CodeToggleKey } from '../code-preferences';
import { BrowserTabIcon, ChevronDownIcon, FloatingWindowIcon, PlusIcon, PreferencesIcon, ViewOptionsIcon, WorkspaceIcon } from '../icons/code-icons';
import { useCodeSelector } from './use-code-editor';
type Icon = ComponentType<SVGProps<SVGSVGElement>>;
export const CODE_PRESENTATION_ICON: Record<CodePresentation, Icon> = { workspace: WorkspaceIcon, window: FloatingWindowIcon, tab: BrowserTabIcon };
const VIEW_GROUPS: ReadonlyArray<{
    title: string;
    toggles: ReadonlyArray<{
        key: CodeToggleKey;
        label: string;
    }>;
}> = [
    {
        title: 'Texto',
        toggles: [
            { key: 'lineNumbers', label: 'Números de linha' },
            { key: 'folding', label: 'Dobrar blocos' },
            { key: 'indentGuides', label: 'Guias de indentação' },
            { key: 'highlightLine', label: 'Destacar a linha do cursor' },
            { key: 'wordWrap', label: 'Quebrar linhas longas' },
            { key: 'whitespace', label: 'Espaços e tabulações' },
            { key: 'minimap', label: 'Minimapa' },
        ],
    },
    {
        title: 'Ao digitar',
        toggles: [
            { key: 'autoSuggest', label: 'Sugestões automáticas' },
            { key: 'autoCloseBrackets', label: 'Fechar parênteses e aspas' },
            { key: 'selectionMatches', label: 'Realçar ocorrências da seleção' },
            { key: 'cursorBlink', label: 'Cursor piscante' },
        ],
    },
    {
        title: 'Abas e rodapé',
        toggles: [
            { key: 'previewTabs', label: 'Abas de visualização' },
            { key: 'statusStrip', label: 'Faixa de status' },
        ],
    },
];
function MinusGlyph(props: SVGProps<SVGSVGElement>) {
    return (<svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden {...props}>
      <path d="M3.5 8h9"/>
    </svg>);
}
export function CodeViewOptionsMenu() {
    const options = useCodeSelector((current) => current.options);
    return (<DropdownMenu>
      <DropdownMenuTrigger render={<IconButton label="Opções de vista" size="md" className="data-[popup-open]:bg-highlight data-[popup-open]:text-foreground"/>}>
        <ViewOptionsIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={4} className={cn(MENU_CONTENT_CLASS, 'w-64')}>
        {VIEW_GROUPS.map((group, index) => (<DropdownMenuGroup key={group.title}>
            {index > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className={MENU_LABEL_CLASS}>{group.title}</DropdownMenuLabel>
            {group.toggles.map(({ key, label }) => (<DropdownMenuCheckboxItem key={key} className={MENU_ITEM_CLASS} checked={options[key]} closeOnClick={false} onCheckedChange={() => toggleCodeOption(key)}>
                {label}
              </DropdownMenuCheckboxItem>))}
          </DropdownMenuGroup>))}
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className={MENU_LABEL_CLASS}>Tamanho da fonte</DropdownMenuLabel>
          <div className="flex items-center gap-1 py-1 pr-2 pl-6" onClick={(event) => event.stopPropagation()}>
            <IconButton label="Diminuir a fonte (Ctrl -)" size="xs" disabled={options.fontSize <= CODE_FONT_SIZE_MIN} onClick={() => stepCodeFontSize(-1)}>
              <MinusGlyph />
            </IconButton>
            <button type="button" className="min-w-12 rounded-xs px-1 text-center font-mono text-2xs tabular-nums text-foreground hover:bg-highlight" title={`Voltar a ${CODE_FONT_SIZE_DEFAULT} px (Ctrl 0)`} onClick={() => resetCodeFontSize()}>
              {options.fontSize} px
            </button>
            <IconButton label="Aumentar a fonte (Ctrl +)" size="xs" disabled={options.fontSize >= CODE_FONT_SIZE_MAX} onClick={() => stepCodeFontSize(1)}>
              <PlusIcon />
            </IconButton>
          </div>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem className={MENU_ITEM_CLASS} onClick={() => openSettingsSection('code')}>
          <PreferencesIcon aria-hidden/>
          Todas as preferências de código…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>);
}
export function CodePresentationMenu({ compact }: {
    compact?: boolean;
}) {
    const session = useEditorSession();
    const presentation = useCodeSelector((code) => code.presentation);
    const Icon = CODE_PRESENTATION_ICON[presentation];
    return (<DropdownMenu>
      <DropdownMenuTrigger render={<button type="button" title={`Onde o editor de código aparece: ${CODE_PRESENTATION_LABEL[presentation].toLowerCase()}`} aria-label="Apresentação do editor de código" className={cn('inline-flex h-6 shrink-0 items-center gap-1 rounded-sm px-1.5 text-2xs text-muted-foreground transition-colors hover:bg-highlight hover:text-foreground data-[popup-open]:bg-highlight data-[popup-open]:text-foreground [&_svg]:size-3.5')}/>}>
        <Icon aria-hidden/>
        {!compact && <span>{CODE_PRESENTATION_LABEL[presentation]}</span>}
        <ChevronDownIcon className="!size-3" aria-hidden/>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={4} className={`${MENU_CONTENT_CLASS} w-72`}>
        <DropdownMenuRadioGroup value={presentation} onValueChange={(value) => revealCodeEditor(session, value as CodePresentation)}>
          <DropdownMenuGroup>
            <DropdownMenuLabel className={MENU_LABEL_CLASS}>Mostrar o editor de código</DropdownMenuLabel>
            {CODE_PRESENTATIONS.map((candidate) => {
            const ItemIcon = CODE_PRESENTATION_ICON[candidate];
            return (<DropdownMenuRadioItem key={candidate} className={`${MENU_ITEM_CLASS} items-start`} value={candidate}>
                  <ItemIcon aria-hidden className="mt-0.5"/>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span>{CODE_PRESENTATION_LABEL[candidate]}</span>
                    <span className="text-3xs leading-relaxed text-muted-foreground">{CODE_PRESENTATION_HINT[candidate]}</span>
                  </span>
                </DropdownMenuRadioItem>);
        })}
          </DropdownMenuGroup>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>);
}
