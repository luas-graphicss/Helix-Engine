'use client';
import type { KeyboardEvent } from 'react';
import { MIN_REGION_SECONDS } from '@/engine/audio/clip/audio-clip-settings';
import { useAudioEditor } from '@/engine/editor/audio/ui/use-audio-editor';
import { patchAudioClip } from '@/engine/editor/operations/audio-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { shortcutBindings } from '@/engine/editor/shortcuts/shortcut-bindings';
import { AudioEmptyState } from './audio/audio-empty-state';
import { AudioToolbar } from './audio/audio-toolbar';
import { zoomAroundCursor, ZOOM_STEP_FACTOR } from './audio/audio-zoom';
import { ClipInspector } from './audio/clip-inspector';
import { MixerView } from './audio/mixer-view';
import { SceneAudioView } from './audio/scene-audio-view';
import { WaveformCanvas } from './audio/waveform-canvas';
const STEP_SECONDS = 0.1;
const BIG_STEP_SECONDS = 1;
function isTextEntry(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement))
        return false;
    return target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.getAttribute('role') === 'slider';
}
export function AudioPanel() {
    const session = useEditorSession();
    const editor = useAudioEditor();
    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (isTextEntry(event.target))
            return;
        const asset = editor.asset;
        const region = editor.region;
        if (!asset || !region || editor.view !== 'clip')
            return;
        const action = shortcutBindings.resolve(event.nativeEvent, 'audio');
        if (!action)
            return;
        const seconds = event.shiftKey ? BIG_STEP_SECONDS : STEP_SECONDS;
        switch (action) {
            case 'audio.togglePlay':
                editor.togglePlay();
                break;
            case 'audio.stepBack':
                editor.stepSeconds(-seconds);
                break;
            case 'audio.stepForward':
                editor.stepSeconds(seconds);
                break;
            case 'audio.goToStart':
                editor.goToStart();
                break;
            case 'audio.goToEnd':
                editor.goToEnd();
                break;
            case 'audio.trimStart':
                patchAudioClip(session, asset, { trimStart: Math.min(editor.position, region.end - MIN_REGION_SECONDS) }, `Início do recorte de ${asset.name}`);
                break;
            case 'audio.trimEnd': {
                const end = Math.max(editor.position, region.start + MIN_REGION_SECONDS);
                patchAudioClip(session, asset, { trimEnd: end >= editor.duration - 1e-3 ? null : end }, `Fim do recorte de ${asset.name}`);
                break;
            }
            case 'audio.bypass':
                editor.setBypass(!editor.bypass);
                break;
            case 'audio.zoomIn':
                zoomAroundCursor(editor, 1 / ZOOM_STEP_FACTOR);
                break;
            case 'audio.zoomOut':
                zoomAroundCursor(editor, ZOOM_STEP_FACTOR);
                break;
            case 'audio.zoomAll':
                editor.setZoom(null);
                break;
            default:
                return;
        }
        event.preventDefault();
    };
    const showToolbar = editor.view !== 'clip' || editor.active;
    return (<div className="flex h-full flex-col outline-none" tabIndex={0} onKeyDown={onKeyDown} aria-label="Editor de áudio">
      {showToolbar && <AudioToolbar />}
      
      <div className="flex min-h-0 flex-1 flex-col @2xl/panel:flex-row">
        {editor.view === 'mixer' ? (<MixerView />) : editor.view === 'scene' ? (<SceneAudioView />) : editor.active ? (<>
            <div className="min-h-0 min-w-0 flex-1">
              <WaveformCanvas />
            </div>
            <ClipInspector />
          </>) : (<AudioEmptyState />)}
      </div>
    </div>);
}
