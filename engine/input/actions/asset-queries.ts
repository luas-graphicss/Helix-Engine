import type { ControlScheme, InputAction, InputActionMap, InputAsset, InputBinding } from './input-asset';
export interface LocatedAction {
    readonly map: InputActionMap;
    readonly action: InputAction;
}
export interface LocatedBinding extends LocatedAction {
    readonly binding: InputBinding;
}
const PATH_SEPARATOR = '/';
export function findActionMap(asset: InputAsset, key: string): InputActionMap | null {
    return asset.maps.find((map) => map.id === key) ?? asset.maps.find((map) => map.name === key) ?? null;
}
export function findControlScheme(asset: InputAsset, key: string): ControlScheme | null {
    return asset.schemes.find((scheme) => scheme.id === key) ?? asset.schemes.find((scheme) => scheme.name === key) ?? null;
}
export function findActionById(asset: InputAsset, actionId: string): LocatedAction | null {
    for (const map of asset.maps) {
        const action = map.actions.find((candidate) => candidate.id === actionId);
        if (action)
            return { map, action };
    }
    return null;
}
export function findActionByPath(asset: InputAsset, path: string): LocatedAction | null {
    const separator = path.indexOf(PATH_SEPARATOR);
    if (separator >= 0) {
        const map = asset.maps.find((candidate) => candidate.name === path.slice(0, separator));
        const action = map?.actions.find((candidate) => candidate.name === path.slice(separator + 1));
        return map && action ? { map, action } : null;
    }
    const matches: LocatedAction[] = [];
    for (const map of asset.maps)
        for (const action of map.actions)
            if (action.name === path)
                matches.push({ map, action });
    return matches.length === 1 ? matches[0] : null;
}
export function findBinding(asset: InputAsset, bindingId: string): LocatedBinding | null {
    for (const map of asset.maps)
        for (const action of map.actions) {
            const binding = action.bindings.find((candidate) => candidate.id === bindingId);
            if (binding)
                return { map, action, binding };
        }
    return null;
}
export function countActions(asset: InputAsset): number {
    let total = 0;
    for (const map of asset.maps)
        total += map.actions.length;
    return total;
}
export function countBindings(asset: InputAsset): number {
    let total = 0;
    for (const map of asset.maps)
        for (const action of map.actions)
            total += action.bindings.length;
    return total;
}
export function bindingPaths(binding: InputBinding): string[] {
    return binding.composite === null ? [binding.path] : binding.parts.map((part) => part.path);
}
