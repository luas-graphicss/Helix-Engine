'use client';
import { type ComponentProps, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LoadingScreen } from '@/engine/boot/loading-screen';
import { useViewportProgress } from '@/engine/boot/use-viewport-progress';
import { ENGINE_NAME } from '@/engine/core/engine-info';
import type { Progress } from '@/engine/core/progress';
import { HUB_PATH } from '@/engine/hub/hub-routes';
import { openProject } from '@/engine/project/open-project';
import { getProjectRegistry } from '@/engine/project/project-registry';
import { useEditorReopenVersion } from './editor-reopen';
import { EditorShell } from './editor-shell';
import type { EditorSession } from './session/editor-session';
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
export function EditorBoot({ projectId }: {
    projectId: string;
}) {
    const router = useRouter();
    const [attempt, setAttempt] = useState(0);
    const reopenVersion = useEditorReopenVersion();
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
            document.title = `${opened.projectName} · ${ENGINE_NAME}`;
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
    }, [projectId, attempt, reopenVersion]);
    const session = state.status === 'ready' ? state.session : null;
    const title = getProjectRegistry().get(projectId)?.name;
    return (<>
      {session && <EditorShell session={session}/>}
      {splashVisible && (<BootSplash title={title} session={session} opening={state.status === 'opening' ? state.progress : null} onExited={() => setSplashVisible(false)} error={state.status === 'failed'
                ? {
                    title: 'Não foi possível abrir este jogo',
                    message: state.message,
                    actions: (<>
                      <Button size="sm" onClick={() => router.push(HUB_PATH)}>
                        Voltar ao início
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setAttempt((count) => count + 1)}>
                        Tentar de novo
                      </Button>
                    </>),
                }
                : null}/>)}
    </>);
}
function BootSplash({ title, session, opening, onExited, error, }: {
    title: string | undefined;
    session: EditorSession | null;
    opening: Progress | null;
    onExited: () => void;
    error: ComponentProps<typeof LoadingScreen>['error'];
}) {
    const viewport = useViewportProgress(session);
    return <LoadingScreen title={title} progress={opening ?? viewport?.progress ?? READY} done={viewport?.ready ?? false} onExited={onExited} error={error}/>;
}
