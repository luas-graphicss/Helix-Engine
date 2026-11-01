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
}
