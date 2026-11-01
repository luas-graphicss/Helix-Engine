import { assetUrlTarget, isAssetUrl } from '../compiler/web-compiler';
import type { ScriptOwner, Unsubscribe } from '../runtime/runtime-context';
import { HelixArgumentError, HelixError } from '../runtime/script-errors';
export interface WebAssetResolver {
    url(nameOrId: string): Promise<string | null>;
    text(nameOrId: string): Promise<string | null>;
    warn(message: string): void;
}
export interface MountOptions {
    id?: string;
    replace?: boolean;
    className?: string;
}
export interface WebActionEvent {
    readonly action: string;
    readonly type: string;
    readonly element: Element;
    readonly value: string | number | boolean | null;
}
type ActionHandler = (event: WebActionEvent) => void;
const ROOT_CLASS = 'helix-web-root';
const SCREEN_CLASS = 'helix-web-screen';
const CANVAS_CLASS = 'helix-web-canvas';
const FADE_CLASS = 'helix-web-fade';
const DISALLOWED_SELECTOR = 'script, iframe, object, embed, base, meta[http-equiv]';
const URL_ATTRIBUTES = ['src', 'href', 'poster', 'xlink:href'] as const;
const INTERACTIVE_SELECTOR = 'button, a[href], input, select, textarea, summary, [data-action], [data-interactive], [contenteditable]';
const BASE_STYLE = `
.${ROOT_CLASS} { position: absolute; inset: 0; overflow: hidden; pointer-events: none; font: 14px/1.4 system-ui, sans-serif; color: #fff; }
.${ROOT_CLASS}[data-pointer-events="all"] { pointer-events: auto; }
.${ROOT_CLASS} :is(${INTERACTIVE_SELECTOR}) { pointer-events: auto; }
.${ROOT_CLASS} .${SCREEN_CLASS} { position: absolute; inset: 0; }
.${ROOT_CLASS} .${CANVAS_CLASS} { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.${ROOT_CLASS} .${FADE_CLASS} { position: absolute; inset: 0; pointer-events: none; opacity: 0; transition: opacity linear; }
`;
function valueOf(element: Element): string | number | boolean | null {
    if (element instanceof HTMLInputElement) {
        if (element.type === 'checkbox' || element.type === 'radio')
            return element.checked;
        if (element.type === 'number' || element.type === 'range')
            return element.value === '' ? null : Number(element.value);
        return element.value;
    }
    if (element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)
        return element.value;
    const data = element.getAttribute('data-value');
    return data ?? null;
}
export class WebUiHost {
    readonly root: HTMLElement;
    private container: HTMLElement | null = null;
    private readonly baseStyle: HTMLStyleElement;
    private canvas: HTMLCanvasElement | null = null;
    private context: CanvasRenderingContext2D | null = null;
    private fadeLayer: HTMLDivElement | null = null;
    private fadeTimer: ReturnType<typeof setTimeout> | null = null;
    private resize: ResizeObserver | null = null;
    private readonly screens = new Map<string, HTMLElement>();
    private readonly actionHandlers = new Map<string, Set<ActionHandler>>();
    private nextScreenId = 1;
    private pointerEventsAll = false;
    constructor(private readonly assets: WebAssetResolver) {
        this.root = document.createElement('div');
        this.root.className = ROOT_CLASS;
        this.root.setAttribute('aria-live', 'polite');
        this.baseStyle = document.createElement('style');
        this.baseStyle.textContent = BASE_STYLE;
        this.root.append(this.baseStyle);
        this.root.addEventListener('click', this.onDomEvent);
        this.root.addEventListener('change', this.onDomEvent);
        this.root.addEventListener('input', this.onDomEvent);
        this.root.addEventListener('submit', this.onDomEvent);
        this.root.addEventListener('keydown', this.onKeyDown);
    }
    attach(container: HTMLElement | null): void {
        if (this.container === container)
            return;
        this.resize?.disconnect();
        this.resize = null;
        this.container = container;
        if (!container) {
            this.root.remove();
            return;
        }
        container.append(this.root);
        if (typeof ResizeObserver !== 'undefined') {
            this.resize = new ResizeObserver(() => this.syncCanvasSize());
            this.resize.observe(container);
        }
        this.syncCanvasSize();
    }
    get attached(): boolean {
        return this.container !== null;
    }
    get size(): {
        width: number;
        height: number;
        pixelRatio: number;
    } {
        const rect = this.root.getBoundingClientRect();
        return { width: rect.width, height: rect.height, pixelRatio: window.devicePixelRatio || 1 };
    }
    get pointerEvents(): boolean {
        return this.pointerEventsAll;
    }
    setPointerEvents(all: boolean): void {
        this.pointerEventsAll = all;
        if (all)
            this.root.setAttribute('data-pointer-events', 'all');
        else
            this.root.removeAttribute('data-pointer-events');
    }
    get hasContent(): boolean {
        return this.screens.size > 0 || this.root.querySelector('style:not(:first-child)') !== null || this.canvas !== null;
    }
    mount(markup: string, options: MountOptions, owner: ScriptOwner | null): HTMLElement {
        const id = options.id ?? `tela-${this.nextScreenId++}`;
        if (options.replace !== false)
            this.unmount(id);
        else if (this.screens.has(id))
            throw new HelixArgumentError('helix.gui.html', `já existe uma tela com o id "${id}"; use replace: true ou outro id.`);
        const screen = document.createElement('div');
        screen.className = options.className ? `${SCREEN_CLASS} ${options.className}` : SCREEN_CLASS;
        screen.dataset.helixScreen = id;
        if (options.id !== undefined)
            screen.id = options.id;
        const fragment = this.parseHtml(markup);
        screen.append(fragment);
        this.sanitize(screen);
        void this.resolveAssetUrls(screen);
        this.root.append(screen);
        this.screens.set(id, screen);
        owner?.track(() => this.unmount(id));
        return screen;
    }
    mountSvg(markup: string, options: MountOptions, owner: ScriptOwner | null): SVGSVGElement {
        const parsed = new DOMParser().parseFromString(markup, 'image/svg+xml');
        const error = parsed.querySelector('parsererror');
        if (error)
            throw new HelixError(`helix.gui.svg: SVG mal formado: ${(error.textContent ?? '').replace(/\s+/g, ' ').trim()}`);
        const svg = parsed.documentElement;
        if (!(svg instanceof SVGSVGElement))
            throw new HelixError('helix.gui.svg: o elemento raiz precisa ser <svg>.');
        const adopted = document.importNode(svg, true);
        const screen = this.mount('', options, owner);
        screen.append(adopted);
        this.sanitize(screen);
        void this.resolveAssetUrls(screen);
        return adopted;
    }
    unmount(id: string): boolean {
        const screen = this.screens.get(id);
        if (!screen)
            return false;
        screen.remove();
        this.screens.delete(id);
        return true;
    }
    addStyle(css: string, owner: ScriptOwner | null): HTMLStyleElement {
        const style = document.createElement('style');
        style.textContent = css;
        this.root.append(style);
        void this.resolveStyleUrls(style);
        owner?.track(() => style.remove());
        return style;
    }
    clear(): void {
        for (const id of Array.from(this.screens.keys()))
            this.unmount(id);
        for (const style of Array.from(this.root.querySelectorAll('style')))
            if (style !== this.baseStyle)
                style.remove();
        this.disposeCanvas();
        this.cancelFade();
        this.fadeLayer?.remove();
        this.fadeLayer = null;
        this.setPointerEvents(false);
    }
    query(selectorOrId: string): Element | null {
        const trimmed = selectorOrId.trim();
        if (!trimmed)
            return null;
        try {
            const found = this.root.querySelector(trimmed);
            if (found)
                return found;
        }
        catch {
        }
        if (/^[A-Za-z_][\w-]*$/.test(trimmed))
            return this.root.querySelector(`#${CSS.escape(trimmed)}`);
        return null;
    }
    queryAll(selector: string): Element[] {
        try {
            return Array.from(this.root.querySelectorAll(selector));
        }
        catch {
            throw new HelixArgumentError('helix.gui.elements', `seletor CSS inválido: "${selector}".`);
        }
    }
    bind(name: string, value: unknown): number {
        const targets = this.root.querySelectorAll(`[data-bind="${CSS.escape(name)}"]`);
        const text = value === null || value === undefined ? '' : typeof value === 'number' && !Number.isInteger(value) ? String(Number(value.toFixed(3))) : String(value);
        for (const element of Array.from(targets)) {
            if (element instanceof HTMLInputElement) {
                if (element.type === 'checkbox' || element.type === 'radio')
                    element.checked = Boolean(value);
                else
                    element.value = text;
            }
            else if (element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
                element.value = text;
            }
            else if (element instanceof HTMLProgressElement || element instanceof HTMLMeterElement) {
                element.value = Number(value) || 0;
            }
            else if (element instanceof HTMLImageElement && typeof value === 'string') {
                if (isAssetUrl(value))
                    void this.assets.url(assetUrlTarget(value)).then((url) => url && (element.src = url));
                else
                    element.src = value;
            }
            else {
                element.textContent = text;
            }
        }
        return targets.length;
    }
    onAction(action: string, handler: ActionHandler, owner: ScriptOwner | null): Unsubscribe {
        let handlers = this.actionHandlers.get(action);
        if (!handlers)
            this.actionHandlers.set(action, (handlers = new Set()));
        handlers.add(handler);
        const unsubscribe = () => {
            handlers.delete(handler);
            if (handlers.size === 0)
                this.actionHandlers.delete(action);
        };
        owner?.track(unsubscribe);
        return unsubscribe;
    }
    dispatchAction: ((handler: ActionHandler, event: WebActionEvent) => void) | null = null;
    private readonly onDomEvent = (event: Event): void => {
        const target = event.target;
        if (!(target instanceof Element))
            return;
        const element = target.closest('[data-action]');
        if (!element || !this.root.contains(element))
            return;
        const action = element.getAttribute('data-action');
        if (!action)
            return;
        if (event.type === 'click' && (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement))
            return;
        if (event.type === 'submit')
            event.preventDefault();
        if (event.type === 'click' && element instanceof HTMLAnchorElement && element.getAttribute('href') === '#')
            event.preventDefault();
        if (event.type === 'input' && element.getAttribute('data-action-on') !== 'input')
            return;
        if (event.type === 'change' && element.getAttribute('data-action-on') === 'input')
            return;
        const handlers = this.actionHandlers.get(action) ?? this.actionHandlers.get('*');
        if (!handlers || handlers.size === 0)
            return;
        const payload: WebActionEvent = { action, type: event.type, element, value: valueOf(element) };
        for (const handler of Array.from(handlers)) {
            if (this.dispatchAction)
                this.dispatchAction(handler, payload);
            else
                handler(payload);
        }
    };
}
