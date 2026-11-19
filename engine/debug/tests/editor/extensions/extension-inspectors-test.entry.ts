import type { Entity, EntityKind } from '@/engine/core/scene/entity';
import { inspectorTargets, sortInspectors, type InspectorScope } from '@/engine/editor/extensions/inspectors/inspector-targets';
import { matchesEntity } from '@/engine/editor/extensions/targeting/entity-filter';
import { createCheckList } from '../../support/check-list';
const checks = createCheckList('Seções de inspetor das extensões');
function actor(kind: EntityKind, name: string): Entity {
    return { kind, name } as Entity;
}
function scope(setup: Partial<InspectorScope> = {}): InspectorScope {
    return { kinds: null, multiple: false, applies: () => true, ...setup };
}
function names(entities: readonly Entity[]): string {
    return entities.map((entity) => entity.name).join(',');
}
const box = actor('mesh', 'caixa');
const lamp = actor('light', 'lampada');
const folder = actor('group', 'pasta');
function filtering(): void {
    checks.check('sem filtro, qualquer ator casa', matchesEntity(scope(), lamp));
    checks.check('kinds restringe pelo tipo do ator', matchesEntity(scope({ kinds: ['mesh'] }), box) && !matchesEntity(scope({ kinds: ['mesh'] }), lamp));
    checks.check('applies decide depois do tipo', !matchesEntity(scope({ kinds: ['mesh'], applies: (entity) => entity.name === 'outra' }), box));
    let asked = 0;
    matchesEntity(scope({ kinds: ['light'], applies: () => {
            asked++;
            return true;
        } }), box);
    checks.check('applies não roda para um tipo que já foi recusado', asked === 0, String(asked));
}
function targeting(): void {
    checks.check('seleção vazia não tem alvos', inspectorTargets(scope(), []).length === 0);
    checks.check('um ator que casa é o alvo', names(inspectorTargets(scope({ kinds: ['mesh'] }), [box])) === 'caixa');
    checks.check('um ator que não casa esconde a seção', inspectorTargets(scope({ kinds: ['mesh'] }), [lamp]).length === 0);
    checks.check('sem multiple, a seção some com vários atores', inspectorTargets(scope(), [box, lamp]).length === 0);
    checks.check('com multiple, os alvos são os atores que casam', names(inspectorTargets(scope({ multiple: true, kinds: ['mesh', 'group'] }), [box, lamp, folder])) === 'caixa,pasta');
    checks.check('com multiple e nenhum ator casando, a seção some', inspectorTargets(scope({ multiple: true, kinds: ['camera'] }), [box, lamp]).length === 0);
}
function ordering(): void {
    const inspectors = [{ id: 'c', order: 2 }, { id: 'a', order: 0 }, { id: 'b', order: 0 }];
    const sorted = sortInspectors(inspectors);
    checks.check('as seções seguem a ordem e, no empate, o registro', sorted.map((inspector) => inspector.id).join(',') === 'a,b,c', sorted.map((inspector) => inspector.id).join(','));
    checks.check('ordenar não mexe na lista original', inspectors[0].id === 'c');
}
filtering();
targeting();
ordering();
checks.finish();
