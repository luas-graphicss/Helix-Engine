import { findControlScheme } from '@/engine/input/actions/asset-queries';
import type { InputDevice } from '@/engine/input/devices/input-device';
import type { InputPlayer } from '@/engine/input/players/input-player';
import type { PlayerEvent } from '@/engine/input/players/player-manager';
import { HelixArgumentError } from '../runtime/script-errors';
import { requireObject, requireString } from '../runtime/values';
import { createActionSetApi } from './input-actions';
import { subscribe, type InputApiContext } from './input-context';
const PLAYER_EVENTS: Record<PlayerEvent, string> = {
    joined: 'input.players.joined',
    left: 'input.players.left',
    deviceLost: 'input.players.deviceLost',
};
export function createPlayersApi(context: InputApiContext) {
    const { host, system, deviceHandle } = context;
    function schemeKey(value: unknown, member: string): string {
        const key = requireString(value, member, 'o esquema de controle');
        if (!findControlScheme(system.asset, key))
            throw new HelixArgumentError(member, `o esquema "${key}" não existe. Esquemas: ${system.asset.schemes.map((scheme) => scheme.name).join(', ')}.`);
        return key;
    }
    function deviceOf(value: unknown, member: string): InputDevice {
        const id = typeof value === 'string' ? value : requireString(requireObject(value, member, 'o dispositivo').id, member, 'o id do dispositivo');
        const device = system.devices.find(id);
        if (!device)
            throw new HelixArgumentError(member, `o dispositivo "${id}" não está conectado.`);
        return device;
    }
    function buildPlayerHandle(player: InputPlayer) {
        const member = 'helix.input.players.player';
        const actions = createActionSetApi(context, player.actions, member, () => player.scheme);
        return {
            index: player.index,
            get scheme() {
                return player.scheme === null ? null : (findControlScheme(system.asset, player.scheme)?.name ?? null);
            },
            get devices() {
                return player.devices.map(deviceHandle);
            },
            get joined() {
                return system.players.all.includes(player);
            },
            ...actions,
            switchScheme: (scheme: unknown) => system.players.switchScheme(player, schemeKey(scheme, `${member}.switchScheme`)),
            leave: () => system.players.leave(player),
        };
    }
    const handles = new WeakMap<InputPlayer, ReturnType<typeof buildPlayerHandle>>();
    function handleOf(player: InputPlayer) {
        const cached = handles.get(player);
        if (cached)
            return cached;
        const handle = buildPlayerHandle(player);
        handles.set(player, handle);
        return handle;
    }
    function playerAt(value: unknown, member: string): InputPlayer {
        const index = typeof value === 'number' ? value : requireObject(value, member, 'o jogador').index;
        const player = typeof index === 'number' ? system.players.get(index) : null;
        if (!player)
            throw new HelixArgumentError(member, 'esperava um jogador que ainda está na partida ou o índice dele.');
        return player;
    }
    host.disposers.add(system.players.onEvent((event, player, device) => void host.bus.emit(PLAYER_EVENTS[event], { player: handleOf(player), device: device ? deviceHandle(device) : null })));
    return {
        list: () => system.players.all.map(handleOf),
        get: (index: unknown) => {
            const player = typeof index === 'number' ? system.players.get(index) : null;
            return player ? handleOf(player) : null;
        },
        get count() {
            return system.players.all.length;
        },
        get max() {
            return system.asset.players.maxPlayers;
        },
        join: (options?: unknown) => {
            const member = 'helix.input.players.join';
            const settings = options === undefined || options === null ? {} : requireObject(options, member);
            const scheme = settings.scheme === undefined ? undefined : schemeKey(settings.scheme, member);
            const devices = Array.isArray(settings.devices) ? settings.devices.map((device) => deviceOf(device, member)) : undefined;
            const player = system.players.join({ scheme, devices });
            return player ? handleOf(player) : null;
        },
        leave: (player: unknown) => system.players.leave(playerAt(player, 'helix.input.players.leave')),
        onJoined: (handler: unknown) => subscribe(host, PLAYER_EVENTS.joined, handler, 'helix.input.players.onJoined'),
        onLeft: (handler: unknown) => subscribe(host, PLAYER_EVENTS.left, handler, 'helix.input.players.onLeft'),
        onDeviceLost: (handler: unknown) => subscribe(host, PLAYER_EVENTS.deviceLost, handler, 'helix.input.players.onDeviceLost'),
    };
}
