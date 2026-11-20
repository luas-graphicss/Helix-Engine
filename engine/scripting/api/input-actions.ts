import { COMPOSITE_PARTS, type InputBinding } from '@/engine/input/actions/input-asset';
import { parseControlPath } from '@/engine/input/controls/control-path';
import type { RebindOutcome } from '@/engine/input/rebinding/rebind-listener';
import type { ActionSet } from '@/engine/input/runtime/action-set';
import type { ActionState } from '@/engine/input/runtime/action-state';
import type { InteractionSignal } from '@/engine/input/runtime/interactions';
import { HelixArgumentError } from '../runtime/script-errors';
import { optionalNumber, requireFunction, requireNumber, requireObject, requireString } from '../runtime/values';
import { subscribe, type InputApiContext } from './input-context';
const EVERY_PLAYER = 'all';
const REBIND_EVENT = 'input.rebind';
function signalEvent(state: ActionState, signal: InteractionSignal): string {
    return `input.action.${signal}:${state.player ?? EVERY_PLAYER}:${state.action.id}`;
}
function actionValue(state: ActionState) {
    return state.action.type === 'vector2' ? { x: state.value.x, y: state.value.y } : state.value.x;
}
function effectivePaths(set: ActionSet, state: ActionState): string[] {
    const paths: string[] = [];
    for (const binding of state.action.bindings) {
        if (binding.composite === null)
            paths.push(set.overrides.pathOf(binding.id, null) ?? binding.path);
        else
            for (const part of binding.parts)
                paths.push(set.overrides.pathOf(binding.id, part.name) ?? part.path);
    }
    return paths.filter((path) => path !== '');
}
function layoutList(value: unknown, member: string): string[] {
    if (value === undefined)
        return [];
    if (!Array.isArray(value) || value.some((layout) => typeof layout !== 'string'))
        throw new HelixArgumentError(member, 'exclude precisa ser uma lista de layouts, como ["Mouse"].');
    return value;
}
export function createActionSetApi({ host, system, deviceHandle }: InputApiContext, set: ActionSet, member: string, schemeHint: () => string | null) {
    let rebindCount = 0;
    function bindingAt(state: ActionState, settings: Record<string, unknown>, name: string): InputBinding {
        const { bindings } = state.action;
        if (bindings.length === 0)
            throw new HelixArgumentError(name, `a ação "${state.path}" não tem vínculos para trocar.`);
        if (settings.binding === undefined) {
            const scheme = schemeHint();
            return bindings.find((binding) => scheme !== null && binding.schemes.includes(scheme)) ?? bindings[0];
        }
        const index = requireNumber(settings.binding, name, 'o índice do vínculo');
        const binding = bindings[index];
        if (!binding)
            throw new HelixArgumentError(name, `a ação "${state.path}" tem ${bindings.length} vínculo(s); o índice ${index} não existe.`);
        return binding;
    }
    function partOf(binding: InputBinding, part: unknown, name: string): string | null {
        if (binding.composite === null)
            return null;
        const parts = COMPOSITE_PARTS[binding.composite];
        const requested = requireString(part, name, 'a parte do composto (part)');
        if (!parts.includes(requested))
            throw new HelixArgumentError(name, `"${requested}" não é uma parte deste composto. Partes: ${parts.join(', ')}.`);
        return requested;
    }
    function rebind(state: ActionState, options: unknown) {
        const name = `${member}.rebind`;
        const settings = options === undefined || options === null ? {} : requireObject(options, name);
        const binding = bindingAt(state, settings, name);
        const part = partOf(binding, settings.part, name);
        const onComplete = settings.onComplete === undefined ? null : requireFunction<(path: string) => void>(settings.onComplete, name, 'onComplete');
        const onCancel = settings.onCancel === undefined ? null : requireFunction<(reason: string) => void>(settings.onCancel, name, 'onCancel');
        const event = `${REBIND_EVENT}:${state.player ?? EVERY_PLAYER}:${++rebindCount}`;
        host.bus.once(event, (payload) => {
            const outcome = payload as RebindOutcome;
            if (outcome.status === 'completed')
                onComplete?.(outcome.path);
            else
                onCancel?.(outcome.status);
        }, host.current);
        const cancel = system.startRebind({
            expected: part === null ? state.action.type : 'button',
            excludedLayouts: layoutList(settings.exclude, name),
            cancelPath: settings.cancel === null ? null : settings.cancel === undefined ? undefined : requireString(settings.cancel, name, 'o controle de cancelamento'),
            timeout: optionalNumber(settings.timeout, 0, name, 'o tempo limite'),
        }, (outcome) => {
            if (outcome.status === 'completed')
                set.overrides.set(binding.id, part, outcome.path);
            host.bus.emit(event, outcome);
        });
        return { cancel };
    }
    function buildActionHandle(state: ActionState) {
        return {
            get name() {
                return state.action.name;
            },
            get path() {
                return state.path;
            },
            get map() {
                return state.map.name;
            },
            get type() {
                return state.action.type;
            },
            get player() {
                return state.player;
            },
            get value() {
                return actionValue(state);
            },
            get phase() {
                return state.phase;
            },
            get down() {
                return state.isPressed;
            },
            get pressed() {
                return state.pressedFrame === system.frame;
            },
            get released() {
                return state.releasedFrame === system.frame;
            },
            get performed() {
                return state.performedFrame === system.frame;
            },
            get device() {
                return state.device ? deviceHandle(state.device) : null;
            },
            get bindings() {
                return effectivePaths(set, state);
            },
            onStarted: (handler: unknown) => subscribe(host, signalEvent(state, 'started'), handler, `${member}.action.onStarted`),
            onPerformed: (handler: unknown) => subscribe(host, signalEvent(state, 'performed'), handler, `${member}.action.onPerformed`),
            onCanceled: (handler: unknown) => subscribe(host, signalEvent(state, 'canceled'), handler, `${member}.action.onCanceled`),
            rebind: (options?: unknown) => rebind(state, options),
            resetBindings: () => {
                for (const binding of state.action.bindings)
                    set.overrides.remove(binding.id);
            },
        };
    }
    const actionHandles = new WeakMap<ActionState, ReturnType<typeof buildActionHandle>>();
    function handleOf(state: ActionState) {
        const cached = actionHandles.get(state);
        if (cached)
            return cached;
        const handle = buildActionHandle(state);
        actionHandles.set(state, handle);
        return handle;
    }
    function stateAt(path: unknown, name: string): ActionState {
        const key = typeof path === 'string' ? path : requireString(requireObject(path, name, 'a ação').path, name, 'o caminho da ação');
        const state = set.find(key);
        if (!state)
            throw new HelixArgumentError(name, `a ação "${key}" não existe; use "Mapa/Ação" com os nomes do painel Entrada.`);
        return state;
    }
    function buildMapHandle(mapId: string) {
        const nameOf = () => set.actionMaps.find((map) => map.id === mapId)?.name ?? '';
        return {
            get name() {
                return nameOf();
            },
            get enabled() {
                return set.isEnabled(mapId);
            },
            set enabled(value: boolean) {
                if (value)
                    set.enable(mapId);
                else
                    set.disable(mapId);
            },
            enable: () => set.enable(mapId),
            disable: () => set.disable(mapId),
            enableOnly: () => set.enableOnly(mapId),
            action: (name: unknown) => handleOf(stateAt(`${nameOf()}/${requireString(name, `${member}.map.action`, 'o nome da ação')}`, `${member}.map.action`)),
            actions: () => set.inMap(mapId).map(handleOf),
        };
    }
    const mapHandles = new Map<string, ReturnType<typeof buildMapHandle>>();
    function mapHandleOf(mapId: string) {
        const cached = mapHandles.get(mapId);
        if (cached)
            return cached;
        const handle = buildMapHandle(mapId);
        mapHandles.set(mapId, handle);
        return handle;
    }
    host.disposers.add(system.onAction((state, signal) => {
        if (set.byId(state.action.id) !== state)
            return;
        const event = signalEvent(state, signal);
        if (host.bus.listenerCount(event) > 0)
            host.bus.emit(event, { action: handleOf(state), phase: signal, value: actionValue(state), device: state.device ? deviceHandle(state.device) : null, player: state.player });
    }));
    return {
        findAction: (path: unknown) => {
            const state = set.find(requireString(path, `${member}.findAction`, 'o caminho da ação'));
            return state ? handleOf(state) : null;
        },
        map: (name: unknown) => {
            const key = requireString(name, `${member}.map`, 'o nome do mapa');
            const map = set.actionMaps.find((candidate) => candidate.name === key) ?? set.actionMaps.find((candidate) => candidate.id === key);
            if (!map)
                throw new HelixArgumentError(`${member}.map`, `o mapa de ações "${key}" não existe. Mapas: ${set.actionMaps.map((candidate) => candidate.name).join(', ')}.`);
            return mapHandleOf(map.id);
        },
        maps: () => set.actionMaps.map((map) => mapHandleOf(map.id)),
        rebind: (action: unknown, options?: unknown) => rebind(stateAt(action, `${member}.rebind`), options),
        overrides: {
            save: () => set.overrides.toRecord(),
            load: (stored: unknown) => set.overrides.load(stored),
            reset: () => set.overrides.clear(),
            set: (action: unknown, path: unknown, options?: unknown) => {
                const name = `${member}.overrides.set`;
                const state = stateAt(action, name);
                const settings = options === undefined || options === null ? {} : requireObject(options, name);
                const binding = bindingAt(state, settings, name);
                const control = requireString(path, name, 'o caminho do controle');
                if (!parseControlPath(control))
                    throw new HelixArgumentError(name, `"${control}" não é um caminho de controle; use o formato <Keyboard>/Space.`);
                set.overrides.set(binding.id, partOf(binding, settings.part, name), control);
            },
            get count() {
                return set.overrides.size;
            },
        },
    };
}
