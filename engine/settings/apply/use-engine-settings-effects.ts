'use client';
import { useEffect, useRef } from 'react';
import { peekAudioContext, resumeAudioContext } from '@/engine/audio/core/audio-context';
import type { DockLayoutStore } from '@/engine/editor/layout/dock-layout';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { engineSettings, useEngineSetting } from '../engine-settings-store';
import { applyLiveSessionSettings } from './session-settings';
export function useLiveSessionSettings(session: EditorSession): void {
    useEffect(() => {
        const apply = () => {
            applyLiveSessionSettings(session);
            session.notify();
        };
        apply();
        return engineSettings.subscribe(apply);
    }, [session]);
}
export function useWindowFocusPolicies(session: EditorSession): void {
    const audioOnlyWhenFocused = useEngineSetting('audio.onlyWhenFocused');
    const pauseSimulationOnBlur = useEngineSetting('simulation.pauseOnBlur');
    useEffect(() => {
        if (!audioOnlyWhenFocused && !pauseSimulationOnBlur)
            return;
        let resumeSimulation = false;
        let resumeAudio = false;
        const onBlur = () => {
            if (pauseSimulationOnBlur && session.playtest.state === 'playing') {
                session.playtest.pause();
                resumeSimulation = true;
            }
            const context = audioOnlyWhenFocused ? peekAudioContext() : null;
            if (context && context.state === 'running') {
                resumeAudio = true;
                void context.suspend();
            }
        };
        const onFocus = () => {
            if (resumeSimulation) {
                resumeSimulation = false;
                if (session.playtest.state === 'paused')
                    session.playtest.play();
            }
            if (resumeAudio) {
                resumeAudio = false;
                void resumeAudioContext();
            }
        };
        window.addEventListener('blur', onBlur);
        window.addEventListener('focus', onFocus);
        return () => {
            window.removeEventListener('blur', onBlur);
            window.removeEventListener('focus', onFocus);
            if (resumeAudio)
                void resumeAudioContext();
        };
    }, [session, audioOnlyWhenFocused, pauseSimulationOnBlur]);
}
export function useRevealConsoleOnError(session: EditorSession, dock: DockLayoutStore): void {
    const reveal = useEngineSetting('editor.console.revealOnError');
    const seenErrors = useRef(session.log.count('error'));
    useEffect(() => {
        if (!reveal)
            return;
        return session.subscribe(() => {
            const errors = session.log.count('error');
            if (errors > seenErrors.current)
                dock.reveal('console');
            seenErrors.current = errors;
        });
    }, [session, dock, reveal]);
}
