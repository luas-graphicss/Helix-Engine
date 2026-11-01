'use client';
import { CloudAlert, CloudCheck, CloudUpload, type LucideIcon } from 'lucide-react';
import { formatRelativeTime } from '@/engine/core/format/format-time';
import type { AutosaveState } from '@/engine/project/project-autosave';
import { cn } from '@/lib/utils';
import { saveProjectNow } from '../operations/project-operations';
import { useSessionTopic } from '../session/editor-session-context';
import { useShortcutHint } from '../shortcuts/shortcut-bindings';
const ICONS: Record<AutosaveState, LucideIcon> = { clean: CloudCheck, dirty: CloudUpload, saving: CloudUpload, error: CloudAlert };
export function AutosaveStatus() {
    const session = useSessionTopic('project');
    const hint = useShortcutHint();
    const { state, lastSavedAt, error } = session.autosave;
    const Icon = ICONS[state];
    const label = state === 'saving' ? 'Salvando…' : state === 'dirty' ? 'Alterações pendentes' : state === 'error' ? 'Erro ao salvar' : lastSavedAt ? `Salvo ${formatRelativeTime(lastSavedAt)}` : 'Salvo';
    const title = state === 'error' ? (error ?? 'Não foi possível salvar a cena.') : hint('Salvamento automático · clique para salvar agora', 'file.save');
    return (<button type="button" title={title} disabled={state === 'saving'} onClick={() => void saveProjectNow(session)} className={cn('flex h-full shrink-0 items-center gap-1.5 rounded-sm px-1.5 transition-colors duration-100 hover:bg-highlight hover:text-foreground disabled:pointer-events-none', state === 'clean' && 'text-success/90', state === 'dirty' && 'text-warning', state === 'error' && 'text-destructive')}>
      <Icon className={cn('size-3', state === 'saving' && 'animate-pulse')} aria-hidden/>
      {label}
    </button>);
}
