'use client';
import { useEffect, useState } from 'react';
import type { Entity } from '@/engine/core/scene/entity';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
const REFRESH_MS = 200;
export type ReadoutSource = (session: EditorSession, entity: Entity) => string | null;
export function useLiveReadout(entity: Entity, describe: ReadoutSource): string | null {
    const session = useEditorSession();
    const [readout, setReadout] = useState(() => describe(session, entity));
    useEffect(() => {
        const refresh = () => setReadout(describe(session, entity));
        refresh();
        const handle = window.setInterval(refresh, REFRESH_MS);
        return () => window.clearInterval(handle);
    }, [session, entity, describe]);
    return readout;
}
