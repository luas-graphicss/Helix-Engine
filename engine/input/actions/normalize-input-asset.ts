import { isBuiltInLayout, MAX_CONTROL_PATH_LENGTH, parseControlPath } from '../controls/control-path';
import { CUSTOM_CONTROL_KINDS, sanitizeCustomControlId, sanitizeLayoutName, type CustomControl, type CustomDeviceLayout } from '../controls/custom-layout';
import { clampInteraction, clampProcessors } from './binding-limits';
import { createDefaultInputAsset } from './default-input-asset';
import { ALL_MAPS, COMPOSITE_FOR_TYPE, COMPOSITE_KINDS, COMPOSITE_PARTS, DEFAULT_INTERACTION, DEFAULT_PLAYER_SETTINGS, DEFAULT_PROCESSORS, INPUT_ACTION_TYPES, INTERACTION_KINDS, JOIN_MODES, MAX_LOCAL_PLAYERS, type ControlScheme, type InputAction, type InputActionMap, type InputActionType, type InputAsset, type InputBinding, type InputPlayerSettings, type SchemeDevice } from './input-asset';
import { createInputId } from './input-factories';
import { sanitizeInputName, uniqueName } from './input-names';
const MAX_MAPS = 32;
const MAX_ACTIONS_PER_MAP = 128;
const MAX_BINDINGS_PER_ACTION = 32;
const MAX_SCHEMES = 16;
const MAX_SCHEME_DEVICES = 8;
const MAX_CUSTOM_DEVICES = 16;
const MAX_CUSTOM_CONTROLS = 64;
const MAX_COMPOSITE_PARTS = 8;
const MAX_ID_LENGTH = 64;
const MAX_RAW_TEXT_LENGTH = 256;
const ID_PATTERN = /^[\w.-]+$/;
type Fields = Readonly<Record<string, unknown>>;
class IdAllocator {
    private readonly taken = new Set<string>();
    claim(value: unknown, prefix: string): string {
        const candidate = textOf(value, MAX_ID_LENGTH);
        const id = ID_PATTERN.test(candidate) && !this.taken.has(candidate) ? candidate : createInputId(prefix);
        this.taken.add(id);
        return id;
    }
}
function fieldsOf(value: unknown): Fields | null {
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Fields) : null;
}
function itemsOf(value: unknown, limit: number): Fields[] {
    if (!Array.isArray(value))
        return [];
    const items: Fields[] = [];
    for (const item of value.slice(0, limit)) {
        const fields = fieldsOf(item);
        if (fields)
            items.push(fields);
    }
    return items;
}
function textOf(value: unknown, limit: number): string {
    return typeof value === 'string' ? value.slice(0, limit) : '';
}
function numberOf(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
function optionOf<TOption extends string>(value: unknown, options: readonly TOption[], fallback: TOption): TOption {
    return options.find((option) => option === value) ?? fallback;
}
function pathOf(value: unknown): string {
    const path = textOf(value, MAX_CONTROL_PATH_LENGTH);
    return parseControlPath(path) ? path : '';
}
function claimName(value: unknown, fallback: string, taken: string[]): string {
    const name = uniqueName(sanitizeInputName(textOf(value, MAX_RAW_TEXT_LENGTH)) || fallback, taken);
    taken.push(name);
    return name;
}
function normalizeBinding(fields: Fields, ids: IdAllocator, schemeIds: readonly string[], type: InputActionType): InputBinding | null {
    const composite = COMPOSITE_KINDS.find((kind) => kind === fields.composite) ?? null;
    if (composite !== null && composite !== COMPOSITE_FOR_TYPE[type])
        return null;
    const stored = itemsOf(fields.parts, MAX_COMPOSITE_PARTS);
    const parts = composite === null ? [] : COMPOSITE_PARTS[composite].map((name) => ({ name, path: pathOf(stored.find((part) => part.name === name)?.path) }));
    const interaction = fieldsOf(fields.interaction);
    const processors = fieldsOf(fields.processors);
    const schemes = fields.schemes;
    return {
        id: ids.claim(fields.id, 'binding'),
        path: composite === null ? pathOf(fields.path) : '',
        composite,
        parts,
        schemes: Array.isArray(schemes) ? schemeIds.filter((id) => schemes.includes(id)) : [],
        interaction: clampInteraction({ kind: optionOf(interaction?.kind, INTERACTION_KINDS, DEFAULT_INTERACTION.kind), duration: numberOf(interaction?.duration, DEFAULT_INTERACTION.duration) }),
        processors: clampProcessors({
            deadzone: numberOf(processors?.deadzone, DEFAULT_PROCESSORS.deadzone),
            scale: numberOf(processors?.scale, DEFAULT_PROCESSORS.scale),
            invertX: processors?.invertX === true,
            invertY: processors?.invertY === true,
        }),
    };
}
function normalizeAction(fields: Fields, ids: IdAllocator, schemeIds: readonly string[], takenNames: string[]): InputAction {
    const type = optionOf(fields.type, INPUT_ACTION_TYPES, 'button');
    const bindings: InputBinding[] = [];
    for (const item of itemsOf(fields.bindings, MAX_BINDINGS_PER_ACTION)) {
        const binding = normalizeBinding(item, ids, schemeIds, type);
        if (binding)
            bindings.push(binding);
    }
    return { id: ids.claim(fields.id, 'action'), name: claimName(fields.name, 'Action', takenNames), type, bindings };
}
function normalizeMaps(value: unknown, ids: IdAllocator, schemeIds: readonly string[]): InputActionMap[] {
    const mapNames: string[] = [];
    return itemsOf(value, MAX_MAPS).map((fields) => {
        const actionNames: string[] = [];
        const actions = itemsOf(fields.actions, MAX_ACTIONS_PER_MAP).map((action) => normalizeAction(action, ids, schemeIds, actionNames));
        return { id: ids.claim(fields.id, 'map'), name: claimName(fields.name, 'Map', mapNames), actions };
    });
}
function normalizeSchemeDevices(value: unknown): SchemeDevice[] {
    const devices: SchemeDevice[] = [];
    for (const fields of itemsOf(value, MAX_SCHEME_DEVICES)) {
        const layout = sanitizeLayoutName(textOf(fields.layout, MAX_RAW_TEXT_LENGTH));
        if (layout !== '')
            devices.push({ layout, optional: fields.optional === true });
    }
    return devices;
}
function normalizeSchemes(value: unknown, ids: IdAllocator): ControlScheme[] {
    const names: string[] = [];
    return itemsOf(value, MAX_SCHEMES).map((fields) => ({ id: ids.claim(fields.id, 'scheme'), name: claimName(fields.name, 'Scheme', names), devices: normalizeSchemeDevices(fields.devices) }));
}
function normalizeCustomControls(value: unknown): CustomControl[] {
    const controls: CustomControl[] = [];
    for (const fields of itemsOf(value, MAX_CUSTOM_CONTROLS)) {
        const id = sanitizeCustomControlId(textOf(fields.id, MAX_RAW_TEXT_LENGTH));
        if (id !== '' && !controls.some((control) => control.id === id))
            controls.push({ id, kind: optionOf(fields.kind, CUSTOM_CONTROL_KINDS, 'button') });
    }
    return controls;
}
function normalizeCustomDevices(value: unknown): CustomDeviceLayout[] {
    const layouts: CustomDeviceLayout[] = [];
    for (const fields of itemsOf(value, MAX_CUSTOM_DEVICES)) {
        const name = sanitizeLayoutName(textOf(fields.name, MAX_RAW_TEXT_LENGTH));
        if (name !== '' && !isBuiltInLayout(name) && !layouts.some((layout) => layout.name === name))
            layouts.push({ name, controls: normalizeCustomControls(fields.controls) });
    }
    return layouts;
}
function normalizePlayers(fields: Fields | null, maps: readonly InputActionMap[]): InputPlayerSettings {
    if (!fields)
        return DEFAULT_PLAYER_SETTINGS;
    const maxPlayers = Math.round(numberOf(fields.maxPlayers, DEFAULT_PLAYER_SETTINGS.maxPlayers));
    return {
        maxPlayers: Math.min(MAX_LOCAL_PLAYERS, Math.max(1, maxPlayers)),
        joinMode: optionOf(fields.joinMode, JOIN_MODES, DEFAULT_PLAYER_SETTINGS.joinMode),
        defaultMap: maps.find((map) => map.id === fields.defaultMap)?.id ?? ALL_MAPS,
    };
}
export function normalizeInputAsset(value: unknown): InputAsset {
    const fields = fieldsOf(value);
    if (!fields || !Array.isArray(fields.maps))
        return createDefaultInputAsset();
    const ids = new IdAllocator();
    const schemes = normalizeSchemes(fields.schemes, ids);
    const maps = normalizeMaps(fields.maps, ids, schemes.map((scheme) => scheme.id));
    return { maps, schemes, customDevices: normalizeCustomDevices(fields.customDevices), players: normalizePlayers(fieldsOf(fields.players), maps) };
}
