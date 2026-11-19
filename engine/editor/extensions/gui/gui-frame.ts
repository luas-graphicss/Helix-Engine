import type { AssetKind } from '@/engine/assets/library/asset-types';
import type { GuiButtonVariant, GuiHelpLevel, GuiNode, GuiOption, GuiTone, GuiVector } from './gui-node';
export interface GuiFieldOptions {
    readonly key?: string;
    readonly disabled?: boolean;
}
export interface GuiButtonOptions extends GuiFieldOptions {
    readonly icon?: string | null;
    readonly variant?: GuiButtonVariant;
}
export interface GuiNumberOptions extends GuiFieldOptions {
    readonly min?: number;
    readonly max?: number;
    readonly step?: number;
}
export interface GuiSliderOptions extends GuiFieldOptions {
    readonly step?: number;
}
export interface GuiTextOptions extends GuiFieldOptions {
    readonly placeholder?: string;
    readonly multiline?: boolean;
}
interface Scope {
    readonly key: string;
    readonly children: GuiNode[];
    readonly counts: Map<string, number>;
}
function isBoolean(value: unknown): value is boolean {
    return typeof value === 'boolean';
}
function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}
function isString(value: unknown): value is string {
    return typeof value === 'string';
}
function isVector(value: unknown): value is GuiVector {
    return Array.isArray(value) && value.length === 3 && value.every(isFiniteNumber);
}
function isActorId(value: unknown): value is number | null {
    return value === null || (typeof value === 'number' && Number.isInteger(value));
}
function isAssetId(value: unknown): value is string | null {
    return value === null || typeof value === 'string';
}
function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}
function snap(value: number, step: number | undefined, origin: number): number {
    return step !== undefined && step > 0 ? origin + Math.round((value - origin) / step) * step : value;
}
export class GuiFrame {
    readonly nodes: GuiNode[] = [];
    consumedEvent = false;
    changed = false;
    private readonly scopes: Scope[] = [{ key: '', children: this.nodes, counts: new Map() }];
    constructor(private readonly pending: Map<string, unknown>) { }
    label(text: string, tone: GuiTone = 'default'): void {
        this.push({ kind: 'label', key: this.keyFor('label', text), text, tone });
    }
    heading(text: string): void {
        this.push({ kind: 'heading', key: this.keyFor('heading', text), text });
    }
    help(text: string, level: GuiHelpLevel): void {
        this.push({ kind: 'help', key: this.keyFor('help', text), text, level });
    }
    separator(): void {
        this.push({ kind: 'separator', key: this.keyFor('separator', '') });
    }
    space(size: number): void {
        this.push({ kind: 'space', key: this.keyFor('space', ''), size: clamp(size, 0, 256) });
    }
    progress(label: string, value: number): void {
        this.push({ kind: 'progress', key: this.keyFor('progress', label), label, value: clamp(value, 0, 1) });
    }
    button(label: string, options: GuiButtonOptions = {}): boolean {
        const key = this.keyFor('button', label, options.key);
        const disabled = options.disabled === true;
        const clicked = this.take(key, isBoolean) === true && !disabled;
        this.push({ kind: 'button', key, label, disabled, icon: options.icon ?? null, variant: options.variant ?? 'secondary' });
        return clicked;
    }
    toggle(label: string, value: boolean, options: GuiFieldOptions = {}): boolean {
        const key = this.keyFor('toggle', label, options.key);
        const next = this.resolve(key, value, isBoolean);
        this.push({ kind: 'toggle', key, label, disabled: options.disabled === true, value: next });
        return next;
    }
    number(label: string, value: number, options: GuiNumberOptions = {}): number {
        const key = this.keyFor('number', label, options.key);
        const min = options.min ?? -Infinity;
        const max = options.max ?? Infinity;
        const taken = this.take(key, isFiniteNumber);
        const next = taken === undefined ? value : clamp(snap(taken, options.step, Number.isFinite(min) ? min : 0), min, max);
        this.noteChange(next !== value);
        this.push({ kind: 'number', key, label, disabled: options.disabled === true, value: next });
        return next;
    }
    slider(label: string, value: number, min: number, max: number, options: GuiSliderOptions = {}): number {
        const key = this.keyFor('slider', label, options.key);
        const taken = this.take(key, isFiniteNumber);
        const next = taken === undefined ? value : clamp(snap(taken, options.step, min), min, max);
        this.noteChange(next !== value);
        this.push({ kind: 'slider', key, label, disabled: options.disabled === true, value: next, min, max, step: options.step ?? null });
        return next;
    }
    text(label: string, value: string, options: GuiTextOptions = {}): string {
        const key = this.keyFor('text', label, options.key);
        const next = this.resolve(key, value, isString);
        this.push({ kind: 'text', key, label, disabled: options.disabled === true, value: next, placeholder: options.placeholder ?? '', multiline: options.multiline === true });
        return next;
    }
    select(label: string, value: string, choices: readonly GuiOption[], options: GuiFieldOptions = {}): string {
        const key = this.keyFor('select', label, options.key);
        const taken = this.take(key, isString);
        const next = taken !== undefined && choices.some((choice) => choice.value === taken) ? taken : value;
        this.noteChange(next !== value);
        this.push({ kind: 'select', key, label, disabled: options.disabled === true, value: next, options: choices });
        return next;
    }
    color(label: string, value: GuiVector, options: GuiFieldOptions = {}): GuiVector {
        const key = this.keyFor('color', label, options.key);
        const next = this.resolve(key, value, isVector);
        this.push({ kind: 'color', key, label, disabled: options.disabled === true, value: next });
        return next;
    }
    vector(label: string, value: GuiVector, options: GuiFieldOptions = {}): GuiVector {
        const key = this.keyFor('vector', label, options.key);
        const next = this.resolve(key, value, isVector);
        this.push({ kind: 'vector', key, label, disabled: options.disabled === true, value: next });
        return next;
    }
    actor(label: string, value: number | null, options: GuiFieldOptions = {}): number | null {
        const key = this.keyFor('actor', label, options.key);
        const next = this.resolve(key, value, isActorId);
        this.push({ kind: 'actor', key, label, disabled: options.disabled === true, value: next });
        return next;
    }
    asset(label: string, value: string | null, assetKind: AssetKind | null, options: GuiFieldOptions = {}): string | null {
        const key = this.keyFor('asset', label, options.key);
        const next = this.resolve(key, value, isAssetId);
        this.push({ kind: 'asset', key, label, disabled: options.disabled === true, value: next, assetKind });
        return next;
    }
    row(build: () => void): void {
        const key = this.keyFor('row', '');
        this.push({ kind: 'row', key, children: this.nested(key, build) });
    }
    section(title: string, build: () => void, explicitKey?: string): void {
        const key = this.keyFor('section', title, explicitKey);
        this.push({ kind: 'section', key, title, children: this.nested(key, build) });
    }
    private nested(key: string, build: () => void): GuiNode[] {
        const children: GuiNode[] = [];
        this.scopes.push({ key, children, counts: new Map() });
        try {
            build();
        }
        finally {
            this.scopes.pop();
        }
        return children;
    }
    private push(node: GuiNode): void {
        this.scopes[this.scopes.length - 1].children.push(node);
    }
    private keyFor(kind: string, label: string, explicit?: string): string {
        const scope = this.scopes[this.scopes.length - 1];
        const base = explicit === undefined ? `${kind}:${label}` : `key:${explicit}`;
        const repeats = scope.counts.get(base) ?? 0;
        scope.counts.set(base, repeats + 1);
        return `${scope.key}/${base}${repeats === 0 ? '' : `#${repeats}`}`;
    }
    private take<TValue>(key: string, accepts: (value: unknown) => value is TValue): TValue | undefined {
        if (!this.pending.has(key))
            return undefined;
        const value = this.pending.get(key);
        this.pending.delete(key);
        this.consumedEvent = true;
        return accepts(value) ? value : undefined;
    }
    private resolve<TValue>(key: string, value: TValue, accepts: (value: unknown) => value is TValue): TValue {
        const taken = this.take(key, accepts);
        if (taken === undefined)
            return value;
        this.noteChange(true);
        return taken;
    }
    private noteChange(changed: boolean): void {
        this.changed ||= changed;
    }
}
