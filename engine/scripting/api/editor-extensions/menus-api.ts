import type { LibraryAsset } from '@/engine/assets/library/asset-types';
import type { Entity } from '@/engine/core/scene/entity';
import { selectionMenuTarget } from '@/engine/editor/extensions/menus/menu-commands';
import { MENU_LOCATIONS, menuContributionId, type MenuContribution, type MenuLocation, type MenuTarget } from '@/engine/editor/extensions/menus/menu-contribution';
import { parseMenuPath } from '@/engine/editor/extensions/menus/menu-path';
import { normalizeShortcut } from '@/engine/editor/extensions/menus/menu-shortcut';
import { HelixArgumentError, HelixError } from '../../runtime/script-errors';
import { optionalNumber, requireFunction, requireObject, requireOneOf, requireString } from '../../runtime/values';
import { guardedPredicate, type ExtensionApiContext } from './extension-api-context';
interface ScriptMenuTarget {
    readonly actors: Entity[];
    readonly actor: Entity | null;
    readonly asset: LibraryAsset | null;
}
type MenuCallback = (target: ScriptMenuTarget) => unknown;
function toScriptTarget(target: MenuTarget): ScriptMenuTarget {
    return { actors: target.actors.slice(), actor: target.actors[0] ?? null, asset: target.asset };
}
function locationOf(value: unknown, member: string): MenuLocation {
    return value === undefined ? 'main' : requireOneOf(value, MENU_LOCATIONS, member, 'o local');
}
function pathOf(value: unknown, location: MenuLocation, member: string): string[] {
    const path = parseMenuPath(requireString(value, member, 'o caminho'));
    if (!path)
        throw new HelixArgumentError(member, 'o caminho precisa ter de 1 a 5 nomes separados por barra, cada um com até 48 caracteres.');
    if (location === 'main' && path.length < 2)
        throw new HelixArgumentError(member, 'no menu principal o caminho começa pelo nome do menu, como "Ferramentas/Apoiar no chão".');
    return path;
}
function shortcutOf(value: unknown, member: string): string | null {
    if (value === undefined)
        return null;
    const shortcut = normalizeShortcut(requireString(value, member, 'o atalho'));
    if (shortcut === null)
        throw new HelixArgumentError(member, `o atalho "${String(value)}" não foi entendido. Use o formato "Ctrl+Shift+G".`);
    return shortcut;
}
function optionalCallback(value: unknown, member: string, what: string): MenuCallback | null {
    return value === undefined ? null : requireFunction<MenuCallback>(value, member, what);
}
export function createMenusApi(context: ExtensionApiContext) {
    const { host, extensions } = context;
    const { menus } = extensions;
    const find = (path: unknown, location: unknown, member: string): MenuContribution => {
        const place = locationOf(location, member);
        const segments = pathOf(path, place, member);
        const menu = menus.get(menuContributionId(place, segments));
        if (!menu)
            throw new HelixError(`${member}: o item "${segments.join('/')}" não está registrado.`);
        return menu;
    };
    return {
        register: (path: unknown, options: unknown) => {
            const member = 'helix.editor.menus.register';
            const settings = requireObject(options, member);
            const location = locationOf(settings.location, member);
            const segments = pathOf(path, location, member);
            const label = segments.join('/');
            const run = requireFunction<MenuCallback>(settings.run, member, 'run');
            const enabled = optionalCallback(settings.enabled, member, 'enabled');
            const checked = optionalCallback(settings.checked, member, 'checked');
            const owner = host.current;
            const menu: MenuContribution = {
                id: menuContributionId(location, segments),
                location,
                path: segments,
                icon: settings.icon === undefined ? null : requireString(settings.icon, member, 'o ícone'),
                order: optionalNumber(settings.order, 0, member, 'a ordem'),
                shortcut: shortcutOf(settings.shortcut, member),
                separatorBefore: settings.separator === true,
                checkable: checked !== null,
                run: (target) => {
                    context.run(owner, `menu "${label}"`, () => run(toScriptTarget(target)));
                },
                isEnabled: enabled ? guardedPredicate(context, owner, `menu "${label}" (enabled)`, false, (target: MenuTarget) => enabled(toScriptTarget(target))) : () => true,
                isChecked: checked ? guardedPredicate(context, owner, `menu "${label}" (checked)`, false, (target: MenuTarget) => checked(toScriptTarget(target))) : () => false,
            };
            const unregister = context.own(menus.register(menu, context.ownerAssetId()));
            return {
                path: label,
                location,
                run: () => menu.run(selectionMenuTarget(host.session)),
                unregister,
            };
        },
        unregister: (path: unknown, location?: unknown) => {
            const member = 'helix.editor.menus.unregister';
            const place = locationOf(location, member);
            return menus.unregister(menuContributionId(place, pathOf(path, place, member)));
        },
        run: (path: unknown, location?: unknown) => find(path, location, 'helix.editor.menus.run').run(selectionMenuTarget(host.session)),
        list: () => menus.list().map((menu) => ({ path: menu.path.join('/'), location: menu.location, shortcut: menu.shortcut })),
    };
}
