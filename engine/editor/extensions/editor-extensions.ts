import type { EditorSession } from '@/engine/editor/session/editor-session';
import type { ScriptRenderRequest } from '@/engine/renderer/script-hooks';
import { ExtensionHost } from './host/extension-host';
import type { InspectorContribution } from './inspectors/inspector-contribution';
import type { MenuContribution } from './menus/menu-contribution';
import { ContributionRegistry, RegistrationClock, type Contribution, type OwnedContributions } from './registry/contribution-registry';
import type { WindowContribution } from './windows/window-contribution';
export class EditorExtensions {
    readonly host: ExtensionHost;
    readonly windows: ContributionRegistry<WindowContribution>;
    readonly menus: ContributionRegistry<MenuContribution>;
    readonly inspectors: ContributionRegistry<InspectorContribution>;
    private readonly clock = new RegistrationClock();
    private readonly registries: OwnedContributions[] = [];
    constructor(session: EditorSession) {
        this.windows = this.createRegistry();
        this.menus = this.createRegistry();
        this.inspectors = this.createRegistry();
        this.host = new ExtensionHost(session, {
            mark: () => this.clock.current,
            sweep: (assetId, mark) => this.registries.forEach((registry) => registry.sweep(assetId, mark)),
            release: (assetId) => this.registries.forEach((registry) => registry.sweep(assetId, Infinity)),
            releaseAll: () => this.registries.forEach((registry) => registry.clear()),
        });
    }
    get renderRequest(): ScriptRenderRequest | null {
        return this.host.runtime?.renderRequest ?? null;
    }
    ownerAssetId(current: {
        readonly assetId: string;
    } | null): string | null {
        return current?.assetId ?? this.host.loadingAssetId;
    }
    contributionCount(assetId: string): number {
        return this.registries.reduce((total, registry) => total + registry.countOwnedBy(assetId), 0);
    }
    start(): () => void {
        return this.host.start();
    }
    tick(deltaSeconds: number): void {
        this.host.tick(deltaSeconds);
    }
    attachViewport(canvas: HTMLCanvasElement | null): void {
        this.host.attachViewport(canvas);
    }
    dispose(): void {
        this.host.stop();
    }
    private createRegistry<TContribution extends Contribution>(onRemoved?: (contribution: TContribution) => void): ContributionRegistry<TContribution> {
        const registry = new ContributionRegistry<TContribution>(this.clock, onRemoved);
        this.registries.push(registry);
        return registry;
    }
}
