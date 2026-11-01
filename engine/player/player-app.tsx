'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { LoadingScreen } from '@/engine/boot/loading-screen';
import { useViewportProgress } from '@/engine/boot/use-viewport-progress';
import type { Progress } from '@/engine/core/progress';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import type { GameManifest } from './game-manifest';
import { bootPlayer } from './player-boot';
import { PlayerStage } from './player-stage';
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
const OPENING: BootState = { status: 'opening', progress: { label: 'Abrindo o jogo', fraction: 0 } };
const READY: Progress = { label: 'Pronto', fraction: 1 };
function Splash({ title, session, opening, onExited, error }: {
    title: string;
    session: EditorSession | null;
    opening: Progress | null;
    onExited: () => void;
    error: string | null;
}) {
    const viewport = useViewportProgress(session);
    return (<LoadingScreen title={title} progress={opening ?? viewport?.progress ?? READY} done={viewport?.ready ?? false} onExited={onExited} error={error
            ? {
                title: 'Não foi possível abrir o jogo',
                message: error,
                actions: (<Button size="sm" onClick={() => location.reload()}>
                  Tentar de novo
                </Button>),
            }
            : null}/>);
}
export function PlayerApp({ manifest }: {
    manifest: GameManifest;
}) {
    const [state, setState] = useState<BootState>(OPENING);
    const [splashVisible, setSplashVisible] = useState(true);
    useEffect(() => {
        let cancelled = false;
        let session: EditorSession | null = null;
        bootPlayer(manifest, (progress) => {
            if (!cancelled)
                setState({ status: 'opening', progress });
        }).then((opened) => {
            if (cancelled) {
                void opened.dispose();
                return;
            }
            session = opened;
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
    }, [manifest]);
    const session = state.status === 'ready' ? state.session : null;
    return (<>
      {session && <PlayerStage session={session}/>}
      {splashVisible && (<Splash title={manifest.name} session={session} opening={state.status === 'opening' ? state.progress : null} onExited={() => setSplashVisible(false)} error={state.status === 'failed' ? state.message : null}/>)}
    </>);
}
