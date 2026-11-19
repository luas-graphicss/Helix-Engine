import type { Entity, EntityKind } from '@/engine/core/scene/entity';
import type { EntityFilter } from '@/engine/editor/extensions/targeting/entity-filter';
import type { ScriptContext } from '../../runtime/runtime-host';
import { HelixArgumentError } from '../../runtime/script-errors';
import { requireFunction, requireOneOf } from '../../runtime/values';
import { ENTITY_KINDS } from '../scene';
import { guardedPredicate, type ExtensionApiContext } from './extension-api-context';
function kindsOf(value: unknown, member: string): EntityKind[] | null {
    if (value === undefined || value === null)
        return null;
    const kinds: unknown[] = Array.isArray(value) ? value : [value];
    if (kinds.length === 0)
        throw new HelixArgumentError(member, 'kinds precisa ter ao menos um tipo de ator.');
    return kinds.map((kind) => requireOneOf(kind, ENTITY_KINDS, member, 'o tipo do ator'));
}
export function entityFilterOf(context: ExtensionApiContext, owner: ScriptContext | null, settings: Record<string, unknown>, member: string, label: string): EntityFilter {
    const appliesTo = settings.appliesTo === undefined ? null : requireFunction<(actor: Entity) => unknown>(settings.appliesTo, member, 'appliesTo');
    return {
        kinds: kindsOf(settings.kinds, member),
        applies: appliesTo ? guardedPredicate(context, owner, `${label} (appliesTo)`, false, appliesTo) : () => true,
    };
}
