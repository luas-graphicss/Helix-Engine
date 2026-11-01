'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Entity } from '@/engine/core/scene/entity';
import type { VfxInstance } from '@/engine/vfx/simulation/vfx-instance';
import { useEditorSession, useSessionTopic } from '@/engine/editor/session/editor-session-context';
import type { VfxEditor } from '../vfx-editor';
export function useVfxEditor(): VfxEditor {
    const { vfx } = useEditorSession();
    useSyncExternalStore(vfx.subscribe, vfx.getVersion, vfx.getVersion);
    return vfx;
}
const LIVE_HZ = 12;
export function useLiveTicker(active: boolean): void {
    const [, setTick] = useState(0);
    useEffect(() => {
        if (!active)
            return;
        const handle = window.setInterval(() => setTick((value) => value + 1), 1000 / LIVE_HZ);
        return () => window.clearInterval(handle);
    }, [active]);
}
export interface VfxStageView {
    readonly entity: Entity | null;
    readonly instance: VfxInstance | null;
    readonly running: boolean;
}
export function useVfxStage(): VfxStageView {
    const session = useSessionTopic('scene');
    const editor = useVfxEditor();
    const entity = editor.stageEntityId !== null ? session.findById(editor.stageEntityId) : null;
    const instance = entity ? session.vfxWorld.system.instanceOf(entity.id) : null;
    const running = instance !== null && instance.state === 'playing' && !editor.paused;
    useLiveTicker(running);
    return { entity, instance, running };
}
