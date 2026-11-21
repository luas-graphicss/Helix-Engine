import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server.edge';
import type { AssetKind, LibraryAsset } from '@/engine/assets/library/asset-types';
import { Scene } from '@/engine/core/scene/scene';
import { History } from '@/engine/editor/history/history';
import { collectLocalizationIssues, type LocalizationIssues } from '@/engine/editor/localization/localization-issues';
import { LocalizationPanel } from '@/engine/editor/panels/localization-panel';
import { AssetsView } from '@/engine/editor/panels/localization/assets/assets-view';
import { IssuesView } from '@/engine/editor/panels/localization/issues/issues-view';
import { LocalesView } from '@/engine/editor/panels/localization/locales/locales-view';
import { StringsView } from '@/engine/editor/panels/localization/strings/strings-view';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { EditorSessionProvider } from '@/engine/editor/session/editor-session-context';
import { LocalizationRuntime } from '@/engine/localization/runtime/localization-runtime';
export interface LocalizationPanelStage {
    readonly scene: Scene;
    readonly history: History;
    readonly runtime: LocalizationRuntime;
    readonly session: EditorSession;
    readonly logged: string[];
    setPlaying(playing: boolean): void;
}
const LIBRARY = [
    { id: 'logo-en', kind: 'texture', name: 'Logo EN' },
    { id: 'logo-pt', kind: 'texture', name: 'Logo PT' },
    { id: 'voice-en', kind: 'audio', name: 'Narração EN' },
] as unknown as LibraryAsset[];
export function createLocalizationPanelStage(deviceLocales: readonly string[]): LocalizationPanelStage {
    const scene = new Scene();
    const history = new History(() => undefined);
    const logged: string[] = [];
    const record = (_source: string, message: string): void => {
        logged.push(message);
    };
    const runtime = new LocalizationRuntime({ settings: () => scene.localization, preferredLocales: () => deviceLocales, warn: (message) => logged.push(message) });
    const scripts = { running: false, mode: 'play', localization: runtime };
    const stub = {
        scene,
        history,
        scripts,
        library: {
            size: LIBRARY.length,
            get: (id: string) => LIBRARY.find((asset) => asset.id === id) ?? null,
            byKind: (kind: AssetKind) => LIBRARY.filter((asset) => asset.kind === kind),
        },
        log: { info: record, warn: record, error: record },
        notify: () => undefined,
        subscribeTopic: () => () => undefined,
        getTopicVersion: () => 0,
    };
    return {
        scene,
        history,
        runtime,
        session: stub as unknown as EditorSession,
        logged,
        setPlaying: (playing) => {
            scripts.running = playing;
        },
    };
}
export function issuesOf(stage: LocalizationPanelStage): LocalizationIssues {
    return collectLocalizationIssues(stage.scene.localization, (assetId) => stage.session.library.get(assetId) !== null);
}
function render(stage: LocalizationPanelStage, node: ReactNode): string {
    return renderToStaticMarkup(<EditorSessionProvider session={stage.session}>{node}</EditorSessionProvider>);
}
export function renderPanel(stage: LocalizationPanelStage): string {
    return render(stage, <LocalizationPanel />);
}
export function renderStrings(stage: LocalizationPanelStage, focusKey: string | null = null): string {
    return render(stage, <StringsView settings={stage.scene.localization} issues={issuesOf(stage)} focusKey={focusKey} onFocus={() => undefined}/>);
}
export function renderAssets(stage: LocalizationPanelStage): string {
    return render(stage, <AssetsView settings={stage.scene.localization}/>);
}
export function renderLocales(stage: LocalizationPanelStage): string {
    return render(stage, <LocalesView settings={stage.scene.localization}/>);
}
export function renderIssues(stage: LocalizationPanelStage): string {
    return render(stage, <IssuesView issues={issuesOf(stage)} onOpen={() => undefined}/>);
}
