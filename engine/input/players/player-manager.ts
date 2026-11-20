import { findControlScheme } from '../actions/asset-queries';
import { PRESS_POINT } from '../actions/binding-limits';
import { ALL_MAPS, type InputActionMap, type InputAsset } from '../actions/input-asset';
import { resolveControl } from '../controls/control-descriptor';
import type { DeviceRegistry } from '../devices/device-registry';
import type { InputDevice } from '../devices/input-device';
import type { ActionListener } from '../runtime/action-state';
import { InputPlayer } from './input-player';
import { collectSchemeDevices, schemeBindsControl } from './scheme-matching';
export type PlayerEvent = 'joined' | 'left' | 'deviceLost';
export type PlayerListener = (event: PlayerEvent, player: InputPlayer, device: InputDevice | null) => void;
export interface JoinRequest {
    readonly scheme?: string;
    readonly devices?: readonly InputDevice[];
}
function isPressed(value: number): boolean {
    return Math.abs(value) >= PRESS_POINT;
}
export class PlayerManager {
    private players: readonly InputPlayer[] = [];
    private readonly listeners = new Set<PlayerListener>();
    private readonly held = new WeakMap<InputDevice, Set<string>>();
    constructor(private asset: InputAsset, private readonly registry: DeviceRegistry, private readonly announce: ActionListener) {
        registry.onChange((change, device) => {
            if (change === 'removed')
                this.unpair(device);
        });
    }
    get all(): readonly InputPlayer[] {
        return this.players;
    }
    get(index: number): InputPlayer | null {
        return this.players.find((player) => player.index === index) ?? null;
    }
    setAsset(asset: InputAsset): void {
        this.asset = asset;
    }
    join(request: JoinRequest = {}): InputPlayer | null {
        if (this.players.length >= this.asset.players.maxPlayers)
            return null;
        const scheme = request.scheme === undefined ? null : findControlScheme(this.asset, request.scheme);
        if (request.scheme !== undefined && !scheme)
            return null;
        if (request.devices)
            return this.add(scheme?.id ?? null, request.devices);
        for (const candidate of scheme ? [scheme] : this.asset.schemes) {
            const devices = collectSchemeDevices(candidate, this.registry.all, this.isTaken, null);
            if (devices && devices.length > 0)
                return this.add(candidate.id, devices);
        }
        return null;
    }
    leave(player: InputPlayer): void {
        if (!this.players.includes(player))
            return;
        this.players = this.players.filter((other) => other !== player);
        this.notify('left', player, null);
    }
    update(delta: number, frame: number): void {
        if (this.asset.players.joinMode === 'buttonPress')
            this.detectJoins();
        for (const player of this.players) {
            player.actions.setMaps(this.asset.maps);
            player.actions.update(delta, frame);
        }
    }
    onEvent(listener: PlayerListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    private readonly isTaken = (device: InputDevice, schemeId: string): boolean => this.players.some((player) => player.devices.includes(device) && (player.scheme === null || player.scheme === schemeId));
    private add(scheme: string | null, devices: readonly InputDevice[]): InputPlayer {
        const player = new InputPlayer(this.freeIndex(), this.asset, scheme, devices, this.announce);
        this.players = [...this.players, player].sort((a, b) => a.index - b.index);
        this.notify('joined', player, null);
        return player;
    }
    private freeIndex(): number {
        let index = 0;
        while (this.players.some((player) => player.index === index))
            index++;
        return index;
    }
    private unpair(device: InputDevice): void {
        for (const player of this.players)
            if (player.unpair(device))
                this.notify('deviceLost', player, device);
    }
    private notify(event: PlayerEvent, player: InputPlayer, device: InputDevice | null): void {
        for (const listener of Array.from(this.listeners))
            listener(event, player, device);
    }
    private heldControls(device: InputDevice): Set<string> {
        const known = this.held.get(device);
        if (known)
            return known;
        const seeded = new Set<string>();
        for (const [control, value] of device.values)
            if (isPressed(value))
                seeded.add(control);
        this.held.set(device, seeded);
        return seeded;
    }
    private detectJoins(): void {
        for (const device of this.registry.all) {
            const held = this.heldControls(device);
            for (const [control, value] of device.values) {
                if (!isPressed(value)) {
                    held.delete(control);
                    continue;
                }
                if (held.has(control))
                    continue;
                held.add(control);
                this.joinFromPress(device, control);
            }
        }
    }
    private joinFromPress(device: InputDevice, control: string): void {
        if (this.players.length >= this.asset.players.maxPlayers)
            return;
        const resolved = resolveControl(device.controls, control);
        if (resolved && resolved.descriptor.motion !== 'state')
            return;
        const maps = this.joinMaps();
        for (const scheme of this.asset.schemes) {
            if (this.isTaken(device, scheme.id) || !schemeBindsControl(maps, scheme.id, device, control))
                continue;
            const devices = collectSchemeDevices(scheme, this.registry.all, this.isTaken, device);
            if (!devices?.includes(device))
                continue;
            this.add(scheme.id, devices);
            return;
        }
    }
    private joinMaps(): readonly InputActionMap[] {
        const { defaultMap } = this.asset.players;
        return defaultMap === ALL_MAPS ? this.asset.maps : this.asset.maps.filter((map) => map.id === defaultMap);
    }
}
