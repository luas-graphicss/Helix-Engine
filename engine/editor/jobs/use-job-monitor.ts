'use client';
import { useEffect, useState } from 'react';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { advanceJobMonitor, createJobMonitor, type JobMonitor } from './job-load';
const POLL_MS = 200;
export function useJobMonitor(session: EditorSession): JobMonitor {
    const [monitor, setMonitor] = useState(() => createJobMonitor(session.scripts.jobs.snapshot()));
    useEffect(() => {
        const { jobs } = session.scripts;
        const timer = setInterval(() => {
            const snapshot = jobs.snapshot();
            setMonitor((current) => advanceJobMonitor(current, snapshot));
        }, POLL_MS);
        return () => clearInterval(timer);
    }, [session]);
    return monitor;
}
