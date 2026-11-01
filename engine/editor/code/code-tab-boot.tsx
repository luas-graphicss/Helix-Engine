'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Code2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingScreen } from '@/engine/boot/loading-screen';
import { ENGINE_NAME } from '@/engine/core/engine-info';
import type { Progress } from '@/engine/core/progress';
import { openProject } from '@/engine/project/open-project';
import { getProjectRegistry } from '@/engine/project/project-registry';
import { EditorDialogHost } from '@/engine/editor/dialogs/editor-dialog-host';
import { FilePickerHost } from '@/engine/editor/files/file-picker';
import { DockLayoutProvider, useDockLayout } from '@/engine/editor/layout/dock-layout-context';
import { CommandBar } from '@/engine/editor/chrome/command-bar';
import { openScriptAssetInEditor, refreshScriptFromStorage, scriptSync } from '@/engine/editor/operations/script-operations';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { EditorSessionProvider, useEditorSession, useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { useEditorShortcuts } from '@/engine/editor/shortcuts/use-editor-shortcuts';
import { useLiveSessionSettings } from '@/engine/settings/apply/use-engine-settings-effects';
import { FOCUS_RING_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
import { CodeWorkspace } from './ui/code-workspace';
import { useCodeSelector } from './ui/use-code-editor';
type BootState = {
    status: 'opening';
    progress: Progress;
} | {
    status: 'ready';
    session: EditorSession;
} | {
    status: 'failed';
    message: string;
};
const OPENING: BootState = { status: 'opening', progress: { label: 'Abrindo o projeto', fraction: 0 } };
const READY: Progress = { label: 'Pronto', fraction: 1 };
export function CodeTabBoot({ projectId, initialScriptId }: {
    projectId: string;
    initialScriptId: string | null;
}) {
    const router = useRouter();
    const [attempt, setAttempt] = useState(0);
    const [state, setState] = useState<BootState>(OPENING);
    const [splashVisible, setSplashVisible] = useState(true);
    useEffect(() => {
        let cancelled = false;
        let session: EditorSession | null = null;
        setState(OPENING);
        setSplashVisible(true);
        openProject(projectId, (progress) => {
            if (!cancelled)
                setState({ status: 'opening', progress });
        }).then((opened) => {
            if (cancelled) {
                void opened.dispose();
                return;
            }
            session = opened;
            opened.autosave.discard();
            opened.code.standalone = true;
            opened.code.setPresentation('tab');
            opened.setWorkspace('code');
            document.title = `Código · ${opened.projectName} · ${ENGINE_NAME}`;
            setState({ status: 'ready', session: opened });
        }, (cause: unknown) => {
            if (!cancelled)
                setState({ status: 'failed', message: cause instanceof Error ? cause.message : String(cause) });
        });
        return () => {
            cancelled = true;
            if (session)
                void session.dispose();
        };
    }, [projectId, attempt]);
    const session = state.status === 'ready' ? state.session : null;
    const title = getProjectRegistry().get(projectId)?.name;
    return (<>
      {session && <CodeTabShell session={session} initialScriptId={initialScriptId}/>}
      {splashVisible && (<LoadingScreen title={title ? `${title} · Código` : undefined} progress={state.status === 'opening' ? state.progress : READY} done={state.status === 'ready'} onExited={() => setSplashVisible(false)} error={state.status === 'failed'
                ? {
                    title: 'Não foi possível abrir o código deste jogo',
                    message: state.message,
                    actions: (<>
                      <Button size="sm" onClick={() => router.push(`/editor/${encodeURIComponent(projectId)}`)}>
                        Abrir o editor
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setAttempt((count) => count + 1)}>
                        Tentar de novo
                      </Button>
                    </>),
                }
                : null}/>)}
    </>);
}
function CodeTabShell({ session, initialScriptId }: {
    session: EditorSession;
    initialScriptId: string | null;
}) {
    return (<EditorSessionProvider session={session}>
      <DockLayoutProvider>
        <CodeTabLayout initialScriptId={initialScriptId}/>
      </DockLayoutProvider>
    </EditorSessionProvider>);
}
function useCodeTabSync(initialScriptId: string | null) {
    const session = useEditorSession();
    useEffect(() => {
        const openById = (assetId: string) => {
            const asset = session.library.get(assetId);
            if (asset) {
                void openScriptAssetInEditor(session, asset, { pin: true });
                return;
            }
            void refreshScriptFromStorage(session, assetId).then(() => {
                const loaded = session.library.get(assetId);
                if (loaded)
                    void openScriptAssetInEditor(session, loaded, { pin: true });
            });
        };
        if (initialScriptId)
            openById(initialScriptId);
        const stopOpen = scriptSync.listenOpen(session, (assetId) => {
            openById(assetId);
            window.focus();
        });
        const stopSaved = scriptSync.listen(session, (assetId) => void refreshScriptFromStorage(session, assetId));
        return () => {
            stopOpen();
            stopSaved();
        };
    }, [session, initialScriptId]);
}
function useLeaveGuard() {
    const dirty = useCodeSelector((code) => code.anyDirty);
    useEffect(() => {
        if (!dirty)
            return;
        const guard = (event: BeforeUnloadEvent) => {
            event.preventDefault();
        };
        window.addEventListener('beforeunload', guard);
        return () => window.removeEventListener('beforeunload', guard);
    }, [dirty]);
}
function CodeTabLayout({ initialScriptId }: {
    initialScriptId: string | null;
}) {
    const session = useEditorSession();
    const [, dock] = useDockLayout();
    useEditorShortcuts(session, dock);
    useLiveSessionSettings(session);
    useCodeTabSync(initialScriptId);
    useLeaveGuard();
    return (<main className="relative flex h-dvh w-full flex-col overflow-clip bg-background text-foreground">
      <CodeTabHeader />
      <div className="relative min-h-0 min-w-0 flex-1">
        <CodeWorkspace />
      </div>
      <CodeTabCommandBar />
      <EditorDialogHost />
      <FilePickerHost />
    </main>);
}
function CodeTabHeader() {
    const session = useSessionTopic('project');
    const anyDirty = useCodeSelector((code) => code.anyDirty);
    const projectId = session.project.id;
    const backToEditor = () => {
        const opener = window.opener as Window | null;
        if (opener && !opener.closed) {
            opener.focus();
            return;
        }
        window.open(`/editor/${encodeURIComponent(projectId)}`, '_blank', 'noopener');
    };
    return (<header className="flex h-7 shrink-0 items-center gap-2 border-b border-border bg-surface bg-linear-to-b from-bevel to-transparent px-2 shadow-bevel">
      <Code2 className="size-3.5 shrink-0 text-primary" aria-hidden/>
      <span className="truncate text-2xs font-medium">{session.projectName}</span>
      <span className="font-mono text-3xs tracking-wider text-muted-foreground uppercase">aba de código</span>
      {anyDirty && <span className="size-1.5 shrink-0 rounded-full bg-warning" aria-label="Scripts com alterações não salvas" title="Scripts com alterações não salvas"/>}
      <button type="button" onClick={backToEditor} title="Voltar ao editor principal (a cena, a hierarquia e o inspetor ficam lá)" className={cn('ml-auto flex h-5 items-center gap-1 rounded-sm px-1.5 text-2xs text-muted-foreground transition-colors hover:bg-highlight hover:text-foreground', FOCUS_RING_CLASS)}>
        <ArrowLeft className="size-3" aria-hidden/>
        Editor principal
      </button>
    </header>);
}
function CodeTabCommandBar() {
    const visible = useCodeSelector((code) => code.commandBarVisible);
    return visible ? <CommandBar /> : null;
}
