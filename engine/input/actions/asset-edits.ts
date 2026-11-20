import { isBuiltInLayout } from '../controls/control-path';
import { sanitizeCustomControlId, sanitizeLayoutName, type CustomControl } from '../controls/custom-layout';
import { clampInteraction, clampProcessors } from './binding-limits';
import { ALL_MAPS, COMPOSITE_FOR_TYPE, MAX_LOCAL_PLAYERS, type ControlScheme, type InputAction, type InputActionMap, type InputAsset, type InputBinding, type InputPlayerSettings } from './input-asset';
import { sanitizeInputName, uniqueName } from './input-names';
export type ActionPatch = Partial<Pick<InputAction, 'name' | 'type'>>;
export type BindingPatch = Partial<Pick<InputBinding, 'path' | 'schemes' | 'interaction' | 'processors'>>;
export type SchemePatch = Partial<Pick<ControlScheme, 'name' | 'devices'>>;
function editItems<TItem>(items: readonly TItem[], edit: (item: TItem) => TItem | null): readonly TItem[] {
    const edited: TItem[] = [];
    let changed = false;
    for (const item of items) {
        const next = edit(item);
        changed ||= next !== item;
        if (next !== null)
            edited.push(next);
    }
    return changed ? edited : items;
}
function editMaps(asset: InputAsset, edit: (map: InputActionMap) => InputActionMap | null): InputAsset {
    const maps = editItems(asset.maps, edit);
    return maps === asset.maps ? asset : { ...asset, maps };
}
function editActions(asset: InputAsset, edit: (action: InputAction, map: InputActionMap) => InputAction | null): InputAsset {
    return editMaps(asset, (map) => {
        const actions = editItems(map.actions, (action) => edit(action, map));
        return actions === map.actions ? map : { ...map, actions };
    });
}
function editBindings(asset: InputAsset, edit: (binding: InputBinding) => InputBinding | null): InputAsset {
    return editActions(asset, (action) => {
        const bindings = editItems(action.bindings, edit);
        return bindings === action.bindings ? action : { ...action, bindings };
    });
}
function renamed(current: string, requested: string, siblings: readonly string[]): string {
    const sanitized = sanitizeInputName(requested);
    return sanitized === '' ? current : uniqueName(sanitized, siblings);
}
export function addActionMap(asset: InputAsset, map: InputActionMap): InputAsset {
    const name = uniqueName(sanitizeInputName(map.name) || 'Map', asset.maps.map((existing) => existing.name));
    return { ...asset, maps: [...asset.maps, { ...map, name }] };
}
export function renameActionMap(asset: InputAsset, mapId: string, name: string): InputAsset {
    const siblings = asset.maps.filter((map) => map.id !== mapId).map((map) => map.name);
    return editMaps(asset, (map) => {
        const next = map.id === mapId ? renamed(map.name, name, siblings) : map.name;
        return next === map.name ? map : { ...map, name: next };
    });
}
export function removeActionMap(asset: InputAsset, mapId: string): InputAsset {
    const next = editMaps(asset, (map) => (map.id === mapId ? null : map));
    return next.players.defaultMap === mapId ? { ...next, players: { ...next.players, defaultMap: ALL_MAPS } } : next;
}
export function addAction(asset: InputAsset, mapId: string, action: InputAction): InputAsset {
    return editMaps(asset, (map) => {
        if (map.id !== mapId)
            return map;
        const name = uniqueName(sanitizeInputName(action.name) || 'Action', map.actions.map((existing) => existing.name));
        return { ...map, actions: [...map.actions, { ...action, name }] };
    });
}
export function updateAction(asset: InputAsset, actionId: string, patch: ActionPatch): InputAsset {
    return editActions(asset, (action, map) => {
        if (action.id !== actionId)
            return action;
        const siblings = map.actions.filter((other) => other.id !== actionId).map((other) => other.name);
        const name = patch.name === undefined ? action.name : renamed(action.name, patch.name, siblings);
        const type = patch.type ?? action.type;
        if (name === action.name && type === action.type)
            return action;
        const bindings = type === action.type ? action.bindings : action.bindings.filter((binding) => binding.composite === null || binding.composite === COMPOSITE_FOR_TYPE[type]);
        return { ...action, name, type, bindings };
    });
}
export function removeAction(asset: InputAsset, actionId: string): InputAsset {
    return editActions(asset, (action) => (action.id === actionId ? null : action));
}
export function addBinding(asset: InputAsset, actionId: string, binding: InputBinding): InputAsset {
    return editActions(asset, (action) => (action.id === actionId ? { ...action, bindings: [...action.bindings, binding] } : action));
}
export function updateBinding(asset: InputAsset, bindingId: string, patch: BindingPatch): InputAsset {
    return editBindings(asset, (binding) => {
        if (binding.id !== bindingId)
            return binding;
        return {
            ...binding,
            path: patch.path ?? binding.path,
            schemes: patch.schemes ?? binding.schemes,
            interaction: clampInteraction(patch.interaction ?? binding.interaction),
            processors: clampProcessors(patch.processors ?? binding.processors),
        };
    });
}
export function setCompositePartPath(asset: InputAsset, bindingId: string, partName: string, path: string): InputAsset {
    return editBindings(asset, (binding) => {
        if (binding.id !== bindingId)
            return binding;
        return { ...binding, parts: binding.parts.map((part) => (part.name === partName ? { ...part, path } : part)) };
    });
}
export function removeBinding(asset: InputAsset, bindingId: string): InputAsset {
    return editBindings(asset, (binding) => (binding.id === bindingId ? null : binding));
}
export function addControlScheme(asset: InputAsset, scheme: ControlScheme): InputAsset {
    const name = uniqueName(sanitizeInputName(scheme.name) || 'Scheme', asset.schemes.map((existing) => existing.name));
    return { ...asset, schemes: [...asset.schemes, { ...scheme, name }] };
}
export function updateControlScheme(asset: InputAsset, schemeId: string, patch: SchemePatch): InputAsset {
    const siblings = asset.schemes.filter((scheme) => scheme.id !== schemeId).map((scheme) => scheme.name);
    const schemes = editItems(asset.schemes, (scheme) => {
        if (scheme.id !== schemeId)
            return scheme;
        const name = patch.name === undefined ? scheme.name : renamed(scheme.name, patch.name, siblings);
        return name === scheme.name && patch.devices === undefined ? scheme : { ...scheme, name, devices: patch.devices ?? scheme.devices };
    });
    return schemes === asset.schemes ? asset : { ...asset, schemes };
}
export function removeControlScheme(asset: InputAsset, schemeId: string): InputAsset {
    const schemes = asset.schemes.filter((scheme) => scheme.id !== schemeId);
    if (schemes.length === asset.schemes.length)
        return asset;
    const stripped = editBindings(asset, (binding) => {
        if (!binding.schemes.includes(schemeId))
            return binding;
        return binding.schemes.length === 1 ? null : { ...binding, schemes: binding.schemes.filter((id) => id !== schemeId) };
    });
    return { ...stripped, schemes };
}
export function addCustomDevice(asset: InputAsset, name: string): InputAsset {
    const sanitized = sanitizeLayoutName(name);
    if (sanitized === '' || isBuiltInLayout(sanitized) || asset.customDevices.some((layout) => layout.name === sanitized))
        return asset;
    return { ...asset, customDevices: [...asset.customDevices, { name: sanitized, controls: [] }] };
}
export function addCustomControl(asset: InputAsset, layoutName: string, control: CustomControl): InputAsset {
    const id = sanitizeCustomControlId(control.id);
    const customDevices = editItems(asset.customDevices, (layout) => {
        if (layout.name !== layoutName || id === '' || layout.controls.some((existing) => existing.id === id))
            return layout;
        return { ...layout, controls: [...layout.controls, { id, kind: control.kind }] };
    });
    return customDevices === asset.customDevices ? asset : { ...asset, customDevices };
}
export function removeCustomControl(asset: InputAsset, layoutName: string, controlId: string): InputAsset {
    const customDevices = editItems(asset.customDevices, (layout) => {
        if (layout.name !== layoutName || !layout.controls.some((control) => control.id === controlId))
            return layout;
        return { ...layout, controls: layout.controls.filter((control) => control.id !== controlId) };
    });
    return customDevices === asset.customDevices ? asset : { ...asset, customDevices };
}
export function removeCustomDevice(asset: InputAsset, layoutName: string): InputAsset {
    const customDevices = asset.customDevices.filter((layout) => layout.name !== layoutName);
    if (customDevices.length === asset.customDevices.length)
        return asset;
    const schemes = asset.schemes.map((scheme) => (scheme.devices.some((device) => device.layout === layoutName) ? { ...scheme, devices: scheme.devices.filter((device) => device.layout !== layoutName) } : scheme));
    return { ...asset, customDevices, schemes };
}
export function updatePlayerSettings(asset: InputAsset, patch: Partial<InputPlayerSettings>): InputAsset {
    const requested = patch.maxPlayers ?? asset.players.maxPlayers;
    const maxPlayers = Number.isFinite(requested) ? Math.min(MAX_LOCAL_PLAYERS, Math.max(1, Math.round(requested))) : asset.players.maxPlayers;
    const defaultMap = patch.defaultMap ?? asset.players.defaultMap;
    return {
        ...asset,
        players: { maxPlayers, joinMode: patch.joinMode ?? asset.players.joinMode, defaultMap: asset.maps.some((map) => map.id === defaultMap) ? defaultMap : ALL_MAPS },
    };
}
