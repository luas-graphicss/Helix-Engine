import { HelixArgumentError } from './script-errors';
import type { CallbackInvoker, ScriptOwner, Unsubscribe } from './runtime-context';
export type EventHandler = (payload: unknown) => void;
interface Subscription {
    readonly name: string;
    readonly handler: EventHandler;
    readonly owner: ScriptOwner | null;
    readonly once: boolean;
    readonly entityId: number | null;
    disposed: boolean;
}
export class EventBus {
    private readonly subscriptions = new Map<string, Subscription[]>();
    private emitting = 0;
    private pendingCleanup = false;
    constructor(private readonly invoker: CallbackInvoker) { }
    on(name: string, handler: EventHandler, owner: ScriptOwner | null, options: {
        once?: boolean;
        entityId?: number | null;
    } = {}): Unsubscribe {
        if (typeof name !== 'string' || name.length === 0)
            throw new HelixArgumentError('helix.events.on', 'o nome do evento precisa ser uma string não vazia.');
        if (typeof handler !== 'function')
            throw new HelixArgumentError('helix.events.on', `o handler de "${name}" precisa ser uma função.`);
        const subscription: Subscription = { name, handler, owner, once: options.once ?? false, entityId: options.entityId ?? null, disposed: false };
        let list = this.subscriptions.get(name);
        if (!list) {
            list = [];
            this.subscriptions.set(name, list);
        }
        list.push(subscription);
        const unsubscribe = () => {
            if (subscription.disposed)
                return;
            subscription.disposed = true;
            this.scheduleCleanup(name);
        };
        owner?.track(unsubscribe);
        return unsubscribe;
    }
    once(name: string, handler: EventHandler, owner: ScriptOwner | null, entityId: number | null = null): Unsubscribe {
        return this.on(name, handler, owner, { once: true, entityId });
    }
    off(name: string, handler: EventHandler): void {
        const list = this.subscriptions.get(name);
        if (!list)
            return;
        for (const subscription of list)
            if (subscription.handler === handler)
                subscription.disposed = true;
        this.scheduleCleanup(name);
    }
    emit(name: string, payload: unknown, entityId: number | null = null): number {
        const list = this.subscriptions.get(name);
        if (!list || list.length === 0)
            return 0;
        let delivered = 0;
        this.emitting++;
        try {
            for (const subscription of list.slice()) {
                if (subscription.disposed)
                    continue;
                if (subscription.entityId !== null && subscription.entityId !== entityId)
                    continue;
                if (subscription.owner && !subscription.owner.active)
                    continue;
                if (subscription.once) {
                    subscription.disposed = true;
                    this.pendingCleanup = true;
                }
                this.invoker.invoke(subscription.owner, `evento "${name}"`, () => subscription.handler(payload));
                delivered++;
            }
        }
        finally {
            this.emitting--;
            if (this.emitting === 0 && this.pendingCleanup)
                this.cleanup();
        }
        return delivered;
    }
    listenerCount(name: string): number {
        return (this.subscriptions.get(name) ?? []).filter((subscription) => !subscription.disposed).length;
    }
    names(): string[] {
        return Array.from(this.subscriptions.entries())
            .filter(([, list]) => list.some((subscription) => !subscription.disposed))
            .map(([name]) => name);
    }
    clear(): void {
        this.subscriptions.clear();
    }
    private scheduleCleanup(name: string): void {
        if (this.emitting > 0) {
            this.pendingCleanup = true;
            return;
        }
        const list = this.subscriptions.get(name);
        if (!list)
            return;
        const alive = list.filter((subscription) => !subscription.disposed);
        if (alive.length === 0)
            this.subscriptions.delete(name);
        else
            this.subscriptions.set(name, alive);
    }
    private cleanup(): void {
        this.pendingCleanup = false;
        for (const name of Array.from(this.subscriptions.keys()))
            this.scheduleCleanup(name);
    }
}
