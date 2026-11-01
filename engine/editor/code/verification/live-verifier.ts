import type { EditorSession } from '@/engine/editor/session/editor-session';
import { collectScriptSources, hashSource, toScriptCodeDiagnostics } from '@/engine/scripting/compiler/project-sources';
import type { ScriptSourceInput } from '@/engine/scripting/compiler/script-compiler';
import { scriptLanguage } from '@/engine/scripting/script-languages';
import { engineSettings } from '@/engine/settings/engine-settings-store';
import type { CodeTab } from '../code-editor';
import { verifierCost, verifySource, type VerifierCost } from './verify-source';
const DEBOUNCE_MS: Record<Exclude<VerifierCost, 'none'>, number> = { instant: 350, heavy: 900, remote: 1800 };
const DELAY_FACTOR: Record<string, number> = { fast: 0.5, normal: 1, relaxed: 2 };
const OFF_DETAIL = 'Verificação ao vivo desligada nas preferências';
interface Pending {
    timer: ReturnType<typeof setTimeout> | null;
    running: boolean;
    again: boolean;
}
export class LiveVerifier {
    private readonly pending = new Map<string, Pending>();
    private librarySignature = '';
    private syncing: Promise<void> | null = null;
    private disposed = false;
    constructor(private readonly session: EditorSession) { }
    get enabled(): boolean {
        return engineSettings.get('code.liveVerify');
    }
    schedule(assetId: string): void {
        const tab = this.session.code.tab(assetId);
        if (!tab)
            return;
        if (!this.enabled) {
            this.publishOff(tab);
            return;
        }
        const cost = verifierCost(tab.document.language);
        if (cost === 'none') {
            this.publishUnavailable(tab);
            return;
        }
        const factor = DELAY_FACTOR[engineSettings.get('code.verifyDelay')] ?? 1;
        this.defer(assetId, Math.round(DEBOUNCE_MS[cost] * factor));
    }
    check(assetId: string): void {
        const tab = this.session.code.tab(assetId);
        if (!tab)
            return;
        if (!this.enabled) {
            this.publishOff(tab);
            return;
        }
        if (verifierCost(tab.document.language) === 'none') {
            this.publishUnavailable(tab);
            return;
        }
        this.defer(assetId, 40);
    }
    settingsChanged(): void {
        for (const tab of this.session.code.tabs) {
            if (this.enabled)
                this.check(tab.assetId);
            else
                this.publishOff(tab);
        }
    }
    private defer(assetId: string, delay: number): void {
        const entry = this.entry(assetId);
        if (entry.timer)
            clearTimeout(entry.timer);
        entry.timer = setTimeout(() => {
            entry.timer = null;
            void this.run(assetId);
        }, delay);
    }
    private publishOff(tab: CodeTab): void {
        const entry = this.pending.get(tab.assetId);
        if (entry?.timer) {
            clearTimeout(entry.timer);
            entry.timer = null;
        }
        const { code } = this.session;
        const current = code.verifierFor(tab.assetId);
        if (current.status === 'idle' && current.detail === OFF_DETAIL)
            return;
        code.setLiveDiagnostics(tab.assetId, [], { status: 'idle', detail: OFF_DETAIL, errors: 0, warnings: 0 });
    }
    dispose(): void {
        this.disposed = true;
        for (const entry of this.pending.values())
            if (entry.timer)
                clearTimeout(entry.timer);
        this.pending.clear();
    }
    private entry(assetId: string): Pending {
        let entry = this.pending.get(assetId);
        if (!entry) {
            entry = { timer: null, running: false, again: false };
            this.pending.set(assetId, entry);
        }
        return entry;
    }
    private publishUnavailable(tab: CodeTab): void {
        const { code } = this.session;
        const detail = `${scriptLanguage(tab.document.language).label} não tem verificador nesta versão da engine`;
        const current = code.verifierFor(tab.assetId);
        if (current.status === 'unavailable' && current.detail === detail)
            return;
        code.setLiveDiagnostics(tab.assetId, [], { status: 'unavailable', detail, errors: 0, warnings: 0 });
    }
    private async syncLibrary(): Promise<void> {
        const assets = this.session.library.byKind('script');
        const signature = assets.map((asset) => `${asset.id}:${asset.contentHash}:${asset.name}`).join('|');
        if (signature === this.librarySignature)
            return;
        if (!this.syncing) {
            this.syncing = collectScriptSources(this.session)
                .then(({ inputs }) => {
                this.session.scripts.compiler.syncScripts(inputs);
                this.librarySignature = signature;
            })
                .finally(() => {
                this.syncing = null;
            });
        }
        await this.syncing;
    }
    private async run(assetId: string): Promise<void> {
        if (this.disposed || !this.enabled)
            return;
        const entry = this.entry(assetId);
        if (entry.running) {
            entry.again = true;
            return;
        }
        const { code } = this.session;
        const tab = code.tab(assetId);
        if (!tab)
            return;
        entry.running = true;
        const previous = code.verifierFor(assetId);
        code.setVerifier(assetId, { ...previous, status: previous.status === 'idle' || previous.status === 'unavailable' ? 'loading' : 'checking', detail: previous.detail });
        const input = sourceInputOf(tab);
        try {
            await this.syncLibrary();
            const outcome = await verifySource(this.session, input);
            if (this.disposed || !this.enabled)
                return;
            const latest = code.tab(assetId);
            const stale = !latest || latest.document.source !== input.source;
            if (outcome.status === 'unavailable') {
                code.setLiveDiagnostics(assetId, [], { status: 'unavailable', detail: outcome.detail, errors: 0, warnings: 0 });
            }
            else if (!stale) {
                const diagnostics = toScriptCodeDiagnostics(assetId, outcome.diagnostics);
                const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length;
                const warnings = diagnostics.filter((diagnostic) => diagnostic.severity === 'warning').length;
                code.setLiveDiagnostics(assetId, diagnostics, { status: 'ok', detail: outcome.detail, errors, warnings });
            }
        }
        catch (cause) {
            if (!this.disposed)
                code.setLiveDiagnostics(assetId, [], { status: 'unavailable', detail: cause instanceof Error ? cause.message : String(cause), errors: 0, warnings: 0 });
        }
        finally {
            entry.running = false;
            if (entry.again && !this.disposed) {
                entry.again = false;
                void this.run(assetId);
            }
        }
    }
}
export function sourceInputOf(tab: CodeTab, source: string = tab.document.source): ScriptSourceInput {
    const { document } = tab;
    return { assetId: tab.assetId, name: document.name, language: document.language, source, runContext: document.runContext, contentHash: hashSource(source) };
}
const verifiers = new WeakMap<EditorSession, LiveVerifier>();
export function liveVerifierFor(session: EditorSession): LiveVerifier {
    let verifier = verifiers.get(session);
    if (!verifier) {
        const created = new LiveVerifier(session);
        verifiers.set(session, created);
        session.onDispose(() => created.dispose());
        verifier = created;
    }
    return verifier;
}
