import type { GuiFontFamily, GuiTextStyle } from '@/engine/gui/document/gui-document';
export interface GuiBuiltinFont {
    readonly id: GuiFontFamily;
    readonly label: string;
    readonly css: string;
}
export const GUI_BUILTIN_FONTS: readonly GuiBuiltinFont[] = [
    { id: 'builtin:sans', label: 'Sem serifa (sistema)', css: 'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' },
    { id: 'builtin:rounded', label: 'Arredondada', css: '"Nunito", "Varela Round", "Comfortaa", ui-rounded, system-ui, sans-serif' },
    { id: 'builtin:serif', label: 'Com serifa', css: 'Georgia, "Times New Roman", serif' },
    { id: 'builtin:display', label: 'Impacto (títulos)', css: 'Impact, "Arial Black", "Haettenschweiler", sans-serif' },
    { id: 'builtin:mono', label: 'Monoespaçada', css: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace' },
    { id: 'builtin:cursive', label: 'Cursiva', css: '"Brush Script MT", "Segoe Script", cursive' },
];
export const GUI_FONT_WEIGHTS: ReadonlyArray<{
    value: number;
    label: string;
}> = [
    { value: 300, label: 'Leve' },
    { value: 400, label: 'Normal' },
    { value: 500, label: 'Média' },
    { value: 600, label: 'Seminegrito' },
    { value: 700, label: 'Negrito' },
    { value: 800, label: 'Extranegrito' },
    { value: 900, label: 'Preto' },
];
export function fontAssetFamily(assetId: string): GuiFontFamily {
    return `asset:${assetId}`;
}
export function fontAssetIdOf(family: GuiFontFamily): string | null {
    return family.startsWith('asset:') ? family.slice(6) : null;
}
type Listener = () => void;
interface LoadedFont {
    readonly cssFamily: string;
    readonly face: FontFace;
}
export class GuiFontRegistry {
    private readonly loaded = new Map<string, LoadedFont>();
    private readonly pending = new Map<string, Promise<void>>();
    private readonly failed = new Set<string>();
    private readonly listeners = new Set<Listener>();
    loadFile: ((assetId: string) => Promise<File | null>) | null = null;
    subscribe = (listener: Listener): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };
    private notify(): void {
        for (const listener of this.listeners)
            listener();
    }
    cssFamily(family: GuiFontFamily): string {
        const assetId = fontAssetIdOf(family);
        if (assetId === null)
            return GUI_BUILTIN_FONTS.find((font) => font.id === family)?.css ?? GUI_BUILTIN_FONTS[0].css;
        const loaded = this.loaded.get(assetId);
        if (loaded)
            return `"${loaded.cssFamily}", ${GUI_BUILTIN_FONTS[0].css}`;
        void this.ensure(assetId);
        return GUI_BUILTIN_FONTS[0].css;
    }
    isLoaded(assetId: string): boolean {
        return this.loaded.has(assetId);
    }
    hasFailed(assetId: string): boolean {
        return this.failed.has(assetId);
    }
    ensure(assetId: string): Promise<void> {
        if (this.loaded.has(assetId) || this.failed.has(assetId))
            return Promise.resolve();
        let pending = this.pending.get(assetId);
        if (!pending) {
            pending = this.load(assetId).finally(() => this.pending.delete(assetId));
            this.pending.set(assetId, pending);
        }
        return pending;
    }
    async registerFile(assetId: string, file: File): Promise<void> {
        const cssFamily = `hx-font-${assetId}`;
        const face = new FontFace(cssFamily, await file.arrayBuffer());
        await face.load();
        document.fonts.add(face);
        const previous = this.loaded.get(assetId);
        if (previous)
            document.fonts.delete(previous.face);
        this.loaded.set(assetId, { cssFamily, face });
        this.failed.delete(assetId);
        this.notify();
    }
    unregister(assetId: string): void {
        const loaded = this.loaded.get(assetId);
        if (loaded) {
            document.fonts.delete(loaded.face);
            this.loaded.delete(assetId);
        }
        this.failed.delete(assetId);
        this.notify();
    }
    private async load(assetId: string): Promise<void> {
        try {
            const file = await this.loadFile?.(assetId);
            if (!file)
                throw new Error('fonte ausente');
            await this.registerFile(assetId, file);
        }
        catch {
            this.failed.add(assetId);
            this.notify();
        }
    }
}
export function guiFontString(style: GuiTextStyle, cssFamily: string, size = style.size): string {
    return `${style.italic ? 'italic ' : ''}${style.weight} ${Math.max(1, size)}px ${cssFamily}`;
}
export const guiFonts = new GuiFontRegistry();
