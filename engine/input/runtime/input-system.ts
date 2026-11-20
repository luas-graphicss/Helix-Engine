import type { ControlScheme, InputActionMap, InputAsset } from '../actions/input-asset';
import type { CustomDeviceLayout } from '../controls/custom-layout';
import { createCustomDevice, customDeviceId } from '../devices/custom-device';
import { DeviceRegistry } from '../devices/device-registry';
import type { InputDevice } from '../devices/input-device';
import { PlayerManager } from '../players/player-manager';
import { RebindListener, type RebindOutcome, type RebindRequest } from '../rebinding/rebind-listener';
import { ActionSet } from './action-set';
import type { ActionListener } from './action-state';
export type SchemeListener = (scheme: ControlScheme) => void;
export type RebindOptions = Omit<RebindRequest, 'devices'>;
interface PendingRebind {
    readonly listener: RebindListener;
    readonly onOutcome: (outcome: RebindOutcome) => void;
}
interface CustomDeviceEntry {
    readonly layout: CustomDeviceLayout;
    readonly device: InputDevice;
}
export class InputSystem {
    readonly devices = new DeviceRegistry();
    readonly actions: ActionSet;
    readonly players: PlayerManager;
    frame = 0;
    private maps: readonly InputActionMap[];
    private customLayouts: readonly CustomDeviceLayout[] = [];
    private readonly customDevices = new Map<string, CustomDeviceEntry>();
    private readonly seenActivity = new WeakMap<InputDevice, number>();
    private readonly schemeListeners = new Set<SchemeListener>();
    private readonly actionListeners = new Set<ActionListener>();
    private usedDevice: InputDevice | null = null;
    private scheme: ControlScheme | null = null;
    private rebind: PendingRebind | null = null;
    constructor(private source: InputAsset) {
        const registry = this.devices;
        const everyDevice = {
            scheme: null,
            get devices() {
                return registry.all;
            },
            get version() {
                return registry.version;
            },
        };
        this.maps = source.maps;
        this.actions = new ActionSet(source.maps, everyDevice, null, this.announce);
        this.players = new PlayerManager(source, registry, this.announce);
        this.syncAsset();
    }
    get asset(): InputAsset {
        return this.source;
    }
    get currentScheme(): ControlScheme | null {
        return this.scheme;
    }
    get lastUsedDevice(): InputDevice | null {
        return this.usedDevice;
    }
    get isRebinding(): boolean {
        return this.rebind !== null;
    }
    setAsset(asset: InputAsset): void {
        this.source = asset;
        this.players.setAsset(asset);
        this.syncAsset();
    }
    customDevice(layoutName: string): InputDevice | null {
        return this.devices.find(customDeviceId(layoutName));
    }
    update(delta: number): void {
        this.frame++;
        this.syncAsset();
        this.trackUsedDevice();
        if (this.rebind) {
            const outcome = this.rebind.listener.update(delta);
            if (outcome)
                this.finishRebind(outcome);
            return;
        }
        this.players.update(delta, this.frame);
        this.actions.update(delta, this.frame);
    }
    startRebind(options: RebindOptions, onOutcome: (outcome: RebindOutcome) => void): () => void {
        if (this.rebind)
            this.finishRebind({ status: 'canceled' });
        const pending: PendingRebind = { listener: new RebindListener({ ...options, devices: () => this.devices.all }), onOutcome };
        this.rebind = pending;
        return () => {
            if (this.rebind === pending)
                this.finishRebind({ status: 'canceled' });
        };
    }
    onSchemeChanged(listener: SchemeListener): () => void {
        this.schemeListeners.add(listener);
        return () => this.schemeListeners.delete(listener);
    }
    onAction(listener: ActionListener): () => void {
        this.actionListeners.add(listener);
        return () => this.actionListeners.delete(listener);
    }
    private readonly announce: ActionListener = (state, signal) => {
        if (this.actionListeners.size === 0)
            return;
        for (const listener of Array.from(this.actionListeners))
            listener(state, signal);
    };
    private finishRebind(outcome: RebindOutcome): void {
        const pending = this.rebind;
        this.rebind = null;
        pending?.onOutcome(outcome);
    }
    private syncAsset(): void {
        const { maps, customDevices } = this.source;
        if (maps !== this.maps) {
            this.maps = maps;
            this.actions.setMaps(maps);
        }
        if (customDevices !== this.customLayouts) {
            this.customLayouts = customDevices;
            this.syncCustomDevices();
        }
    }
    private syncCustomDevices(): void {
        const stale = new Set(this.customDevices.keys());
        for (const layout of this.customLayouts) {
            stale.delete(layout.name);
            if (this.customDevices.get(layout.name)?.layout === layout)
                continue;
            const device = createCustomDevice(layout);
            this.customDevices.set(layout.name, { layout, device });
            this.devices.add(device);
        }
        for (const name of stale) {
            this.customDevices.delete(name);
            this.devices.remove(customDeviceId(name));
        }
    }
    private trackUsedDevice(): void {
        let used: InputDevice | null = null;
        for (const device of this.devices.all) {
            const seen = this.seenActivity.get(device);
            this.seenActivity.set(device, device.activity);
            if (seen !== undefined && seen !== device.activity)
                used = device;
        }
        if (!used || used === this.usedDevice)
            return;
        this.usedDevice = used;
        const { layout } = used;
        const scheme = this.source.schemes.find((candidate) => candidate.devices.some((device) => device.layout === layout));
        if (!scheme || scheme.id === this.scheme?.id)
            return;
        this.scheme = scheme;
        for (const listener of Array.from(this.schemeListeners))
            listener(scheme);
    }
}
