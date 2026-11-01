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
    private ensureLayout(): void {
        if (!this.layoutDirty)
            return;
        this.layouts = this.documents.map((document) => layoutGuiDocument(document, this.viewport, { measurer: guiTextMeasurer, cssFamily: (family) => guiFonts.cssFamily(family), scrollOffsets: this.scroll, safeArea: this.safeArea }));
        this.layoutDirty = false;
    }
    renderState(): GuiRenderState {
        return { hovered: this.hovered, pressed: this.pressed, focused: this.focused, values: this.values, scroll: this.scroll, time: this.time };
    }
    render(context: CanvasRenderingContext2D, base: GuiMatrix): void {
        this.ensureLayout();
        const state = this.renderState();
        for (const layout of this.layouts) {
            renderGuiLayout(context, layout, {
                base,
                images: guiImages,
                icons: guiIcons,
                fonts: guiFonts,
                state,
                placeholders: false,
                videos: guiVideos,
                mediaScope: this.mediaScope,
                viewports: this.viewports,
                elapsedSeconds: this.time,
            });
        }
        this.needsRender = false;
    }
    private findNode(id: string): GuiNode | null {
        for (const layout of this.layouts) {
            const entry = layout.entries.get(id);
            if (entry)
                return entry.node;
        }
        return null;
    }
    private hit(x: number, y: number, accept: (entry: GuiLayoutEntry) => boolean): Hit | null {
        this.ensureLayout();
        for (let index = this.layouts.length - 1; index >= 0; index--) {
            const layout = this.layouts[index];
            const entry = hitTestGui(layout, x, y, accept);
            if (entry)
                return { layout, entry };
        }
        return null;
    }
    pointerMove(x: number, y: number): boolean {
        if (this.sliderDrag) {
            this.updateSlider(this.sliderDrag, x, y);
            return true;
        }
        if (this.viewportDrag) {
            this.updateViewportDrag(this.viewportDrag, x, y);
            return true;
        }
        const hit = this.hit(x, y, interactive);
        const id = this.hoverEnabled ? (hit?.entry.node.id ?? null) : null;
        if (id !== this.hovered) {
            this.hovered = id;
            this.needsRender = true;
        }
        return hit !== null;
    }
    pointerDown(x: number, y: number): boolean {
        guiVideos.unblockAll();
        const hit = this.hit(x, y, interactive);
        if (this.focused && hit?.entry.node.id !== this.focused)
            this.blur();
        if (!hit)
            return false;
        const { node } = hit.entry;
        this.pressed = node.id;
        this.needsRender = true;
        switch (node.kind) {
            case 'slider':
                this.sliderDrag = hit;
                this.updateSlider(hit, x, y);
                break;
            case 'input':
                if (this.focused !== node.id) {
                    this.focused = node.id;
                    this.emit('focus', node);
                }
                break;
            case 'viewport':
                if (node.control?.kind === 'viewport' && node.control.interactive)
                    this.viewportDrag = { hit, lastX: x, lastY: y };
                break;
            default:
                break;
        }
        return true;
    }
    pointerUp(x: number, y: number): boolean {
        const pressed = this.pressed;
        this.pressed = null;
        this.sliderDrag = null;
        this.viewportDrag = null;
        if (!pressed)
            return false;
        this.needsRender = true;
        const hit = this.hit(x, y, interactive);
        if (hit && hit.entry.node.id === pressed) {
            const { node } = hit.entry;
            if (node.kind === 'toggle' && node.control?.kind === 'toggle') {
                const next = !this.currentValue(node.id, node.control.value);
                this.values.set(node.id, next);
                this.emit('change', node, next);
            }
            if (node.kind === 'button')
                this.emit('activate', node);
            if (node.kind === 'video' && node.control?.kind === 'video') {
                if (node.control.clickToggles)
                    this.toggleVideo(node.id);
                this.emit('activate', node);
            }
        }
        return true;
    }
    pointerLeave(): void {
        if (this.hovered !== null) {
            this.hovered = null;
            this.needsRender = true;
        }
    }
    wheel(x: number, y: number, deltaX: number, deltaY: number): boolean {
        const viewportHit = this.hit(x, y, (entry) => entry.node.kind === 'viewport' && entry.node.interactable && entry.node.control?.kind === 'viewport' && entry.node.control.interactive);
        if (viewportHit) {
            const key = viewportHit.entry.node.id + VIEWPORT_ZOOM_KEY;
            const current = this.numberValue(key);
            this.values.set(key, Math.max(-6, Math.min(6, current + deltaY * ZOOM_PER_WHEEL_UNIT)));
            this.needsRender = true;
            return true;
        }
        const hit = this.hit(x, y, (entry) => entry.node.kind === 'scroll' && entry.canvasSize !== null);
        if (!hit || !hit.entry.canvasSize)
            return false;
        const { entry } = hit;
        const canvasSize = hit.entry.canvasSize;
        const control = entry.node.control?.kind === 'scroll' ? entry.node.control : null;
        const current = this.scroll.get(entry.node.id) ?? { x: 0, y: 0 };
        const maxX = Math.max(0, canvasSize.x - entry.width);
        const maxY = Math.max(0, canvasSize.y - entry.height);
        const next = {
            x: control?.direction === 'vertical' ? 0 : Math.max(0, Math.min(maxX, current.x + deltaX)),
            y: control?.direction === 'horizontal' ? 0 : Math.max(0, Math.min(maxY, current.y + deltaY)),
        };
        if (next.x === current.x && next.y === current.y)
            return maxX > 0 || maxY > 0;
        this.scroll.set(entry.node.id, next);
        this.layoutDirty = true;
        this.needsRender = true;
        return true;
    }
    keyDown(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey'>): boolean {
        const node = this.focused ? this.findNode(this.focused) : null;
        if (!node || node.control?.kind !== 'input')
            return false;
        const control = node.control;
        const current = this.currentValue(node.id, control.value);
        if (event.key === 'Escape') {
            this.blur();
            return true;
        }
        if (event.key === 'Enter') {
            if (control.multiline)
                return this.setInput(node, `${current}\n`);
            this.emit('activate', node, current);
            this.blur();
            return true;
        }
        if (event.key === 'Backspace')
            return this.setInput(node, current.slice(0, -1));
        if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1)
            return false;
        if (control.maxLength !== null && current.length >= control.maxLength)
            return true;
        return this.setInput(node, current + event.key);
    }
    private setInput(node: GuiNode, value: string): boolean {
        this.values.set(node.id, value);
        this.needsRender = true;
        this.emit('change', node, value);
        return true;
    }
    private blur(): void {
        const node = this.focused ? this.findNode(this.focused) : null;
        this.focused = null;
        this.needsRender = true;
        if (node)
            this.emit('blur', node);
    }
    valueOf(nodeId: string): GuiRuntimeValue | undefined {
        return this.values.get(nodeId);
    }
    setValue(nodeId: string, value: GuiRuntimeValue): void {
        this.values.set(nodeId, value);
        this.needsRender = true;
        const node = this.findNode(nodeId);
        if (node)
            this.emit('change', node, value);
    }
    private currentValue<T extends GuiRuntimeValue>(id: string, fallback: T): T {
        const value = this.values.get(id);
        return value !== undefined && typeof value === typeof fallback ? (value as T) : fallback;
    }
    private numberValue(key: string): number {
        const value = this.values.get(key);
        return typeof value === 'number' && Number.isFinite(value) ? value : 0;
    }
    private updateViewportDrag(drag: ViewportDrag, x: number, y: number): void {
        const { node } = drag.hit.entry;
        const deltaX = x - drag.lastX;
        const deltaY = y - drag.lastY;
        drag.lastX = x;
        drag.lastY = y;
        if (deltaX === 0 && deltaY === 0)
            return;
        const scale = ORBIT_DEGREES_PER_PIXEL / Math.max(0.25, drag.hit.layout.offsetScale);
        const yawKey = node.id + VIEWPORT_YAW_KEY;
        const pitchKey = node.id + VIEWPORT_PITCH_KEY;
        const pitchBase = node.control?.kind === 'viewport' ? node.control.pitch : 0;
        this.values.set(yawKey, this.numberValue(yawKey) - deltaX * scale);
        this.values.set(pitchKey, Math.max(-89 - pitchBase, Math.min(89 - pitchBase, this.numberValue(pitchKey) - deltaY * scale)));
        this.needsRender = true;
    }
    private updateSlider(hit: Hit, x: number, y: number): void {
        const { entry } = hit;
        const control = entry.node.control?.kind === 'slider' ? entry.node.control : null;
        if (!control)
            return;
        const local = toLocal(entry, x, y);
        const knob = control.knobSize * hit.layout.offsetScale;
        const fraction = control.direction === 'horizontal'
            ? (local.x - knob / 2) / Math.max(1, entry.width - knob)
            : 1 - (local.y - knob / 2) / Math.max(1, entry.height - knob);
        let value = control.min + Math.max(0, Math.min(1, fraction)) * (control.max - control.min);
        if (control.step > 0)
            value = control.min + Math.round((value - control.min) / control.step) * control.step;
        value = Math.max(control.min, Math.min(control.max, value));
        if (this.currentValue(entry.node.id, control.value) === value)
            return;
        this.values.set(entry.node.id, value);
        this.needsRender = true;
        this.emit('change', entry.node, value);
    }
}
function collect(node: GuiNode, into: Set<string>): void {
    into.add(node.id);
    for (const child of node.children)
        collect(child, into);
}
function walk(node: GuiNode, visit: (node: GuiNode) => void): void {
    visit(node);
    for (const child of node.children)
        walk(child, visit);
}
