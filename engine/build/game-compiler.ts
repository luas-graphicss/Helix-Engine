import { triggerDownload } from '@/engine/core/transfer/download-blob';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import type { GameNet } from '@/engine/player/game-manifest';
import { snapshotGameSettings } from '@/engine/player/game-settings';
import type { AssembleFile, AssembleJob, AssembleLayout, AssembleReport, AssembleWorkerMessage } from './assemble-job';
import { preflightBuild } from './build-preflight';
import { BUILD_STAGES, estimateProgress, formatBuildBytes, predictStageSeconds, saveMeasuredDurations, type BuildLogLevel, type BuildLogLine, type BuildProgressSnapshot, type BuildStageId, type BuildStatus } from './build-progress';
import { buildArtifactName, buildPlatformOf, BUILD_STORES, executableBaseName, gameSlug, type BuildOptions } from './build-targets';
import { serializeCompiledScripts } from './compiled-scripts';
import { electronMainScript, electronPackageJson, gameManifestOf, itchManifest, launchTargetOf, playerIndexHtml, readmeText } from './desktop-shell';
import { buildGamePack, precompileClientScripts, selectRuntimeAssets } from './game-pack';
import type { WindowsBranding } from './pe-branding';
import { captureStyles, fetchPlayerRuntime, fetchPublicAsset } from './player-bundle';
import { loadTemplate, type TemplateProgress } from './template-store';
export interface BuildSummary {
    readonly gameName: string;
    readonly version: string;
    readonly platformLabel: string;
    readonly storeLabel: string;
    readonly launchTarget: string;
    readonly totalBytes: number;
    readonly templateBytes: number;
    readonly templateFromCache: boolean;
    readonly runtimeJsBytes: number;
    readonly cssBytes: number;
    readonly packBytes: number;
    readonly publicAssetBytes: number;
    readonly publicAssetCount: number;
    readonly vendors: readonly string[];
    readonly precompiledScripts: number;
    readonly scriptsWithErrors: readonly string[];
    readonly removedServerScripts: readonly string[];
    readonly settingsCount: number;
    readonly net: GameNet;
    readonly durationSeconds: number;
    readonly sha256: string;
    readonly branding: AssembleReport['branding'];
}
export interface BuildResult {
    readonly blob: Blob;
    readonly fileName: string;
    readonly report: AssembleReport;
    readonly summary: BuildSummary;
}
type Listener = () => void;
class BuildCancelled extends Error {
    constructor() {
        super('Compilação cancelada.');
    }
}
const COMPRESSED_EXTENSIONS = /\.(png|jpe?g|webp|gif|glb|zip|helix|woff2?|mp3|ogg|mp4|webm|ktx2)$/i;
async function iconToPng(icon: Blob, size = 256): Promise<Uint8Array> {
    const bitmap = await createImageBitmap(icon);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context)
        throw new Error('Não foi possível preparar o ícone.');
    const scale = Math.min(size / bitmap.width, size / bitmap.height);
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    context.drawImage(bitmap, Math.floor((size - width) / 2), Math.floor((size - height) / 2), width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob)
        throw new Error('Não foi possível converter o ícone para PNG.');
    return new Uint8Array(await blob.arrayBuffer());
}
function encode(text: string): ArrayBuffer {
    return new TextEncoder().encode(text).buffer as ArrayBuffer;
}
function toBuffer(bytes: Uint8Array): ArrayBuffer {
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
export class GameCompiler {
    private status: BuildStatus = 'idle';
    private stage: BuildStageId | null = null;
    private stageFraction = 0;
    private detail: string | null = null;
    private startedAt: number | null = null;
    private finishedAt: number | null = null;
    private stageStartedAt = 0;
    private readonly completed = new Set<BuildStageId>();
    private readonly durations: Partial<Record<BuildStageId, number>> = {};
    private predicted = predictStageSeconds();
    private log: BuildLogLine[] = [];
    private readonly listeners = new Set<Listener>();
    private abort: AbortController | null = null;
    private worker: Worker | null = null;
    private ticker: ReturnType<typeof setInterval> | null = null;
    private backgroundDetail: string | null = null;
    result: BuildResult | null = null;
    error: string | null = null;
    lastOptions: BuildOptions | null = null;
    lastProjectId: string | null = null;
    get isRunning(): boolean {
        return this.status === 'running';
    }
    subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    private snapshotCache: BuildProgressSnapshot | null = null;
    snapshot(): BuildProgressSnapshot {
        if (this.snapshotCache)
            return this.snapshotCache;
        const elapsed = this.stage ? (performance.now() - this.stageStartedAt) / 1000 : 0;
        const { totalFraction, etaSeconds } = estimateProgress({ predicted: this.predicted, current: this.stage, currentFraction: this.stageFraction, currentElapsedSeconds: elapsed, completed: this.completed });
        const detail = this.detail && this.backgroundDetail ? `${this.detail} · ${this.backgroundDetail}` : (this.detail ?? this.backgroundDetail);
        this.snapshotCache = {
            status: this.status,
            stage: this.stage,
            stageFraction: this.stageFraction,
            totalFraction: this.status === 'done' ? 1 : totalFraction,
            etaSeconds: this.status === 'running' ? etaSeconds : null,
            detail,
            startedAt: this.startedAt,
            finishedAt: this.finishedAt,
            log: this.log,
            completed: new Set(this.completed),
        };
        return this.snapshotCache;
    }
    private notify(): void {
        this.snapshotCache = null;
        for (const listener of this.listeners)
            listener();
    }
    private say(level: BuildLogLevel, message: string): void {
        this.log = [...this.log, { at: Date.now(), level, message }];
        this.notify();
    }
    private checkCancelled(): void {
        if (this.abort?.signal.aborted)
            throw new BuildCancelled();
    }
    private enter(stage: BuildStageId): void {
        this.checkCancelled();
        if (this.stage)
            this.leave();
        this.stage = stage;
        this.stageFraction = 0;
        this.detail = null;
        this.stageStartedAt = performance.now();
        this.notify();
    }
    private progress(fraction: number, detail: string | null = this.detail): void {
        this.stageFraction = Math.min(Math.max(fraction, 0), 1);
        this.detail = detail;
        this.notify();
    }
    private leave(): void {
        if (!this.stage)
            return;
        this.durations[this.stage] = (performance.now() - this.stageStartedAt) / 1000;
        this.completed.add(this.stage);
        this.stage = null;
        this.stageFraction = 0;
        this.detail = null;
        this.notify();
    }
    cancel(): void {
        if (this.status !== 'running')
            return;
        this.abort?.abort();
        this.worker?.terminate();
        this.worker = null;
    }
    reset(): void {
        if (this.status === 'running')
            return;
        this.status = 'idle';
        this.result = null;
        this.error = null;
        this.log = [];
        this.completed.clear();
        this.stage = null;
        this.startedAt = null;
        this.finishedAt = null;
        this.backgroundDetail = null;
        this.notify();
    }
}
