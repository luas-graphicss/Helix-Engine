import type { MultiplayerRuntime } from '@/engine/net/runtime/multiplayer-runtime';
import { equalNetValues, type NetValue } from '@/engine/net/wire/net-value';
import type { ScriptOwner, Unsubscribe } from '../../runtime/runtime-context';
import type { RuntimeHost } from '../../runtime/runtime-host';
import { requireFunction } from '../../runtime/values';
interface VariableWatch {
    readonly objectId: number;
    readonly name: string;
    readonly owner: ScriptOwner | null;
    readonly callback: (value: NetValue, previous: NetValue) => unknown;
    last: NetValue | undefined;
}
const WATCH_PHASE = 'helix.multiplayer: variável observada';
export class VariableWatches {
    private readonly watches = new Set<VariableWatch>();
    private polling = false;
    constructor(private readonly host: RuntimeHost, private readonly runtime: MultiplayerRuntime) { }
    add(objectId: number, name: string, handler: unknown, member: string): Unsubscribe {
        const callback = requireFunction<(value: NetValue, previous: NetValue) => unknown>(handler, member);
        const watch: VariableWatch = { objectId, name, owner: this.host.current, callback, last: this.read(objectId, name) };
        this.watches.add(watch);
        if (!this.polling) {
            this.polling = true;
            this.host.updaters.add(() => this.poll());
        }
        const stop = (): void => {
            this.watches.delete(watch);
        };
        this.host.current?.track(stop);
        return stop;
    }
    private read(objectId: number, name: string): NetValue | undefined {
        return this.runtime.binding?.ofObject(objectId)?.object.variables.get(name);
    }
    private poll(): void {
        for (const watch of Array.from(this.watches)) {
            const current = this.read(watch.objectId, watch.name);
            if (current === undefined)
                continue;
            const previous = watch.last;
            watch.last = current;
            if (previous !== undefined && !equalNetValues(previous, current))
                this.host.invoke(watch.owner, WATCH_PHASE, () => watch.callback(current, previous));
        }
    }
}
