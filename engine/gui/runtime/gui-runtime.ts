import type { GuiDocument, GuiInsets, GuiNode, GuiPoint, GuiVideoControl } from '@/engine/gui/document/gui-document';
import { guiFonts } from '@/engine/gui/fonts/gui-font-registry';
import { guiIcons } from '@/engine/gui/icons/gui-icon-catalog';
import { guiImages } from '@/engine/gui/images/gui-image-cache';
import { hitTestGui, toLocal } from '@/engine/gui/layout/gui-hit-test';
import { layoutGuiDocument, type GuiLayoutEntry, type GuiLayoutResult } from '@/engine/gui/layout/gui-layout';
import type { GuiMatrix } from '@/engine/gui/layout/gui-matrix';
import { guiVideos, type GuiVideoHandle } from '@/engine/gui/media/gui-video-cache';
import type { GuiViewportProvider } from '@/engine/gui/media/gui-viewport-provider';
import { guiMediaKey, renderGuiLayout, VIDEO_PLAYING_KEY, VIEWPORT_PITCH_KEY, VIEWPORT_YAW_KEY, VIEWPORT_ZOOM_KEY, type GuiRenderState, type GuiRuntimeValue, } from '@/engine/gui/render/gui-renderer';
import { guiTextMeasurer } from '@/engine/gui/text/gui-text-measure';
export type GuiRuntimeEventType = 'activate' | 'change' | 'focus' | 'blur';
export interface GuiRuntimeEvent {
    readonly type: GuiRuntimeEventType;
    readonly nodeId: string;
    readonly nodeName: string;
    readonly value?: GuiRuntimeValue;
}
type EventListener = (event: GuiRuntimeEvent) => void;
interface Hit {
    readonly layout: GuiLayoutResult;
    readonly entry: GuiLayoutEntry;
}
interface ViewportDrag {
    readonly hit: Hit;
    lastX: number;
    lastY: number;
}
const ORBIT_DEGREES_PER_PIXEL = 0.4;
const ZOOM_PER_WHEEL_UNIT = 0.0015;
function isDisabled(node: GuiNode): boolean {
    return node.control?.kind === 'button' && node.control.disabled;
}
function interactive(entry: GuiLayoutEntry): boolean {
    return entry.node.interactable && !isDisabled(entry.node) && entry.node.kind !== 'frame' && entry.node.kind !== 'scroll';
}
function ownerId(key: string): string {
    const separator = key.indexOf(':');
    return separator === -1 ? key : key.slice(0, separator);
}
export class GuiRuntime {
    private documents: readonly GuiDocument[] = [];
    private layouts: GuiLayoutResult[] = [];
    private viewport: GuiPoint = { x: 1, y: 1 };
    private safeArea: GuiInsets = { top: 0, right: 0, bottom: 0, left: 0 };
    private hoverEnabled = true;
    private layoutDirty = true;
    private hovered: string | null = null;
    private pressed: string | null = null;
    private focused: string | null = null;
    private readonly values = new Map<string, GuiRuntimeValue>();
    private readonly scroll = new Map<string, GuiPoint>();
    private time = 0;
    private sliderDrag: Hit | null = null;
    private viewportDrag: ViewportDrag | null = null;
    private readonly listeners = new Set<EventListener>();
    private videoNodes: GuiNode[] = [];
    private viewportNodes: GuiNode[] = [];
    private readonly lastVideoPlaying = new Map<string, boolean>();
    private mediaScope = 'runtime';
    private mediaGain = 1;
    private viewports: GuiViewportProvider | null = null;
    needsRender = true;
    onEvent(listener: EventListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    private emit(type: GuiRuntimeEventType, node: GuiNode, value?: GuiRuntimeValue): void {
        const event: GuiRuntimeEvent = { type, nodeId: node.id, nodeName: node.name, value };
        for (const listener of this.listeners)
            listener(event);
    }
    setMediaScope(scope: string): void {
        if (scope === this.mediaScope)
            return;
        guiVideos.releaseScope(`${this.mediaScope}:`);
        this.mediaScope = scope;
        this.needsRender = true;
    }
    setMediaGain(gain: number): void {
        this.mediaGain = Math.max(0, Math.min(1, gain));
    }
    setViewportProvider(provider: GuiViewportProvider | null): void {
        if (provider === this.viewports)
            return;
        if (this.viewports)
            for (const node of this.viewportNodes)
                this.viewports.release(guiMediaKey(this.mediaScope, node.id));
        this.viewports = provider;
        this.needsRender = true;
    }
    get animating(): boolean {
        if (this.sliderDrag || this.viewportDrag)
            return true;
        for (const node of this.videoNodes) {
            const handle = guiVideos.peek(guiMediaKey(this.mediaScope, node.id));
            if (handle?.playing)
                return true;
        }
        if (this.viewportNodes.length === 0)
            return false;
        if (this.viewports?.animating)
            return true;
        return this.viewportNodes.some((node) => node.control?.kind === 'viewport' && node.control.autoRotate !== 0);
    }
    setDocuments(documents: readonly GuiDocument[]): void {
        this.documents = [...documents].sort((a, b) => a.displayOrder - b.displayOrder);
        this.layoutDirty = true;
        this.needsRender = true;
        const ids = new Set<string>();
        for (const document of this.documents)
            collect(document.root, ids);
        for (const key of [...this.values.keys()])
            if (!ids.has(ownerId(key)))
                this.values.delete(key);
        for (const key of [...this.scroll.keys()])
            if (!ids.has(key))
                this.scroll.delete(key);
        if (this.hovered && !ids.has(this.hovered))
            this.hovered = null;
        if (this.pressed && !ids.has(this.pressed))
            this.pressed = null;
        if (this.focused && !ids.has(this.focused))
            this.focused = null;
        this.collectMedia();
    }
    private collectMedia(): void {
        const previousViewports = this.viewportNodes;
        this.videoNodes = [];
        this.viewportNodes = [];
        for (const document of this.documents) {
            walk(document.root, (node) => {
                if (!node.visible)
                    return;
                if (node.control?.kind === 'video')
                    this.videoNodes.push(node);
                else if (node.control?.kind === 'viewport')
                    this.viewportNodes.push(node);
            });
        }
        const alive = new Set(this.videoNodes.map((node) => guiMediaKey(this.mediaScope, node.id)));
        guiVideos.retainOnly(`${this.mediaScope}:`, alive);
        for (const key of [...this.lastVideoPlaying.keys()])
            if (!alive.has(key))
                this.lastVideoPlaying.delete(key);
        if (this.viewports) {
            const liveViewports = new Set(this.viewportNodes.map((node) => node.id));
            for (const node of previousViewports)
                if (!liveViewports.has(node.id))
                    this.viewports.release(guiMediaKey(this.mediaScope, node.id));
        }
    }
    reset(): void {
        this.hovered = null;
        this.pressed = null;
        this.focused = null;
        this.sliderDrag = null;
        this.viewportDrag = null;
        this.values.clear();
        this.scroll.clear();
        this.lastVideoPlaying.clear();
        guiVideos.releaseScope(`${this.mediaScope}:`);
        this.layoutDirty = true;
        this.needsRender = true;
    }
    dispose(): void {
        guiVideos.releaseScope(`${this.mediaScope}:`);
        if (this.viewports)
            for (const node of this.viewportNodes)
                this.viewports.release(guiMediaKey(this.mediaScope, node.id));
        this.videoNodes = [];
        this.viewportNodes = [];
        this.listeners.clear();
    }
    setViewport(viewport: GuiPoint): void {
        if (viewport.x === this.viewport.x && viewport.y === this.viewport.y)
            return;
        this.viewport = viewport;
        this.layoutDirty = true;
        this.needsRender = true;
    }
    setSafeArea(safeArea: GuiInsets): void {
        const current = this.safeArea;
        if (safeArea.top === current.top && safeArea.right === current.right && safeArea.bottom === current.bottom && safeArea.left === current.left)
            return;
        this.safeArea = safeArea;
        this.layoutDirty = true;
        this.needsRender = true;
    }
    setHoverEnabled(enabled: boolean): void {
        if (enabled === this.hoverEnabled)
            return;
        this.hoverEnabled = enabled;
        if (!enabled && this.hovered !== null) {
            this.hovered = null;
            this.needsRender = true;
        }
    }
    invalidate(): void {
        guiTextMeasurer.invalidate();
        this.layoutDirty = true;
        this.needsRender = true;
    }
    get hasFocusedInput(): boolean {
        return this.focused !== null;
    }
    get cursor(): string {
        if (this.sliderDrag)
            return 'grabbing';
        if (this.viewportDrag)
            return 'grabbing';
        const node = this.hovered ? this.findNode(this.hovered) : null;
        if (!node)
            return 'default';
        if (node.kind === 'input')
            return 'text';
        if (node.kind === 'slider')
            return 'grab';
        if (node.kind === 'viewport')
            return node.control?.kind === 'viewport' && node.control.interactive ? 'grab' : 'default';
        if (node.kind === 'video')
            return node.control?.kind === 'video' && node.control.clickToggles ? 'pointer' : 'default';
        return 'pointer';
    }
    get layoutResults(): readonly GuiLayoutResult[] {
        this.ensureLayout();
        return this.layouts;
    }
    tick(deltaSeconds: number): void {
        const before = Math.floor(this.time * 2);
        this.time += deltaSeconds;
        if (this.focused && Math.floor(this.time * 2) !== before)
            this.needsRender = true;
        this.driveVideos();
        if (this.animating)
            this.needsRender = true;
    }
    private videoShouldPlay(node: GuiNode, control: GuiVideoControl): boolean {
        const override = this.values.get(node.id + VIDEO_PLAYING_KEY);
        if (typeof override === 'boolean')
            return override;
        switch (control.playOn) {
            case 'start':
                return true;
            case 'hover':
                return this.hovered === node.id;
            default:
                return false;
        }
    }
    private driveVideos(): void {
        for (const node of this.videoNodes) {
            const control = node.control;
            if (control?.kind !== 'video' || !control.assetId)
                continue;
            const key = guiMediaKey(this.mediaScope, node.id);
            const handle: GuiVideoHandle = guiVideos.acquire(key, control.assetId);
            const playing = this.videoShouldPlay(node, control);
            const wasPlaying = this.lastVideoPlaying.get(key) ?? false;
            if (playing && !wasPlaying && control.restartOnPlay && control.playOn !== 'start')
                handle.restart(control.startTime);
            this.lastVideoPlaying.set(key, playing);
            if (this.mediaGain >= 1)
                handle.sync(control, playing);
            else
                handle.sync({ ...control, volume: control.volume * this.mediaGain, muted: control.muted || this.mediaGain <= 1e-3 }, playing);
        }
    }
    toggleVideo(nodeId: string): boolean | null {
        const node = this.findNode(nodeId);
        if (!node || node.control?.kind !== 'video')
            return null;
        const next = !this.videoShouldPlay(node, node.control);
        this.values.set(nodeId + VIDEO_PLAYING_KEY, next);
        this.needsRender = true;
        this.emit('change', node, next);
        return next;
    }
}
