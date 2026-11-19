import { ContributionRegistry, RegistrationClock, type Contribution } from '@/engine/editor/extensions/registry/contribution-registry';
import { createCheckList } from '../../support/check-list';
interface Sample extends Contribution {
    readonly label: string;
}
const checks = createCheckList('Registro de contribuições das extensões');
function ids(registry: ContributionRegistry<Sample>): string {
    return registry.list().map((item) => item.id).join(',');
}
function registering(): void {
    const removed: string[] = [];
    const registry = new ContributionRegistry<Sample>(new RegistrationClock(), (item) => removed.push(item.label));
    let notifications = 0;
    registry.subscribe(() => notifications++);
    const unregisterFirst = registry.register({ id: 'a', label: 'primeira' }, 'script-1');
    registry.register({ id: 'b', label: 'segunda' }, 'script-1');
    checks.check('list segue a ordem de registro', ids(registry) === 'a,b', ids(registry));
    checks.check('cada registro avisa os ouvintes', notifications === 2, String(notifications));
    registry.register({ id: 'a', label: 'substituta' }, 'script-2');
    checks.check('registrar um id existente troca a contribuição sem mudar a posição', ids(registry) === 'a,b' && registry.get('a')?.label === 'substituta');
    checks.check('a contribuição trocada passa por onRemoved', removed.join(',') === 'primeira', removed.join(','));
    unregisterFirst();
    checks.check('o desfazer de um registro já trocado não remove a substituta', registry.get('a')?.label === 'substituta');
    checks.check('unregister devolve se havia algo', registry.unregister('b') && !registry.unregister('b'));
    checks.check('get de um id ausente devolve null', registry.get('b') === null);
}
function sweeping(): void {
    const clock = new RegistrationClock();
    const registry = new ContributionRegistry<Sample>(clock);
    registry.register({ id: 'velha', label: 'velha' }, 'script-1');
    registry.register({ id: 'mantida', label: 'antes' }, 'script-1');
    registry.register({ id: 'alheia', label: 'alheia' }, 'script-2');
    const mark = clock.current;
    registry.register({ id: 'mantida', label: 'depois' }, 'script-1');
    registry.register({ id: 'nova', label: 'nova' }, 'script-1');
    checks.check('countOwnedBy conta por script', registry.countOwnedBy('script-1') === 3 && registry.countOwnedBy('script-2') === 1);
    registry.sweep('script-1', mark);
    checks.check('sweep tira só o que o script não registrou de novo', ids(registry) === 'mantida,alheia,nova', ids(registry));
    checks.check('a contribuição registrada de novo fica com a versão nova', registry.get('mantida')?.label === 'depois');
    const version = registry.getVersion();
    registry.sweep('script-3', Infinity);
    checks.check('sweep sem nada a tirar não avisa os ouvintes', registry.getVersion() === version);
    registry.clear();
    checks.check('clear esvazia o registro', registry.list().length === 0);
}
registering();
sweeping();
checks.finish();
