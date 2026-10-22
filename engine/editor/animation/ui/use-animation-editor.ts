'use client';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import type { AnimationEditor } from '../animation-editor';
import { buildTimelineRows, type TimelineRow } from './timeline-model';
export function useAnimationEditor(): AnimationEditor {
    const { animation } = useEditorSession();
    useSyncExternalStore(animation.subscribe, animation.getVersion, animation.getVersion);
    return animation;
}
export function useAnimationTime(): number {
    const { animation } = useEditorSession();
    useSyncExternalStore(animation.subscribeTime, animation.getTimeVersion, animation.getTimeVersion);
    return animation.time;
}
export function useTimelineRows(editor: AnimationEditor): TimelineRow[] {
    const version = useSyncExternalStore(editor.subscribe, editor.getVersion, editor.getVersion);
    return useMemo(() => buildTimelineRows(editor), [editor, version]);
}
export interface ElementSize {
    readonly width: number;
    readonly height: number;
}
export function useElementSize<T extends HTMLElement>(ref: React.RefObject<T | null>): ElementSize {
    const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 });
    useEffect(() => {
        const element = ref.current;
        if (!element)
            return;
        const update = () => {
            const rect = element.getBoundingClientRect();
            setSize((current) => (current.width === rect.width && current.height === rect.height ? current : { width: rect.width, height: rect.height }));
        };
        update();
        const observer = new ResizeObserver(update);
        observer.observe(element);
        return () => observer.disconnect();
    }, [ref]);
    return size;
}
