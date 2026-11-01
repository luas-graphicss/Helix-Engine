'use client';
import { Box, Code2, LayoutPanelTop, type LucideIcon } from 'lucide-react';
import type { EditorWorkspace } from '@/engine/editor/session/editor-session';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { useGuiDesigner } from '@/engine/editor/gui/ui/use-gui-designer';
import { useCodeSelector } from '@/engine/editor/code/ui/use-code-editor';
import { useShortcutHint } from '@/engine/editor/shortcuts/shortcut-bindings';
import { cn } from '@/lib/utils';
import { FOCUS_RING_CLASS, WELL_CLASS } from '@/engine/ui/surface-styles';
interface WorkspaceOption {
    readonly id: EditorWorkspace;
    readonly label: string;
    readonly icon: LucideIcon;
    readonly hint: string;
}
const WORKSPACES: readonly WorkspaceOption[] = [
    { id: 'scene', label: 'Cena', icon: Box, hint: 'Cena 3D: atores, luzes, terreno e física' },
    { id: 'gui', label: 'Interface', icon: LayoutPanelTop, hint: 'Designer 2D: telas, menus e HUD do jogo' },
    { id: 'code', label: 'Código', icon: Code2, hint: 'Editor de código: os scripts do jogo' },
];
export function WorkspaceSwitch() {
    const session = useSessionTopic('workspace');
    const designer = useGuiDesigner();
    const codeDirty = useCodeSelector((code) => code.anyDirty);
    const shortcutHint = useShortcutHint();
    return (<div role="radiogroup" aria-label="Área de trabalho" className={cn('flex h-6 items-center gap-px rounded-sm p-px', WELL_CLASS)}>
      {WORKSPACES.map(({ id, label, icon: Icon, hint }) => {
            const selected = session.workspace === id;
            const showsDirty = (id === 'gui' && designer.dirty) || (id === 'code' && codeDirty);
            return (<button key={id} type="button" role="radio" aria-checked={selected} title={hint} onClick={() => session.setWorkspace(id)} className={cn('relative flex h-full items-center gap-1.5 rounded-xs px-2 text-2xs font-medium transition-colors duration-100', FOCUS_RING_CLASS, selected ? 'bg-surface-raised text-foreground shadow-raised' : 'text-muted-foreground hover:bg-highlight hover:text-foreground')}>
            <Icon className={cn('size-3.5', selected && 'text-primary')} aria-hidden/>
            <span>{label}</span>
            {showsDirty && (<span className="size-1.5 rounded-full bg-warning" aria-label={id === 'code' ? 'Scripts com alterações não salvas' : 'Tela com alterações não salvas'} title={id === 'code' ? shortcutHint('Scripts com alterações não salvas', 'code.saveAll') : shortcutHint('Tela com alterações não salvas', 'gui.save')}/>)}
          </button>);
        })}
    </div>);
}
