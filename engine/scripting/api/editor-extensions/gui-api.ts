import { ASSET_KINDS } from '@/engine/assets/library/asset-kinds';
import type { AssetKind } from '@/engine/assets/library/asset-types';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { GuiFieldOptions, GuiFrame } from '@/engine/editor/extensions/gui/gui-frame';
import type { GuiOption, GuiVector } from '@/engine/editor/extensions/gui/gui-node';
import type { RuntimeHost } from '../../runtime/runtime-host';
import { HelixArgumentError } from '../../runtime/script-errors';
import { describeType, requireEntity, requireFunction, requireNumber, requireOneOf, requireString, toLinearColor, toVec3 } from '../../runtime/values';
import { optionsOf } from './extension-api-context';
const HELP_LEVELS = ['info', 'warn', 'error'] as const;
const BUTTON_VARIANTS = ['primary', 'secondary', 'danger'] as const;
const ASSET_KIND_IDS: readonly AssetKind[] = ASSET_KINDS.map((info) => info.kind);
const DEFAULT_SPACE = 8;
function textOf(value: unknown, member: string, what: string): string {
    if (typeof value === 'string')
        return value;
    throw new HelixArgumentError(member, `${what} precisa ser uma string; recebido ${describeType(value)}.`);
}
function booleanOf(value: unknown, member: string, what: string): boolean {
    if (typeof value === 'boolean')
        return value;
    throw new HelixArgumentError(member, `${what} precisa ser verdadeiro ou falso; recebido ${describeType(value)}.`);
}
function numberOrUndefined(value: unknown, member: string, what: string): number | undefined {
    return value === undefined ? undefined : requireNumber(value, member, what);
}
function fieldOptions(options: Record<string, unknown>, member: string): GuiFieldOptions {
    return { key: options.key === undefined ? undefined : requireString(options.key, member, 'a chave'), disabled: options.disabled === true };
}
function choicesOf(value: unknown, member: string): GuiOption[] {
    if (!Array.isArray(value))
        throw new HelixArgumentError(member, `as opções precisam ser uma lista; recebido ${describeType(value)}.`);
    return value.map((item: unknown, index) => {
        if (typeof item === 'string')
            return { value: item, label: item };
        const option = item as Partial<GuiOption> | null;
        if (!option || typeof option.value !== 'string')
            throw new HelixArgumentError(member, `a opção ${index + 1} precisa ser um texto ou { value, label }.`);
        return { value: option.value, label: typeof option.label === 'string' ? option.label : option.value };
    });
}
function toTuple(vector: ArrayLike<number>): GuiVector {
    return [vector[0], vector[1], vector[2]];
}
function toVector(tuple: GuiVector): Vec3 {
    return vec3.create(tuple[0], tuple[1], tuple[2]);
}
export function createGuiBuilder(host: RuntimeHost, frame: GuiFrame) {
    const { session } = host;
    return {
        get changed(): boolean {
            return frame.changed;
        },
        label: (text: unknown, options?: unknown) => frame.label(textOf(text, 'ui.label', 'o texto'), optionsOf(options, 'ui.label').muted === true ? 'muted' : 'default'),
        heading: (text: unknown) => frame.heading(requireString(text, 'ui.heading', 'o título')),
        help: (text: unknown, level?: unknown) => frame.help(requireString(text, 'ui.help', 'o texto'), level === undefined ? 'info' : requireOneOf(level, HELP_LEVELS, 'ui.help', 'o nível')),
        separator: () => frame.separator(),
        space: (size?: unknown) => frame.space(size === undefined ? DEFAULT_SPACE : requireNumber(size, 'ui.space', 'a altura')),
        progress: (value: unknown, label?: unknown) => frame.progress(label === undefined ? '' : textOf(label, 'ui.progress', 'o rótulo'), requireNumber(value, 'ui.progress', 'o progresso')),
        button: (label: unknown, options?: unknown) => {
            const member = 'ui.button';
            const settings = optionsOf(options, member);
            return frame.button(requireString(label, member, 'o rótulo'), {
                ...fieldOptions(settings, member),
                icon: settings.icon === undefined ? null : requireString(settings.icon, member, 'o ícone'),
                variant: settings.variant === undefined ? 'secondary' : requireOneOf(settings.variant, BUTTON_VARIANTS, member, 'a variante'),
            });
        },
        toggle: (label: unknown, value: unknown, options?: unknown) => {
            const member = 'ui.toggle';
            return frame.toggle(requireString(label, member, 'o rótulo'), booleanOf(value, member, 'o valor'), fieldOptions(optionsOf(options, member), member));
        },
        number: (label: unknown, value: unknown, options?: unknown) => {
            const member = 'ui.number';
            const settings = optionsOf(options, member);
            return frame.number(requireString(label, member, 'o rótulo'), requireNumber(value, member), {
                ...fieldOptions(settings, member),
                min: numberOrUndefined(settings.min, member, 'o mínimo'),
                max: numberOrUndefined(settings.max, member, 'o máximo'),
                step: numberOrUndefined(settings.step, member, 'o passo'),
            });
        },
        slider: (label: unknown, value: unknown, min: unknown, max: unknown, options?: unknown) => {
            const member = 'ui.slider';
            const settings = optionsOf(options, member);
            const low = requireNumber(min, member, 'o mínimo');
            const high = requireNumber(max, member, 'o máximo');
            if (high <= low)
                throw new HelixArgumentError(member, `o máximo (${high}) precisa ser maior que o mínimo (${low}).`);
            return frame.slider(requireString(label, member, 'o rótulo'), requireNumber(value, member), low, high, { ...fieldOptions(settings, member), step: numberOrUndefined(settings.step, member, 'o passo') });
        },
        text: (label: unknown, value: unknown, options?: unknown) => {
            const member = 'ui.text';
            const settings = optionsOf(options, member);
            return frame.text(requireString(label, member, 'o rótulo'), textOf(value, member, 'o valor'), {
                ...fieldOptions(settings, member),
                placeholder: settings.placeholder === undefined ? '' : textOf(settings.placeholder, member, 'o texto de exemplo'),
                multiline: settings.multiline === true,
            });
        },
        select: (label: unknown, value: unknown, choices: unknown, options?: unknown) => {
            const member = 'ui.select';
            return frame.select(requireString(label, member, 'o rótulo'), textOf(value, member, 'o valor'), choicesOf(choices, member), fieldOptions(optionsOf(options, member), member));
        },
        color: (label: unknown, value: unknown, options?: unknown) => {
            const member = 'ui.color';
            return toVector(frame.color(requireString(label, member, 'o rótulo'), toTuple(toLinearColor(value, member)), fieldOptions(optionsOf(options, member), member)));
        },
        vector: (label: unknown, value: unknown, options?: unknown) => {
            const member = 'ui.vector';
            return toVector(frame.vector(requireString(label, member, 'o rótulo'), toTuple(toVec3(value, member)), fieldOptions(optionsOf(options, member), member)));
        },
        actor: (label: unknown, value: unknown, options?: unknown) => {
            const member = 'ui.actor';
            const current = value === null || value === undefined ? null : requireEntity(value, member).id;
            const picked = frame.actor(requireString(label, member, 'o rótulo'), current, fieldOptions(optionsOf(options, member), member));
            return picked === null ? null : session.findById(picked);
        },
        asset: (label: unknown, value: unknown, kind?: unknown, options?: unknown) => {
            const member = 'ui.asset';
            const assetKind = kind === undefined || kind === null ? null : requireOneOf(kind, ASSET_KIND_IDS, member, 'o tipo');
            const current = value === null || value === undefined ? null : host.resolveAsset(value, member, assetKind ?? undefined).id;
            const picked = frame.asset(requireString(label, member, 'o rótulo'), current, assetKind, fieldOptions(optionsOf(options, member), member));
            return picked === null ? null : session.library.get(picked);
        },
        row: (build: unknown) => frame.row(requireFunction<() => void>(build, 'ui.row', 'o conteúdo')),
        section: (title: unknown, build: unknown, options?: unknown) => {
            const member = 'ui.section';
            const { key } = optionsOf(options, member);
            frame.section(requireString(title, member, 'o título'), requireFunction<() => void>(build, member, 'o conteúdo'), key === undefined ? undefined : requireString(key, member, 'a chave'));
        },
    };
}
export type EditorGui = ReturnType<typeof createGuiBuilder>;
