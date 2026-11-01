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
    async run(session: EditorSession, options: BuildOptions): Promise<BuildResult> {
        if (this.status === 'running')
            throw new Error('Já existe uma compilação em andamento.');
        this.reset();
        this.lastOptions = options;
        this.lastProjectId = session.project.id;
        this.status = 'running';
        this.startedAt = Date.now();
        this.abort = new AbortController();
        const { signal } = this.abort;
        const platform = buildPlatformOf(options.platform);
        this.ticker = setInterval(() => this.notify(), 500);
        this.say('info', `Compilando "${options.gameName}" ${options.version} para ${platform.label} · ${BUILD_STORES.find((store) => store.id === options.store)?.label ?? options.store}.`);
        let templateProgress: TemplateProgress | null = null;
        const templatePromise = loadTemplate(platform, (progress) => {
            templateProgress = progress;
            if (this.stage !== 'template') {
                this.backgroundDetail = progress.phase === 'download' ? `Helix Player em segundo plano: ${formatBuildBytes(progress.receivedBytes)} de ${formatBuildBytes(progress.totalBytes)}` : null;
                this.notify();
            }
            else
                this.reportTemplate(progress);
        }, signal);
        templatePromise.catch(() => {
        });
        try {
            this.enter('prepare');
            this.progress(0.2, 'Conferindo o projeto');
            const preflight = await preflightBuild(session, options);
            this.checkCancelled();
            for (const note of preflight.notes)
                this.say('info', note);
            for (const warning of preflight.warnings)
                this.say('warn', warning);
            if (preflight.errors.length > 0)
                throw new Error(preflight.errors.join(' '));
            const gameName = options.gameName.trim();
            const buildId = `${gameSlug(gameName)}-${Date.now().toString(36)}`;
            this.progress(0.7, 'Lendo as preferências da engine');
            const settings = snapshotGameSettings();
            const settingsCount = Object.keys(settings).length;
            this.say('info', preflight.net.authoritative ? `Servidor autoritativo: o jogo falará com ${preflight.net.serverUrl}.` : 'Sem servidor autoritativo: o jogo roda inteiro na máquina do jogador.');
            this.say('info', settingsCount > 0 ? `${settingsCount} ${settingsCount === 1 ? 'preferência da engine fora do padrão viaja' : 'preferências da engine fora do padrão viajam'} no manifesto do jogo (física, render, câmera, sombras, áudio).` : 'Todas as preferências da engine estão no padrão; o jogo usa os mesmos valores do playtest.');
            this.progress(1, null);
            this.enter('scripts');
            this.progress(0.1, 'Compilando com o compilador do playtest');
            const precompiled = await precompileClientScripts(session);
            this.checkCancelled();
            this.say('info', `${precompiled.scripts.length} scripts de cliente/compartilhados pré-compilados em ${Math.round(precompiled.durationMs)} ms${precompiled.skipped > 0 ? ` (${precompiled.skipped} não compiláveis ignorados)` : ''}.`);
            for (const name of precompiled.withErrors)
                this.say('warn', `"${name}" tem erros de compilação e ficará de fora, como no playtest.`);
            this.progress(1);
            this.enter('pack');
            const pack = await buildGamePack(session, (label, fraction) => this.progress(fraction, label));
            this.checkCancelled();
            this.say('info', `Pacote do jogo: ${formatBuildBytes(pack.blob.size)} com ${pack.assetCount} ativos.${pack.removedServerScripts.length > 0 ? ` ${pack.removedServerScripts.length} ${pack.removedServerScripts.length === 1 ? 'script de servidor removido' : 'scripts de servidor removidos'}: ${pack.removedServerScripts.join(', ')}.` : ' Nenhum script de servidor no projeto.'}`);
            this.enter('runtime');
            this.progress(0.05, 'Montando a engine sem o editor');
            const runtime = await fetchPlayerRuntime(signal);
            this.checkCancelled();
            this.say('info', `Runtime do jogo: ${formatBuildBytes(runtime.jsBytes)} de código (engine sem editor, compiladores e hub) · ${runtime.manifest.workerEntries.length} workers · montado em ${Math.round(runtime.manifest.durationMs)} ms.`);
            this.progress(0.4, 'Capturando os estilos do jogo');
            const styles = await captureStyles();
            const selection = selectRuntimeAssets(runtime.manifest.publicAssets, pack.referenceText, precompiled.scripts);
            const publicFiles = new Map<string, Uint8Array>();
            let fetched = 0;
            for (const path of selection.paths) {
                this.checkCancelled();
                publicFiles.set(path, await fetchPublicAsset(path, signal));
                fetched++;
                this.progress(0.45 + 0.55 * (fetched / Math.max(selection.paths.length, 1)), `Arquivos da engine: ${fetched} de ${selection.paths.length} (${formatBuildBytes(selection.bytes)})`);
            }
            this.say('info', `${selection.paths.length} arquivos públicos da engine incluídos (${formatBuildBytes(selection.bytes)})${selection.vendors.length > 0 ? ` · runtimes de linguagem: ${selection.vendors.join(', ')}` : ' · nenhum runtime de linguagem estrangeira necessário'}.`);
            this.enter('template');
            this.backgroundDetail = null;
            if (templateProgress)
                this.reportTemplate(templateProgress);
            const template = await templatePromise;
            this.checkCancelled();
            this.say('info', template.fromCache ? `Helix Player ${platform.label} lido do cache do navegador (${formatBuildBytes(template.bytes.byteLength)}, hash conferido).` : `Helix Player ${platform.label} baixado em ${template.downloadSeconds.toFixed(1)} s (${formatBuildBytes(template.bytes.byteLength)}) e verificado contra o SHASUMS256 oficial.`);
            this.progress(1, null);
            this.enter('assemble');
            const identity = gameManifestOf(options, { buildId, playerHash: runtime.manifest.hash, settings, net: preflight.net });
            const slug = identity.slug;
            const base = executableBaseName(gameName);
            const root = `${slug}-${platform.os}-${platform.arch}/`;
            const appPrefix = platform.os === 'macos' ? `${base}.app/Contents/Resources/app/` : 'resources/app/';
            const files: AssembleFile[] = [];
            const add = (path: string, data: ArrayBuffer, extra: Partial<AssembleFile> = {}) => files.push({ path, data, store: COMPRESSED_EXTENSIONS.test(path), ...extra });
            const manifestJson = JSON.stringify(identity, null, 2);
            add(`${appPrefix}package.json`, encode(electronPackageJson(identity)));
            add(`${appPrefix}main.js`, encode(electronMainScript()));
            add(`${appPrefix}helix-game.json`, encode(manifestJson));
            let iconPng: Uint8Array | null = null;
            if (options.icon) {
                try {
                    iconPng = await iconToPng(options.icon);
                    add(`${appPrefix}icon.png`, toBuffer(iconPng));
                }
                catch (cause) {
                    this.say('warn', `Ícone ignorado: ${cause instanceof Error ? cause.message : String(cause)}`);
                }
            }
            add(`${appPrefix}www/index.html`, encode(playerIndexHtml({ title: identity.name, htmlClass: styles.htmlClass, bodyClass: styles.bodyClass, colorScheme: styles.colorScheme })));
            add(`${appPrefix}www/player.css`, encode(styles.css));
            for (const [path, bytes] of runtime.files)
                add(`${appPrefix}www/${path}`, toBuffer(bytes));
            add(`${appPrefix}www/game/game.helix`, await pack.blob.arrayBuffer(), { store: true });
            add(`${appPrefix}www/game/scripts.json`, encode(JSON.stringify(serializeCompiledScripts(buildId, precompiled.scripts))));
            add(`${appPrefix}www/game/helix-game.json`, encode(manifestJson));
            for (const [path, bytes] of publicFiles)
                add(`${appPrefix}www/${path}`, toBuffer(bytes));
            add('LEIA-ME.txt', encode(readmeText(options, identity)));
            if (options.store === 'itch')
                add('.itch.toml', encode(itchManifest(options)));
            if (options.store === 'steam' && options.steamAppId.trim())
                add('steam_appid.txt', encode(options.steamAppId.trim()));
            const layout = this.layoutFor(platform.os, base, slug, root, identity.version);
            const branding: WindowsBranding | null = platform.os === 'windows'
                ? { productName: identity.name, description: identity.name, company: identity.company, version: identity.version, originalFilename: `${base}.exe`, iconPng }
                : null;
            const required = [`${appPrefix}main.js`, `${appPrefix}www/index.html`, `${appPrefix}www/player.js`, `${appPrefix}www/game/game.helix`, `${appPrefix}www/game/scripts.json`];
            const job: AssembleJob = { template: template.bytes, files, layout, branding, required };
            const assembled = await this.assemble(job);
            this.checkCancelled();
            if (assembled.report.branding === 'failed')
                this.say('warn', `O executável ficou com o ícone e a versão do Electron: ${assembled.report.brandingError ?? 'falha ao gravar os recursos.'}`);
            else if (platform.os === 'windows')
                this.say('info', assembled.report.branding === 'applied' ? 'Ícone e informações de versão gravados no executável.' : 'Informações de versão gravadas no executável (sem ícone: nenhum foi escolhido).');
            this.enter('verify');
            this.progress(0.5, 'Conferindo a integridade do pacote');
            if (assembled.report.totalBytes < template.bytes.byteLength * 0.5)
                throw new Error('O pacote final ficou menor do que o template; a montagem está incompleta.');
            this.say('info', `Pacote verificado: ${assembled.report.entryCount} entradas, ${formatBuildBytes(assembled.report.totalBytes)}, SHA-256 ${assembled.report.sha256.slice(0, 16)}….`);
            this.progress(1);
            this.enter('deliver');
            const fileName = buildArtifactName(options);
            const blob = new Blob([assembled.bytes], { type: 'application/zip' });
            const url = URL.createObjectURL(blob);
            triggerDownload(url, fileName);
            setTimeout(() => URL.revokeObjectURL(url), 60000);
            this.leave();
            const durationSeconds = (Date.now() - (this.startedAt ?? Date.now())) / 1000;
            const summary: BuildSummary = {
                gameName: identity.name,
                version: identity.version,
                platformLabel: platform.label,
                storeLabel: BUILD_STORES.find((store) => store.id === options.store)?.label ?? options.store,
                launchTarget: launchTargetOf(options),
                totalBytes: assembled.report.totalBytes,
                templateBytes: template.bytes.byteLength,
                templateFromCache: template.fromCache,
                runtimeJsBytes: runtime.jsBytes,
                cssBytes: styles.css.length,
                packBytes: pack.blob.size,
                publicAssetBytes: selection.bytes,
                publicAssetCount: selection.paths.length,
                vendors: selection.vendors,
                precompiledScripts: precompiled.scripts.length,
                scriptsWithErrors: precompiled.withErrors,
                removedServerScripts: pack.removedServerScripts,
                settingsCount,
                net: preflight.net,
                durationSeconds,
                sha256: assembled.report.sha256,
                branding: assembled.report.branding,
            };
            this.result = { blob, fileName, report: assembled.report, summary };
            this.status = 'done';
            this.finishedAt = Date.now();
            saveMeasuredDurations(this.durations);
            this.say('info', `Compilação concluída em ${durationSeconds.toFixed(1)} s: ${fileName} (${formatBuildBytes(assembled.report.totalBytes)}).`);
            return this.result;
        }
        catch (cause) {
            const cancelled = cause instanceof BuildCancelled || (cause instanceof DOMException && cause.name === 'AbortError');
            this.status = cancelled ? 'cancelled' : 'failed';
            this.error = cancelled ? 'Compilação cancelada.' : cause instanceof Error ? cause.message : String(cause);
            this.finishedAt = Date.now();
            this.say(cancelled ? 'warn' : 'error', this.error);
            throw cause;
        }
        finally {
            if (this.ticker)
                clearInterval(this.ticker);
            this.ticker = null;
            this.abort = null;
            this.worker?.terminate();
            this.worker = null;
            this.backgroundDetail = null;
            this.stage = null;
            this.notify();
        }
    }
    downloadAgain(): void {
        if (!this.result)
            return;
        const url = URL.createObjectURL(this.result.blob);
        triggerDownload(url, this.result.fileName);
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
    private reportTemplate(progress: TemplateProgress): void {
        if (progress.phase === 'download') {
            const fraction = progress.totalBytes > 0 ? (progress.receivedBytes / progress.totalBytes) * 0.9 : 0;
            const speed = progress.bytesPerSecond > 0 ? ` · ${formatBuildBytes(progress.bytesPerSecond)}/s` : '';
            this.progress(fraction, `${formatBuildBytes(progress.receivedBytes)} de ${formatBuildBytes(progress.totalBytes)}${speed}`);
        }
        else if (progress.phase === 'verify')
            this.progress(0.92, 'Conferindo o SHA-256 do template');
        else
            this.progress(0.97, 'Guardando no cache do navegador');
    }
    private layoutFor(os: 'windows' | 'macos' | 'linux', base: string, slug: string, root: string, version: string): AssembleLayout {
        if (os === 'windows') {
            return { os, root, drop: ['resources/default_app.asar'], renames: [{ from: 'electron.exe', to: `${base}.exe`, prefix: false }], executable: 'electron.exe', textPatches: [] };
        }
        if (os === 'macos') {
            const plist = 'Electron.app/Contents/Info.plist';
            return {
                os,
                root,
                drop: ['Electron.app/Contents/Resources/default_app.asar'],
                renames: [{ from: 'Electron.app/', to: `${base}.app/`, prefix: true }],
                executable: 'Electron.app/Contents/MacOS/Electron',
                textPatches: [
                    {
                        path: plist,
                        replacements: [
                            { pattern: '(<key>CFBundleDisplayName</key>\\s*<string>)[^<]*', replacement: `$1${base}` },
                            { pattern: '(<key>CFBundleName</key>\\s*<string>)[^<]*', replacement: `$1${base}` },
                            { pattern: '(<key>CFBundleIdentifier</key>\\s*<string>)[^<]*', replacement: `$1com.helix-engine.${slug}` },
                            { pattern: '(<key>CFBundleShortVersionString</key>\\s*<string>)[^<]*', replacement: `$1${version}` },
                            { pattern: '(<key>CFBundleVersion</key>\\s*<string>)[^<]*', replacement: `$1${version}` },
                        ],
                    },
                ],
            };
        }
        return { os, root, drop: ['resources/default_app.asar'], renames: [{ from: 'electron', to: slug, prefix: false }], executable: 'electron', textPatches: [] };
    }
    private assemble(job: AssembleJob): Promise<{
        bytes: ArrayBuffer;
        report: AssembleReport;
    }> {
        return new Promise((resolve, reject) => {
            const worker = new Worker(new URL('./assemble.worker.ts', import.meta.url), { type: 'module', name: 'helix-build-assemble' });
            this.worker = worker;
            worker.onmessage = (event: MessageEvent<AssembleWorkerMessage>) => {
                const message = event.data;
                if (message.type === 'progress')
                    this.progress(message.fraction, message.label);
                else if (message.type === 'done') {
                    worker.terminate();
                    this.worker = null;
                    resolve({ bytes: message.bytes, report: message.report });
                }
                else {
                    worker.terminate();
                    this.worker = null;
                    reject(new Error(message.message));
                }
            };
            worker.onerror = (event) => {
                worker.terminate();
                this.worker = null;
                reject(new Error(event.message || 'O worker de montagem falhou.'));
            };
            const transfer: Transferable[] = [job.template, ...job.files.map((file) => file.data)];
            worker.postMessage(job, transfer);
        });
    }
}
export const gameCompiler = new GameCompiler();
export function stageLabel(stage: BuildStageId): string {
    return BUILD_STAGES.find((candidate) => candidate.id === stage)?.label ?? stage;
}
