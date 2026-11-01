'use client';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type UIEvent } from 'react';
import { adjacentKeyTime, keysInRange } from '@/engine/core/animation/track-editing';
import { useAnimationEditor, useTimelineRows } from '@/engine/editor/animation/ui/use-animation-editor';
import { saveAnimationEditorDocument } from '@/engine/editor/operations/animation-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { shortcutBindings } from '@/engine/editor/shortcuts/shortcut-bindings';
import { AnimationEmptyState } from './animation/animation-empty-state';
import { AnimationToolbar } from './animation/animation-toolbar';
import { BoneTree } from './animation/bone-tree';
import { CurveCanvas } from './animation/curve-canvas';
import { DopesheetCanvas } from './animation/dopesheet-canvas';
import { KeyInspector } from './animation/key-inspector';
const TREE_WIDTH_PX = 190;
const BIG_STEP_FRAMES = 10;
function isTextEntry(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement))
        return false;
    return target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
}
export function AnimationPanel() {
    const session = useEditorSession();
    const editor = useAnimationEditor();
    const rows = useTimelineRows(editor);
    const treeScrollRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [selectedEvent, setSelectedEvent] = useState(-1);
    const eventCount = editor.document?.events.length ?? 0;
    useEffect(() => {
        if (selectedEvent >= eventCount)
            setSelectedEvent(-1);
    }, [eventCount, selectedEvent]);
    const onTreeScroll = useCallback((event: UIEvent<HTMLDivElement>) => setScrollTop(event.currentTarget.scrollTop), []);
    const onWheelScroll = useCallback((deltaY: number) => {
        const tree = treeScrollRef.current;
        if (tree)
            tree.scrollTop += deltaY;
    }, []);
    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (!editor.document || isTextEntry(event.target))
            return;
        const action = shortcutBindings.resolve(event.nativeEvent, 'animation');
        if (!action)
            return;
        const frames = event.shiftKey ? BIG_STEP_FRAMES : 1;
        switch (action) {
            case 'animation.togglePlay':
                editor.togglePlay();
                break;
            case 'animation.stepBack':
                editor.stepFrames(-frames);
                break;
            case 'animation.stepForward':
                editor.stepFrames(frames);
                break;
            case 'animation.goToStart':
                editor.goToStart();
                break;
            case 'animation.goToEnd':
                editor.goToEnd();
                break;
            case 'animation.previousKey':
            case 'animation.nextKey': {
                const next = adjacentKeyTime(editor.document, editor.time, action === 'animation.previousKey' ? -1 : 1);
                if (next !== null) {
                    editor.pause();
                    editor.setTime(next, false);
                }
                break;
            }
            case 'animation.keySelected':
                editor.keyBones();
                break;
            case 'animation.keyAll':
                editor.keyAllBones();
                break;
            case 'animation.copyKeys':
                if (editor.selectedKeys.length === 0)
                    return;
                editor.copySelectedKeys();
                break;
            case 'animation.pasteKeys':
                if (!editor.clipboard)
                    return;
                editor.pasteKeys();
                break;
            case 'animation.selectAllKeys':
                editor.selectKeys(keysInRange(editor.document, -Infinity, Infinity), 'replace');
                break;
            case 'animation.deleteKeys':
                editor.deleteSelectedKeys();
                break;
            case 'animation.save':
                void saveAnimationEditorDocument(session);
                break;
            case 'animation.escape':
                if (selectedEvent !== -1)
                    setSelectedEvent(-1);
                else if (editor.selectedKeys.length > 0)
                    editor.selectKeys([], 'replace');
                else
                    return;
                break;
            default:
                return;
        }
        event.preventDefault();
    };
    if (!editor.active)
        return <AnimationEmptyState />;
    return (<div className="flex h-full flex-col outline-none" tabIndex={0} onKeyDown={onKeyDown} aria-label="Editor de animação">
      <AnimationToolbar />
      <div className="flex min-h-0 flex-1">
        <div className="shrink-0" style={{ width: TREE_WIDTH_PX }}>
          <BoneTree editor={editor} rows={rows} scrollRef={treeScrollRef} onScroll={onTreeScroll}/>
        </div>
        <div className="min-w-0 flex-1">
          {editor.view === 'dopesheet' ? (<DopesheetCanvas rows={rows} scrollTop={scrollTop} onWheelScroll={onWheelScroll} selectedEvent={selectedEvent} onSelectEvent={setSelectedEvent}/>) : (<CurveCanvas selectedEvent={selectedEvent} onSelectEvent={setSelectedEvent}/>)}
        </div>
      </div>
      <KeyInspector selectedEvent={selectedEvent} onSelectEvent={setSelectedEvent}/>
    </div>);
}
