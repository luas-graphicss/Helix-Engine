'use client';
import { useEffect, useSyncExternalStore } from 'react';
import { CircleAlert, RefreshCw } from 'lucide-react';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import type { SessionTopic } from '@/engine/editor/session/session-topics';
import { ActionButton } from '@/engine/ui/action-button';
import type { GuiSurface } from '../../gui/gui-surface';
import { GuiNodeList } from './gui-node-view';
const REFRESH_TOPICS: readonly SessionTopic[] = ['scene', 'selection', 'history', 'assets', 'playtest'];
function useSurfaceRefresh(surface: GuiSurface): void {
    const session = useEditorSession();
    useEffect(() => {
        let frame = 0;
        const refreshSoon = () => {
            if (frame !== 0)
                return;
            frame = requestAnimationFrame(() => {
                frame = 0;
                surface.refresh();
            });
        };
        surface.repaint();
        const unsubscribe = session.subscribeTopic(REFRESH_TOPICS, refreshSoon);
        return () => {
            unsubscribe();
            if (frame !== 0)
                cancelAnimationFrame(frame);
        };
    }, [session, surface]);
}
export function ExtensionGuiView({ surface }: {
    surface: GuiSurface;
}) {
    const session = useEditorSession();
    useSyncExternalStore(surface.subscribe, surface.getVersion, surface.getVersion);
    useSurfaceRefresh(surface);
    if (surface.hasFailed)
        return (<div role="alert" className="flex flex-col items-start gap-2 p-2 text-2xs">
          <p className="flex items-start gap-1.5 leading-relaxed text-pretty">
            <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-destructive" aria-hidden/>
            <span>O script falhou ao desenhar esta interface. O erro está no console.</span>
          </p>
          <ActionButton icon={RefreshCw} onClick={() => surface.repaint()}>
            Tentar de novo
          </ActionButton>
        </div>);
    return (<div className="flex flex-col py-1">
      <GuiNodeList nodes={surface.tree} emit={(key, value) => {
            surface.dispatch(key, value);
            session.notify();
        }}/>
    </div>);
}
