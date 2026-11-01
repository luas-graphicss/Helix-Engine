'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { History, RotateCcw } from 'lucide-react';
import { formatDateTime, formatRelativeTime, plural } from '@/engine/core/format/format-time';
import { useProjectRegistry } from '@/engine/hub/use-project-registry';
import type { ProjectRecord } from '@/engine/project/project-record';
import { listProjectSnapshots, sceneSnapshotsKey } from '@/engine/project/scene-snapshots';
import type { SceneSnapshotInfo } from '@/engine/project/scene-store';
import { EMPTY_NOTE_CLASS, FOCUS_RING_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
import { restoreAutosave } from '../operations/engine-operations';
import { useEditorSession } from '../session/editor-session-context';
import { editorDialogs } from './editor-dialogs';
import { EditorDialogShell } from './editor-dialog-shell';
interface AutosavesDialogProps {
    open: boolean;
    onOpenChange(open: boolean): void;
}
function errorMessage(cause: unknown): string {
    return cause instanceof Error ? cause.message : String(cause);
}
function ProjectRow({ record, selected, current, onSelect }: {
    record: ProjectRecord;
    selected: boolean;
    current: boolean;
    onSelect(): void;
}) {
    return (<li>
      <button type="button" onClick={onSelect} aria-current={selected ? 'true' : undefined} className={cn('flex w-full flex-col gap-0.5 px-4 py-2 text-left transition-colors duration-100', FOCUS_RING_CLASS, selected ? 'bg-surface-raised text-foreground shadow-bevel' : 'text-muted-foreground hover:bg-highlight hover:text-foreground')}>
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-xs">{record.name}</span>
          {current && <span className="shrink-0 rounded-xs border border-primary/40 bg-primary/10 px-1 font-mono text-3xs text-primary">aberto</span>}
        </span>
        <span className="font-mono text-3xs text-muted-foreground">salvo {formatRelativeTime(record.updatedAt)}</span>
      </button>
    </li>);
}
function SnapshotRow({ snapshot, newest, busy, restoring, onRestore }: {
    snapshot: SceneSnapshotInfo;
    newest: boolean;
    busy: boolean;
    restoring: boolean;
    onRestore(): void;
}) {
    return (<li>
      <button type="button" disabled={busy} onClick={onRestore} className={cn('group/snapshot flex w-full items-center justify-between gap-4 px-4 py-2.5 text-left transition-colors duration-100 hover:bg-highlight disabled:cursor-default', FOCUS_RING_CLASS, restoring && 'bg-primary/10')}>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex items-center gap-2 text-xs text-foreground">
            {formatDateTime(snapshot.savedAt)}
            {newest && <span className="rounded-xs border border-border bg-surface-raised px-1 font-mono text-3xs text-muted-foreground">mais recente</span>}
          </span>
          <span className="font-mono text-3xs text-muted-foreground">{formatRelativeTime(snapshot.savedAt)}</span>
        </span>
        <span className={cn('flex shrink-0 items-center gap-1.5 font-mono text-3xs text-muted-foreground transition-colors', !busy && 'group-hover/snapshot:text-primary')}>
          <RotateCcw className={cn('size-3.5', restoring && 'animate-spin [animation-duration:1.2s]')} aria-hidden/>
          {restoring ? 'Restaurando…' : 'Restaurar'}
        </span>
      </button>
    </li>);
}
function SnapshotList({ record, onBusyChange }: {
    record: ProjectRecord;
    onBusyChange(busy: boolean): void;
}) {
    const session = useEditorSession();
    const router = useRouter();
    const current = record.id === session.project.id;
    const { data: snapshots, error, isLoading, mutate } = useSWR(sceneSnapshotsKey(record.id), () => (current ? session.project.scenes.listSnapshots() : listProjectSnapshots(record)), {
        revalidateOnFocus: false,
    });
    const [restoring, setRestoring] = useState<string | null>(null);
    const restore = async (key: string) => {
        setRestoring(key);
        onBusyChange(true);
        try {
            await restoreAutosave(session, router, record, key);
            editorDialogs.close();
        }
        catch (cause) {
            session.log.error('Projeto', `Não foi possível restaurar o salvamento automático: ${errorMessage(cause)}`);
            await mutate();
        }
        finally {
            setRestoring(null);
            onBusyChange(false);
        }
    };
    return (<section aria-label={`Salvamentos automáticos de ${record.name}`} className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-baseline justify-between gap-3 border-b border-border px-4 py-2">
        <h3 className="truncate text-xs font-medium text-foreground">{record.name}</h3>
        <span className="shrink-0 font-mono text-3xs text-muted-foreground">
          {snapshots ? plural(snapshots.length, 'salvamento', 'salvamentos') : isLoading ? 'Lendo…' : ''}
        </span>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {error && (<p role="alert" className="px-4 py-3 text-2xs text-destructive">
            Não foi possível ler os salvamentos: {errorMessage(error)}
          </p>)}
        {snapshots && snapshots.length === 0 && (<div className={cn('m-4 flex flex-col items-center gap-2 px-6 py-8 text-center', EMPTY_NOTE_CLASS)}>
            <History className="size-5" aria-hidden/>
            <p className="max-w-64 text-2xs leading-relaxed text-pretty">
              Ainda não há salvamentos automáticos deste jogo. Eles aparecem conforme você trabalha, no intervalo definido em Configuração ▸ Projeto e salvamento.
            </p>
          </div>)}
        {snapshots && snapshots.length > 0 && (<ul className="divide-y divide-border">
            {snapshots.map((snapshot, index) => (<SnapshotRow key={snapshot.key} snapshot={snapshot} newest={index === 0} busy={restoring !== null} restoring={restoring === snapshot.key} onRestore={() => void restore(snapshot.key)}/>))}
          </ul>)}
      </div>
    </section>);
}
export function AutosavesDialog({ open, onOpenChange }: AutosavesDialogProps) {
    const session = useEditorSession();
    const registry = useProjectRegistry();
    const currentId = session.project.id;
    const projects = [...registry.active].sort((a, b) => Number(b.id === currentId) - Number(a.id === currentId));
    const [selectedId, setSelectedId] = useState(currentId);
    const [busy, setBusy] = useState(false);
    const selected = projects.find((record) => record.id === selectedId) ?? projects[0] ?? null;
    useEffect(() => {
        if (open)
            setSelectedId(currentId);
    }, [open, currentId]);
    return (<EditorDialogShell open={open} onOpenChange={onOpenChange} title="Salvamentos automáticos" description="Instantâneos da cena guardados enquanto você trabalha. Clique num salvamento para voltar a ele; o estado atual é guardado antes, então nada se perde." action="helix.autosaves" size="lg" body="fill" dismissible={!busy} footer={<span className="font-mono text-3xs text-muted-foreground">{plural(projects.length, 'jogo neste navegador', 'jogos neste navegador')}</span>}>
      <nav aria-label="Jogos" className="flex w-56 shrink-0 flex-col border-r border-border bg-surface-sunken/50">
        <ul className="min-h-0 flex-1 overflow-y-auto py-1">
          {projects.map((record) => (<ProjectRow key={record.id} record={record} selected={record.id === selected?.id} current={record.id === currentId} onSelect={() => !busy && setSelectedId(record.id)}/>))}
        </ul>
      </nav>
      {selected && <SnapshotList key={selected.id} record={selected} onBusyChange={setBusy}/>}
    </EditorDialogShell>);
}
