import type { InputDevice } from './input-device';
export type DeviceChange = 'added' | 'removed';
export type DeviceListener = (change: DeviceChange, device: InputDevice) => void;
export class DeviceRegistry {
    version = 0;
    private devices: readonly InputDevice[] = [];
    private readonly listeners = new Set<DeviceListener>();
    get all(): readonly InputDevice[] {
        return this.devices;
    }
    find(id: string): InputDevice | null {
        return this.devices.find((device) => device.id === id) ?? null;
    }
    add(device: InputDevice): void {
        const existing = this.find(device.id);
        if (existing === device)
            return;
        if (existing)
            this.remove(existing.id);
        this.devices = [...this.devices, device];
        this.announce('added', device);
    }
    remove(id: string): void {
        const device = this.find(id);
        if (!device)
            return;
        this.devices = this.devices.filter((candidate) => candidate !== device);
        this.announce('removed', device);
    }
    onChange(listener: DeviceListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    private announce(change: DeviceChange, device: InputDevice): void {
        this.version++;
        for (const listener of Array.from(this.listeners))
            listener(change, device);
    }
}
