import type { EditorExtensions } from '@/engine/editor/extensions/editor-extensions';
import type { RuntimeHost, ScriptContext } from '../../runtime/runtime-host';
import { HelixArgumentError } from '../../runtime/script-errors';
import { requireObject } from '../../runtime/values';
const CONTRIBUTION_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
export interface ExtensionApiContext {
    readonly host: RuntimeHost;
    readonly extensions: EditorExtensions;
    ownerAssetId(): string | null;
    own(unregister: () => void): () => void;
    run(owner: ScriptContext | null, phase: string, action: () => void): boolean;
}
export function requireContributionId(value: unknown, member: string): string {
    if (typeof value === 'string' && CONTRIBUTION_ID.test(value))
        return value;
    throw new HelixArgumentError(member, 'o id precisa ter de 1 a 64 caracteres entre letras, números, ponto, hífen e sublinhado, começando por letra ou número.');
}
export function optionsOf(value: unknown, member: string): Record<string, unknown> {
    return value === undefined || value === null ? {} : requireObject(value, member);
}
export function createExtensionApiContext(host: RuntimeHost): ExtensionApiContext {
    const { extensions } = host.session;
    const registrations = new Set<() => void>();
    host.disposers.add(() => {
        for (const release of Array.from(registrations))
            release();
    });
    return {
        host,
        extensions,
        ownerAssetId: () => extensions.ownerAssetId(host.current),
        own: (unregister) => {
            const release = () => {
                if (registrations.delete(release))
                    unregister();
            };
            registrations.add(release);
            host.current?.track(release);
            return release;
        },
        run: (owner, phase, action) => {
            let completed = false;
            host.invoke(owner, phase, () => {
                action();
                completed = true;
            });
            return completed;
        },
    };
}
