'use client';
import { useEffect, useRef } from 'react';
import { PlaytestHudOverlay } from '@/engine/editor/playtest/playtest-hud-overlay';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { EditorSessionProvider, useEditorSession, useSessionSelector } from '@/engine/editor/session/editor-session-context';
import { useViewportRenderer } from '@/engine/editor/viewport/use-viewport-renderer';
import { useWindowFocusPolicies } from '@/engine/settings/apply/use-engine-settings-effects';
import { usePlayerInput } from './use-player-input';
const VIEW_TOPICS = ['view'] as const;
function useAutoPlay(session: EditorSession): void {
    const ready = useSessionSelector((current) => current.viewportReady, { topics: VIEW_TOPICS });
    useEffect(() => {
        if (ready && session.playtest.state === 'stopped')
            session.playtest.play();
    }, [ready, session]);
}
function Stage() {
    const session = useEditorSession();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { error } = useViewportRenderer(canvasRef, session);
    useEffect(() => {
        session.attachViewport(canvasRef.current);
        return () => session.attachViewport(null);
    }, [session]);
    usePlayerInput(canvasRef, session);
    useWindowFocusPolicies(session);
    useAutoPlay(session);
    return (<main className="relative h-dvh w-full overflow-clip bg-background text-foreground">
      <canvas ref={canvasRef} tabIndex={0} aria-label="Jogo" className="block size-full touch-none outline-none"/>
      <PlaytestHudOverlay />
      {error && <div className="absolute inset-0 flex items-center justify-center bg-surface-sunken p-6 text-center text-2xs text-muted-foreground">{error}</div>}
    </main>);
}
export function PlayerStage({ session }: {
    session: EditorSession;
}) {
    return (<EditorSessionProvider session={session}>
      <Stage />
    </EditorSessionProvider>);
}
