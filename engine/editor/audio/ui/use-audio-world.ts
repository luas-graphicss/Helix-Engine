'use client';
import { useSyncExternalStore } from 'react';
import type { AudioWorld } from '@/engine/audio/world/audio-world';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
export function useAudioWorld(): AudioWorld {
    const { audio } = useEditorSession();
    useSyncExternalStore(audio.world.subscribe, audio.world.getVersion, audio.world.getVersion);
    return audio.world;
}
