import { hasExtension, sanitizeExtensionEntries, withExtension, withExtensionEnabled, withoutExtension } from '@/engine/editor/extensions/host/extension-entries';
import { createCheckList } from '../../support/check-list';
const checks = createCheckList('Lista de extensões do projeto');
function sanitizing(): void {
    checks.check('um valor que não é lista vira lista vazia', sanitizeExtensionEntries({ assetId: 'a' }).length === 0);
    const entries = sanitizeExtensionEntries([{ assetId: 'a', enabled: false }, { assetId: 'b' }, { assetId: 'a', enabled: true }, { enabled: true }, null, 'c', { assetId: '' }]);
    checks.check('entradas sem id, repetidas ou malformadas saem', entries.map((entry) => entry.assetId).join(',') === 'a,b', entries.map((entry) => entry.assetId).join(','));
    checks.check('a primeira ocorrência de um id repetido vence', entries[0].enabled === false);
    checks.check('uma entrada sem o campo enabled fica ligada', entries[1].enabled === true);
}
function editing(): void {
    const base = [{ assetId: 'a', enabled: true }];
    const added = withExtension(base, 'b');
    checks.check('withExtension acrescenta ligada ao fim', added.length === 2 && added[1].assetId === 'b' && added[1].enabled);
    checks.check('withExtension não repete um id existente', withExtension(added, 'a').length === 2);
    checks.check('withExtension não altera a lista recebida', base.length === 1);
    const disabled = withExtensionEnabled(added, 'b', false);
    checks.check('withExtensionEnabled muda só a entrada pedida', disabled[0].enabled && !disabled[1].enabled && added[1].enabled);
    const removed = withoutExtension(disabled, 'a');
    checks.check('withoutExtension tira a entrada pedida', removed.length === 1 && removed[0].assetId === 'b');
    checks.check('hasExtension acompanha a lista', hasExtension(disabled, 'a') && !hasExtension(removed, 'a'));
}
sanitizing();
editing();
checks.finish();
