import { emulatedDeviceBounds, resolveEmulatedScreen, zoomForDevicePixels, zoomForPhysicalSize, type GuiEmulatedScreen } from '@/engine/gui/devices/device-geometry';
import { clampCustomDevice, customDeviceSpec, oppositeOrientation, orientationOf, type GuiCustomDevice, type GuiDeviceOrientation, type GuiDeviceSpec } from '@/engine/gui/devices/device-model';
import { GUI_DEFAULT_REFERENCE_SIZE, GUI_ROOT_ID, type GuiDocument, type GuiElementKind, type GuiNode, type GuiPoint } from '@/engine/gui/document/gui-document';
import { findGuiNode, findGuiParent, flattenGui, updateGuiNodes } from '@/engine/gui/document/gui-tree';
import { guiFonts } from '@/engine/gui/fonts/gui-font-registry';
import { guiIcons } from '@/engine/gui/icons/gui-icon-catalog';
import { guiImages } from '@/engine/gui/images/gui-image-cache';
import { guiVideos } from '@/engine/gui/media/gui-video-cache';
import { layoutGuiDocument, type GuiLayoutResult } from '@/engine/gui/layout/gui-layout';
import type { GuiViewportProvider } from '@/engine/gui/media/gui-viewport-provider';
import { GuiRuntime } from '@/engine/gui/runtime/gui-runtime';
import { guiTextMeasurer } from '@/engine/gui/text/gui-text-measure';
import { SetGuiDocumentCommand, type GuiDocumentHost } from '@/engine/editor/commands/gui-commands';
import type { EditorSession } from '@/engine/editor/session/editor-session';
export const GUI_DESIGNER_MEDIA_SCOPE = 'designer';
export type GuiTool = 'select' | 'hand' | GuiElementKind;
export type GuiDesignerMode = 'design' | 'preview';
export interface GuiDesignerOptions {
    readonly grid: boolean;
    readonly gridSize: number;
    readonly snapGrid: boolean;
    readonly snapGuides: boolean;
    readonly rulers: boolean;
    readonly outlines: boolean;
    readonly safeArea: boolean;
    readonly checkerboard: boolean;
    readonly deviceFrame: boolean;
    readonly devicePixels: boolean;
}
export interface GuiViewState {
    readonly zoom: number;
    readonly panX: number;
    readonly panY: number;
}
export const GUI_ZOOM_LEVELS: readonly number[] = [0.1, 0.125, 0.25, 0.333, 0.5, 0.667, 0.75, 1, 1.5, 2, 3, 4];
export const GUI_MIN_ZOOM = 0.05;
export const GUI_MAX_ZOOM = 8;
type Listener = () => void;
interface LayoutCache {
    readonly document: GuiDocument;
    readonly screen: GuiEmulatedScreen;
    readonly fontsVersion: number;
    readonly result: GuiLayoutResult;
}
export class GuiDesigner implements GuiDocumentHost {
    document: GuiDocument | null = null;
    assetId: string | null = null;
    readonly selectedIds = new Set<string>();
    primaryId: string | null = null;
    hoveredId: string | null = null;
    tool: GuiTool = 'select';
    mode: GuiDesignerMode = 'design';
    editingTextId: string | null = null;
    device: GuiPoint = GUI_DEFAULT_REFERENCE_SIZE;
    deviceSpec: GuiDeviceSpec | null = null;
    deviceOrientation: GuiDeviceOrientation = 'landscape';
    customDevice: GuiCustomDevice = { width: 1280, height: 720, dpr: 1 };
    view: GuiViewState = { zoom: 1, panX: 0, panY: 0 };
    options: GuiDesignerOptions = { grid: false, gridSize: 8, snapGrid: false, snapGuides: true, rulers: true, outlines: false, safeArea: false, checkerboard: true, deviceFrame: true, devicePixels: true };
    clipboard: readonly GuiNode[] = [];
    readonly runtime = new GuiRuntime();
    pendingFit = true;
    workspaceSize: GuiPoint = { x: 0, y: 0 };
    private savedDocument: GuiDocument | null = null;
    private sessionKey = 0;
    private version = 0;
    private readonly listeners = new Set<Listener>();
    private layoutCache: LayoutCache | null = null;
    private fontsVersion = 0;
    private runtimeDocument: GuiDocument | null = null;
    private screenCache: GuiEmulatedScreen;
    constructor(private readonly session: EditorSession) {
        this.screenCache = resolveEmulatedScreen(null, this.deviceOrientation, this.device);
        guiFonts.loadFile = async (assetId) => {
            const asset = session.library.get(assetId);
            return asset && asset.kind === 'font' ? session.library.primaryFile(asset) : null;
        };
        guiImages.loadFile = async (assetId) => {
            const asset = session.library.get(assetId);
            return asset && asset.kind === 'texture' ? session.library.primaryFile(asset) : null;
        };
        guiVideos.loadFile = async (assetId) => {
            const asset = session.library.get(assetId);
            return asset && asset.kind === 'video' ? session.library.primaryFile(asset) : null;
        };
        guiFonts.subscribe(() => {
            this.fontsVersion++;
            guiTextMeasurer.invalidate();
            this.runtime.invalidate();
            this.notify();
        });
        guiImages.subscribe(() => this.notify());
        guiVideos.subscribe(() => this.notify());
        if (typeof window !== 'undefined')
            void guiIcons.load().then(() => this.notify());
    }
    readonly subscribe = (listener: Listener): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };
    readonly getVersion = (): number => this.version;
    notify(): void {
        this.version++;
        for (const listener of this.listeners)
            listener();
    }
    get isOpen(): boolean {
        return this.document !== null;
    }
    get viewports(): GuiViewportProvider {
        return this.session.guiWorld.views;
    }
    get dirty(): boolean {
        return this.document !== null && this.document !== this.savedDocument;
    }
    get primaryNode(): GuiNode | null {
        return this.document && this.primaryId ? findGuiNode(this.document.root, this.primaryId) : null;
    }
    get selectedNodes(): GuiNode[] {
        if (!this.document)
            return [];
        const nodes: GuiNode[] = [];
        for (const id of this.selectedIds) {
            const node = findGuiNode(this.document.root, id);
            if (node)
                nodes.push(node);
        }
        return nodes;
    }
    open(document: GuiDocument, assetId: string | null): void {
        this.sessionKey++;
        this.document = document;
        this.assetId = assetId;
        this.savedDocument = assetId ? document : null;
        this.selectedIds.clear();
        this.primaryId = null;
        this.hoveredId = null;
        this.editingTextId = null;
        if (!this.deviceSpec)
            this.deviceOrientation = orientationOf(document.referenceSize.x, document.referenceSize.y);
        this.refreshScreen();
        this.mode = 'design';
        this.tool = 'select';
        this.layoutCache = null;
        this.pendingFit = true;
        this.runtime.reset();
        this.runtimeDocument = null;
        this.notify();
    }
    close(): void {
        if (!this.document)
            return;
        this.sessionKey++;
        this.document = null;
        this.assetId = null;
        this.savedDocument = null;
        this.selectedIds.clear();
        this.primaryId = null;
        this.hoveredId = null;
        this.editingTextId = null;
        this.mode = 'design';
        this.layoutCache = null;
        this.runtime.reset();
        this.notify();
    }
    markSaved(assetId: string): void {
        this.assetId = assetId;
        this.savedDocument = this.document;
        this.notify();
    }
    syncName(name: string): void {
        if (!this.document || this.document.name === name)
            return;
        this.document = { ...this.document, name };
        this.savedDocument = this.savedDocument ? { ...this.savedDocument, name } : null;
        this.notify();
    }
    restoreDocument(document: GuiDocument, sessionKey: number): void {
        if (sessionKey !== this.sessionKey || !this.document)
            return;
        this.document = document;
        this.refreshScreen();
        this.pruneSelection();
        this.notify();
    }
    apply(label: string, update: (document: GuiDocument) => GuiDocument, mergeKey?: string): boolean {
        if (!this.document)
            return false;
        const after = update(this.document);
        if (after === this.document)
            return false;
        this.session.history.execute(new SetGuiDocumentCommand(this, label, this.document, after, this.sessionKey, mergeKey));
        return true;
    }
    updateRoot(label: string, update: (root: GuiNode) => GuiNode, mergeKey?: string): boolean {
        return this.apply(label, (document) => {
            const root = update(document.root);
            return root === document.root ? document : { ...document, root };
        }, mergeKey);
    }
    updateNodes(label: string, ids: Iterable<string>, update: (node: GuiNode) => GuiNode, mergeKey?: string): boolean {
        return this.updateRoot(label, (root) => updateGuiNodes(root, ids, update), mergeKey);
    }
    updateSelected(label: string, update: (node: GuiNode) => GuiNode, mergeKey?: string): boolean {
        return this.updateNodes(label, [...this.selectedIds], update, mergeKey);
    }
    endMerge(): void {
        this.session.history.endMerge();
    }
    isSelected(id: string): boolean {
        return this.selectedIds.has(id);
    }
    select(ids: Iterable<string>, options: {
        additive?: boolean;
        toggle?: boolean;
        primary?: string | null;
    } = {}): void {
        const list = [...ids].filter((id) => id !== GUI_ROOT_ID);
        if (options.toggle) {
            for (const id of list) {
                if (this.selectedIds.has(id))
                    this.selectedIds.delete(id);
                else
                    this.selectedIds.add(id);
            }
        }
        else {
            if (!options.additive)
                this.selectedIds.clear();
            for (const id of list)
                this.selectedIds.add(id);
        }
        const preferred = options.primary !== undefined ? options.primary : (list.at(-1) ?? null);
        this.primaryId = preferred && this.selectedIds.has(preferred) ? preferred : ([...this.selectedIds].at(-1) ?? null);
        if (this.editingTextId && !this.selectedIds.has(this.editingTextId))
            this.editingTextId = null;
        this.notify();
    }
    selectOne(id: string | null): void {
        this.select(id ? [id] : []);
    }
    clearSelection(): void {
        if (this.selectedIds.size === 0 && !this.primaryId)
            return;
        this.select([]);
    }
    selectAll(): void {
        if (!this.document)
            return;
        const parent = (this.primaryId && findGuiParent(this.document.root, this.primaryId)) || this.document.root;
        this.select(parent.children.filter((child) => !child.locked && child.visible).map((child) => child.id));
    }
    setHovered(id: string | null): void {
        if (this.hoveredId === id)
            return;
        this.hoveredId = id;
        this.notify();
    }
    private pruneSelection(): void {
        if (!this.document)
            return;
        let changed = false;
        for (const id of [...this.selectedIds]) {
            if (!findGuiNode(this.document.root, id)) {
                this.selectedIds.delete(id);
                changed = true;
            }
        }
        if (this.primaryId && !this.selectedIds.has(this.primaryId)) {
            this.primaryId = [...this.selectedIds].at(-1) ?? null;
            changed = true;
        }
        if (this.editingTextId && !findGuiNode(this.document.root, this.editingTextId))
            this.editingTextId = null;
        if (this.hoveredId && !findGuiNode(this.document.root, this.hoveredId))
            this.hoveredId = null;
        if (changed)
            this.notify();
    }
    setTool(tool: GuiTool): void {
        if (this.tool === tool)
            return;
        this.tool = tool;
        if (tool !== 'select')
            this.editingTextId = null;
        this.notify();
    }
    setMode(mode: GuiDesignerMode): void {
        if (this.mode === mode)
            return;
        this.mode = mode;
        this.editingTextId = null;
        this.runtime.reset();
        this.runtimeDocument = null;
        if (mode === 'preview')
            this.syncRuntime();
        else
            this.runtime.setViewportProvider(null);
        this.notify();
    }
    togglePreview(): void {
        this.setMode(this.mode === 'preview' ? 'design' : 'preview');
    }
    setOption<K extends keyof GuiDesignerOptions>(key: K, value: GuiDesignerOptions[K]): void {
        if (this.options[key] === value)
            return;
        this.options = { ...this.options, [key]: value };
        this.notify();
    }
    toggleOption(key: Exclude<keyof GuiDesignerOptions, 'gridSize'>): void {
        this.setOption(key, !this.options[key]);
    }
    get screen(): GuiEmulatedScreen {
        return this.screenCache;
    }
    get followsReference(): boolean {
        return this.deviceSpec === null;
    }
    emulateDevice(spec: GuiDeviceSpec | null): void {
        this.deviceSpec = spec;
        const natural = spec ? (spec.category === 'custom' ? spec.naturalOrientation : null) : this.document ? orientationOf(this.document.referenceSize.x, this.document.referenceSize.y) : null;
        if (natural)
            this.deviceOrientation = natural;
        this.refreshScreen();
        this.notify();
    }
    emulateCustomDevice(custom: GuiCustomDevice): void {
        this.customDevice = clampCustomDevice(custom);
        this.emulateDevice(customDeviceSpec(this.customDevice));
    }
    resetDevice(): void {
        this.emulateDevice(null);
    }
    setDeviceOrientation(orientation: GuiDeviceOrientation): void {
        if (this.deviceOrientation === orientation)
            return;
        this.deviceOrientation = orientation;
        this.refreshScreen();
        this.notify();
    }
    rotateDevice(): void {
        this.setDeviceOrientation(oppositeOrientation(this.deviceOrientation));
    }
    private refreshScreen(): void {
        const reference = this.document?.referenceSize ?? GUI_DEFAULT_REFERENCE_SIZE;
        const before = emulatedDeviceBounds(this.screenCache, this.options.deviceFrame);
        const screen = resolveEmulatedScreen(this.deviceSpec, this.deviceOrientation, reference);
        this.screenCache = screen;
        this.layoutCache = null;
        this.runtime.setSafeArea(screen.safeArea);
        if (this.device.x !== screen.width || this.device.y !== screen.height) {
            this.device = { x: screen.width, y: screen.height };
            this.runtime.setViewport(this.device);
        }
        const after = emulatedDeviceBounds(screen, this.options.deviceFrame);
        if (before.x !== after.x || before.y !== after.y || before.width !== after.width || before.height !== after.height)
            this.pendingFit = true;
    }
    beginTextEdit(id: string): void {
        if (!this.document)
            return;
        const node = findGuiNode(this.document.root, id);
        if (!node || !node.text || node.locked)
            return;
        this.editingTextId = id;
        this.select([id]);
    }
    endTextEdit(): void {
        if (!this.editingTextId)
            return;
        this.editingTextId = null;
        this.notify();
    }
    setClipboard(nodes: readonly GuiNode[]): void {
        this.clipboard = nodes;
        this.notify();
    }
    setView(view: GuiViewState): void {
        this.view = view;
        this.pendingFit = false;
        this.notify();
    }
    zoomTo(zoom: number, pivot: GuiPoint): void {
        const next = Math.min(GUI_MAX_ZOOM, Math.max(GUI_MIN_ZOOM, zoom));
        const { zoom: current, panX, panY } = this.view;
        if (next === current)
            return;
        const docX = (pivot.x - panX) / current;
        const docY = (pivot.y - panY) / current;
        this.setView({ zoom: next, panX: pivot.x - docX * next, panY: pivot.y - docY * next });
    }
    zoomStep(direction: 1 | -1, pivot: GuiPoint): void {
        const current = this.view.zoom;
        const next = direction > 0 ? GUI_ZOOM_LEVELS.find((level) => level > current + 1e-6) : [...GUI_ZOOM_LEVELS].reverse().find((level) => level < current - 1e-6);
        this.zoomTo(next ?? (direction > 0 ? GUI_MAX_ZOOM : GUI_MIN_ZOOM), pivot);
    }
    panBy(dx: number, dy: number): void {
        this.setView({ ...this.view, panX: this.view.panX + dx, panY: this.view.panY + dy });
    }
    fitToView(width: number, height: number, padding = 48): void {
        if (width <= 0 || height <= 0)
            return;
        const bounds = emulatedDeviceBounds(this.screenCache, this.options.deviceFrame);
        const zoom = Math.min(GUI_MAX_ZOOM, Math.max(GUI_MIN_ZOOM, Math.min((width - padding * 2) / bounds.width, (height - padding * 2) / bounds.height)));
        this.setView({ zoom, panX: (width - bounds.width * zoom) / 2 - bounds.x * zoom, panY: (height - bounds.height * zoom) / 2 - bounds.y * zoom });
    }
    fitSelection(width: number, height: number): void {
        const layout = this.layout();
        if (!layout || this.selectedIds.size === 0)
            return this.fitToView(width, height);
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const id of this.selectedIds) {
            const entry = layout.entries.get(id);
            if (!entry)
                continue;
            const [a, b, c, d, e, f] = entry.world;
            for (const [px, py] of [
                [0, 0],
                [entry.width, 0],
                [0, entry.height],
                [entry.width, entry.height],
            ]) {
                const x = a * px + c * py + e;
                const y = b * px + d * py + f;
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            }
        }
        if (!Number.isFinite(minX))
            return;
        const boxW = Math.max(1, maxX - minX);
        const boxH = Math.max(1, maxY - minY);
        const zoom = Math.min(GUI_MAX_ZOOM, Math.max(GUI_MIN_ZOOM, Math.min((width - 96) / boxW, (height - 96) / boxH, 4)));
        this.setView({ zoom, panX: width / 2 - (minX + boxW / 2) * zoom, panY: height / 2 - (minY + boxH / 2) * zoom });
    }
    setWorkspaceSize(width: number, height: number): void {
        this.workspaceSize = { x: width, y: height };
    }
    fitAll(): void {
        this.fitToView(this.workspaceSize.x, this.workspaceSize.y);
    }
    fitSelectionInView(): void {
        this.fitSelection(this.workspaceSize.x, this.workspaceSize.y);
    }
    private get workspaceCenter(): GuiPoint {
        return { x: this.workspaceSize.x / 2, y: this.workspaceSize.y / 2 };
    }
    zoomAtCenter(zoom: number): void {
        this.zoomTo(zoom, this.workspaceCenter);
    }
    get devicePixelZoom(): number {
        return zoomForDevicePixels(this.screenCache, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);
    }
    get physicalSizeZoom(): number | null {
        return zoomForPhysicalSize(this.screenCache);
    }
    zoomToDevicePixels(): void {
        this.zoomAtCenter(this.devicePixelZoom);
    }
    zoomToPhysicalSize(): void {
        const zoom = this.physicalSizeZoom;
        if (zoom !== null)
            this.zoomAtCenter(zoom);
    }
    zoomStepAtCenter(direction: 1 | -1): void {
        this.zoomStep(direction, this.workspaceCenter);
    }
    toDocument(x: number, y: number): GuiPoint {
        return { x: (x - this.view.panX) / this.view.zoom, y: (y - this.view.panY) / this.view.zoom };
    }
    toScreen(x: number, y: number): GuiPoint {
        return { x: x * this.view.zoom + this.view.panX, y: y * this.view.zoom + this.view.panY };
    }
    layout(): GuiLayoutResult | null {
        if (!this.document)
            return null;
        const cache = this.layoutCache;
        if (cache && cache.document === this.document && cache.screen === this.screenCache && cache.fontsVersion === this.fontsVersion)
            return cache.result;
        const result = layoutGuiDocument(this.document, this.device, { measurer: guiTextMeasurer, cssFamily: (family) => guiFonts.cssFamily(family), safeArea: this.screenCache.safeArea });
        this.layoutCache = { document: this.document, screen: this.screenCache, fontsVersion: this.fontsVersion, result };
        return result;
    }
    flat() {
        return this.document ? flattenGui(this.document.root) : [];
    }
    syncRuntime(): void {
        this.runtime.setMediaScope(GUI_DESIGNER_MEDIA_SCOPE);
        this.runtime.setViewportProvider(this.viewports);
        this.runtime.setHoverEnabled(this.screenCache.spec?.input !== 'touch');
        if (!this.document || this.runtimeDocument === this.document)
            return;
        this.runtimeDocument = this.document;
        this.runtime.setDocuments([this.document]);
        this.runtime.setViewport(this.device);
    }
    tick(deltaSeconds: number): void {
        if (this.mode !== 'preview' || !this.document)
            return;
        this.syncRuntime();
        this.runtime.tick(deltaSeconds);
    }
}
