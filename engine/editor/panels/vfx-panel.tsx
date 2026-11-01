'use client';
import { useCallback, useMemo, useRef, useState, type KeyboardEvent, type UIEvent } from 'react';
import { duplicateVfxEmitter, duplicateVfxModule, moveVfxEmitter, moveVfxModule, removeVfxEmitter, removeVfxModule, seekVfxStage, stepVfxStage, toggleVfxStagePlayback, vfxStageInstance, } from '@/engine/editor/operations/vfx-document-operations';
import { saveVfxEditorDocument } from '@/engine/editor/operations/vfx-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { shortcutBindings } from '@/engine/editor/shortcuts/shortcut-bindings';
import { useVfxEditor } from '@/engine/editor/vfx/ui/use-vfx-editor';
import { buildVfxStackRows, VFX_FRAME_STEP } from '@/engine/editor/vfx/ui/vfx-stack-model';
import { EmitterStack } from './vfx/stack/emitter-stack';
import { VfxTimelineCanvas } from './vfx/timeline/vfx-timeline-canvas';
import { VfxEmptyState } from './vfx/vfx-empty-state';
import { VfxInspector } from './vfx/vfx-inspector';
import { VfxToolbar } from './vfx/vfx-toolbar';
const BIG_STEP_FRAMES = 10;
function isTextEntry(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement))
        return false;
    return target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.getAttribute('role') === 'slider';
}
export function VfxPanel() {
    const session = useEditorSession();
    const editor = useVfxEditor();
    const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
    const [scrollTop, setScrollTop] = useState(0);
    const stackScrollRef = useRef<HTMLDivElement>(null);
    const { document, selectedEmitterId, selectedModuleId } = editor;
    const rows = useMemo(() => (document ? buildVfxStackRows(document, collapsed, selectedEmitterId, selectedModuleId) : []), [document, collapsed, selectedEmitterId, selectedModuleId]);
    const toggleCollapsed = useCallback((emitterId: string) => {
        setCollapsed((current) => {
            const next = new Set(current);
            if (!next.delete(emitterId))
                next.add(emitterId);
            return next;
        });
    }, []);
    const onStackScroll = useCallback((event: UIEvent<HTMLDivElement>) => setScrollTop(event.currentTarget.scrollTop), []);
    const onWheelScroll = useCallback((deltaY: number) => {
        const stack = stackScrollRef.current;
        if (stack)
            stack.scrollTop += deltaY;
    }, []);
    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (!document || isTextEntry(event.target))
            return;
        const action = shortcutBindings.resolve(event.nativeEvent, 'vfx');
        if (!action)
            return;
        const emitter = editor.selectedEmitter;
        const module = editor.selectedModule;
        const frames = event.shiftKey ? BIG_STEP_FRAMES : 1;
        switch (action) {
            case 'vfx.togglePlay':
                toggleVfxStagePlayback(session);
                break;
            case 'vfx.stepForward':
                stepVfxStage(session, frames * VFX_FRAME_STEP);
                break;
            case 'vfx.stepBack':
                seekVfxStage(session, Math.max(0, (vfxStageInstance(session)?.time ?? 0) - frames * VFX_FRAME_STEP));
                break;
            case 'vfx.goToStart':
                seekVfxStage(session, 0);
                break;
            case 'vfx.goToEnd':
                seekVfxStage(session, Math.max(0, document.duration - VFX_FRAME_STEP));
                break;
            case 'vfx.duplicate':
                if (!emitter)
                    return;
                if (module)
                    duplicateVfxModule(session, emitter.id, module.id);
                else
                    duplicateVfxEmitter(session, emitter.id);
                break;
            case 'vfx.moveUp':
            case 'vfx.moveDown': {
                if (!emitter)
                    return;
                const delta = action === 'vfx.moveUp' ? -1 : 1;
                if (module)
                    moveVfxModule(session, emitter.id, module.id, emitter.modules.indexOf(module) + delta);
                else
                    moveVfxEmitter(session, emitter.id, document.emitters.indexOf(emitter) + delta);
                break;
            }
            case 'vfx.delete':
                if (emitter && module)
                    removeVfxModule(session, emitter.id, module.id);
                else if (emitter)
                    removeVfxEmitter(session, emitter.id);
                else
                    return;
                break;
            case 'vfx.save':
                void saveVfxEditorDocument(session);
                break;
            case 'vfx.escape':
                if (module && emitter)
                    editor.selectEmitter(emitter.id);
                else if (emitter)
                    editor.selectEmitter(null);
                else
                    return;
                break;
            default:
                return;
        }
        event.preventDefault();
    };
    if (!editor.isOpen)
        return <VfxEmptyState />;
    return (<div className="flex h-full flex-col outline-none" tabIndex={0} onKeyDown={onKeyDown} aria-label="Editor de efeitos">
      <VfxToolbar />
      
      <div className="flex min-h-0 flex-1 flex-col @3xl/panel:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1">
          <div className="w-[clamp(140px,40%,220px)] shrink-0 @3xl/panel:w-55">
            <EmitterStack rows={rows} scrollRef={stackScrollRef} onScroll={onStackScroll} onToggleCollapsed={toggleCollapsed}/>
          </div>
          <div className="min-w-0 flex-1">
            <VfxTimelineCanvas rows={rows} scrollTop={scrollTop} onWheelScroll={onWheelScroll}/>
          </div>
        </div>
        <div className="max-h-[50%] shrink-0 border-t border-border @3xl/panel:max-h-none @3xl/panel:w-[clamp(264px,34%,340px)] @3xl/panel:border-t-0 @3xl/panel:border-l">
          <VfxInspector />
        </div>
      </div>
    </div>);
}
