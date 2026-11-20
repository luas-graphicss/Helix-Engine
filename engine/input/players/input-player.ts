import { ALL_MAPS, type InputAsset } from '../actions/input-asset';
import type { InputDevice } from '../devices/input-device';
import { ActionSet, type ActionSource } from '../runtime/action-set';
import type { ActionListener } from '../runtime/action-state';
export class InputPlayer implements ActionSource {
    version = 0;
    readonly actions: ActionSet;
    private paired: readonly InputDevice[];
    private schemeId: string | null;
    constructor(readonly index: number, asset: InputAsset, scheme: string | null, devices: readonly InputDevice[], announce: ActionListener) {
        this.schemeId = scheme;
        this.paired = devices;
        this.actions = new ActionSet(asset.maps, this, index, announce);
        if (asset.players.defaultMap !== ALL_MAPS)
            this.actions.enableOnly(asset.players.defaultMap);
    }
    get devices(): readonly InputDevice[] {
        return this.paired;
    }
    get scheme(): string | null {
        return this.schemeId;
    }
    assign(scheme: string | null, devices: readonly InputDevice[]): void {
        this.schemeId = scheme;
        this.paired = devices;
        this.version++;
    }
    unpair(device: InputDevice): boolean {
        if (!this.paired.includes(device))
            return false;
        this.paired = this.paired.filter((candidate) => candidate !== device);
        this.version++;
        return true;
    }
}
