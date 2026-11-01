import type { Fn } from './values';
export interface InjectedFields {
    readonly entity: unknown;
    readonly helix: Record<string, unknown>;
    readonly script: unknown;
}
export const HOOK_ALIASES: ReadonlyArray<readonly [
    engineHook: string,
    methods: readonly string[]
]> = [
    ['onLoad', ['OnLoad', 'Awake']],
    ['onStart', ['OnStart', 'Start']],
    ['onUpdate', ['OnUpdate', 'Update']],
    ['onFixedUpdate', ['OnFixedUpdate', 'FixedUpdate']],
    ['onLateUpdate', ['OnLateUpdate', 'LateUpdate']],
    ['onRender', ['OnRender']],
    ['onEnable', ['OnEnable']],
    ['onDisable', ['OnDisable']],
    ['onStop', ['OnStop']],
    ['onDestroy', ['OnDestroy']],
    ['onBeforeHotReload', ['OnBeforeHotReload']],
    ['onHotReload', ['OnHotReload']],
    ['onCollisionBegin', ['OnCollisionBegin', 'OnCollisionEnter']],
    ['onCollisionStay', ['OnCollisionStay']],
    ['onCollisionEnd', ['OnCollisionEnd', 'OnCollisionExit']],
    ['onTriggerEnter', ['OnTriggerEnter']],
    ['onTriggerStay', ['OnTriggerStay']],
    ['onTriggerExit', ['OnTriggerExit']],
];
export const HOOK_METHOD_NAMES: ReadonlySet<string> = new Set(HOOK_ALIASES.flatMap(([, methods]) => methods));
export class ActorScript {
    helix: Record<string, unknown>;
    entity: unknown;
    script: unknown;
    constructor($inject?: InjectedFields | null) {
        const fallback = (new.target as unknown as {
            $helix?: Record<string, unknown>;
        }).$helix ?? {};
        this.helix = $inject?.helix ?? fallback;
        this.entity = $inject?.entity ?? null;
        this.script = $inject?.script ?? null;
    }
    $ctor(): this {
        return this;
    }
    get Helix(): Record<string, unknown> {
        return this.helix;
    }
    get Self(): unknown {
        return this.entity ?? (this.helix.self as unknown) ?? null;
    }
    get self(): unknown {
        return this.Self;
    }
    get Actor(): unknown {
        return this.Self;
    }
    get actor(): unknown {
        return this.Self;
    }
    get Entity(): unknown {
        return this.Self;
    }
    get Script(): unknown {
        return this.script;
    }
    OnLoad(): unknown {
        return undefined;
    }
    OnStart(): unknown {
        return undefined;
    }
    OnUpdate(_deltaSeconds: number): unknown {
        return undefined;
    }
    OnFixedUpdate(_deltaSeconds: number): unknown {
        return undefined;
    }
    OnLateUpdate(_deltaSeconds: number): unknown {
        return undefined;
    }
    OnRender(): unknown {
        return undefined;
    }
    OnEnable(): unknown {
        return undefined;
    }
    OnDisable(): unknown {
        return undefined;
    }
    OnStop(): unknown {
        return undefined;
    }
    OnDestroy(): unknown {
        return undefined;
    }
    OnBeforeHotReload(): unknown {
        return undefined;
    }
    OnHotReload(_state: unknown): unknown {
        return undefined;
    }
    OnCollisionBegin(_other: unknown, _contact: unknown): unknown {
        return undefined;
    }
    OnCollisionStay(_other: unknown, _contact: unknown): unknown {
        return undefined;
    }
    OnCollisionEnd(_other: unknown, _contact: unknown): unknown {
        return undefined;
    }
    OnTriggerEnter(_other: unknown): unknown {
        return undefined;
    }
    OnTriggerStay(_other: unknown): unknown {
        return undefined;
    }
    OnTriggerExit(_other: unknown): unknown {
        return undefined;
    }
    $hooks(): Record<string, Fn> {
        const hooks: Record<string, Fn> = {};
        const self = this as unknown as Record<string, unknown>;
        for (const [engineHook, methods] of HOOK_ALIASES) {
            for (const method of methods) {
                const candidate = self[method];
                if (typeof candidate !== 'function')
                    continue;
                const inherited = (ActorScript.prototype as unknown as Record<string, unknown>)[method];
                if (candidate === inherited)
                    continue;
                hooks[engineHook] = (...args: unknown[]) => (candidate as Fn).apply(this, args);
                break;
            }
        }
        return hooks;
    }
    ToString(): string {
        const name = (this as unknown as {
            [key: symbol]: unknown;
        })[Symbol.for('helix.csharp.typeName')];
        return typeof name === 'string' ? name : this.constructor.name;
    }
    Equals(other: unknown): boolean {
        return this === other;
    }
    GetHashCode(): number {
        return 0;
    }
}
