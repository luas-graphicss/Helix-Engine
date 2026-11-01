'use client';
import { useSyncExternalStore } from 'react';
import type { Progress } from '@/engine/core/progress';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { OPEN_PROJECT_SESSION_FRACTION } from '@/engine/project/open-project';
const READY: Progress = { label: 'Pronto', fraction: 1 };
const subscribeToNothing = () => () => { };
const noVersion = () => 0;
export interface ViewportProgress {
    ready: boolean;
    progress: Progress;
}
export function useViewportProgress(session: EditorSession | null): ViewportProgress | null {
    useSyncExternalStore(session?.subscribe ?? subscribeToNothing, session?.getVersion ?? noVersion, session?.getVersion ?? noVersion);
    useSyncExternalStore(session?.subscribeStats ?? subscribeToNothing, session?.getStatsVersion ?? noVersion, session?.getStatsVersion ?? noVersion);
    if (!session)
        return null;
    if (session.viewportReady)
        return { ready: true, progress: READY };
    const { shadersTotal, shadersPending, warmupStage, warmupStages } = session.stats;
    const linked = shadersTotal - shadersPending;
    const steps = shadersTotal + warmupStages;
    const share = steps > 0 ? (linked + warmupStage) / steps : 0;
    let label = 'Preparando o viewport';
    if (shadersPending > 0)
        label = `Preparando materiais e luzes (${linked} de ${shadersTotal})`;
    else if (shadersTotal > 0 || warmupStage > 0)
        label = `Preparando o primeiro quadro (${warmupStage} de ${warmupStages})`;
    return {
        ready: false,
        progress: {
            label,
            fraction: OPEN_PROJECT_SESSION_FRACTION + share * (1 - OPEN_PROJECT_SESSION_FRACTION),
        },
    };
}
