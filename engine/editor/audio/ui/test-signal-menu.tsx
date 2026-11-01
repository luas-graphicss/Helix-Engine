'use client';
import { ChevronDown, FlaskConical } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { LibraryAsset } from '@/engine/assets/library/asset-types';
import { TEST_SIGNALS } from '@/engine/audio/synth/test-signals';
import { MENU_CONTENT_CLASS, MENU_ITEM_CLASS, MENU_LABEL_CLASS } from '@/engine/editor/menus/menu-styles';
import { generateTestSignalAsset } from '@/engine/editor/operations/audio-world-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { cn } from '@/lib/utils';
type TestSignalMenuProps = {
    onGenerated?: (asset: LibraryAsset) => void;
    label?: string;
    className?: string;
};
export function TestSignalMenu({ onGenerated, label = 'Som de teste', className }: TestSignalMenuProps) {
    const session = useEditorSession();
    return (<DropdownMenu>
      <DropdownMenuTrigger render={<button type="button" title="Sintetiza um sinal de teste em WAV e o guarda na biblioteca" className={cn('flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-sm border border-border px-2.5 text-2xs font-medium text-muted-foreground transition-colors hover:bg-highlight hover:text-foreground [&_svg]:size-3.5 [&_svg]:shrink-0', className)}/>}>
        <FlaskConical aria-hidden/>
        {label}
        <ChevronDown aria-hidden className="text-muted-foreground"/>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={`${MENU_CONTENT_CLASS} w-72`}>
        <DropdownMenuGroup>
          <DropdownMenuLabel className={MENU_LABEL_CLASS}>Sinais sintéticos (laço de 4 s, mono)</DropdownMenuLabel>
          {TEST_SIGNALS.map((signal) => (<DropdownMenuItem key={signal.kind} className={`${MENU_ITEM_CLASS} flex-col items-start gap-0`} onClick={() => {
                void generateTestSignalAsset(session, signal.kind).then((asset) => {
                    if (asset)
                        onGenerated?.(asset);
                });
            }}>
              <span>{signal.label}</span>
              <span className="text-3xs leading-relaxed text-pretty text-muted-foreground">{signal.description}</span>
            </DropdownMenuItem>))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>);
}
