import { DockLayoutStore, extensionPanelId, extensionWindowId, isDockPanelId, isExtensionPanelId } from '@/engine/editor/layout/dock-layout';
import { createCheckList } from '../../support/check-list';
const checks = createCheckList('Janelas de extensão no layout de painéis');
function panelIds(): void {
    const id = extensionPanelId('fileira');
    checks.check('o id do painel traz o prefixo das extensões', id === 'ext:fileira', id);
    checks.check('extensionWindowId desfaz extensionPanelId', extensionWindowId(id) === 'fileira');
    checks.check('isExtensionPanelId recusa o prefixo sozinho e os painéis embutidos', isExtensionPanelId(id) && !isExtensionPanelId('ext:') && !isExtensionPanelId('console'));
    checks.check('isDockPanelId aceita embutidos e extensões e recusa o resto', isDockPanelId('console') && isDockPanelId(id) && !isDockPanelId('inexistente') && !isDockPanelId(7));
}
function docking(): void {
    const dock = new DockLayoutStore();
    const id = extensionPanelId('fileira');
    checks.check('uma janela nunca aberta não tem área lembrada', dock.rememberedArea(id) === null);
    dock.open(id, 'bottom');
    checks.check('a janela abre na área pedida e fica ativa', dock.area(id) === 'bottom' && dock.getSnapshot().areas.bottom.active === id);
    dock.close(id);
    checks.check('fechar guarda a área para a próxima abertura', !dock.isOpen(id) && dock.rememberedArea(id) === 'bottom');
    dock.open(id);
    checks.check('reabrir sem área volta para a lembrada', dock.area(id) === 'bottom');
    dock.move(id, 'left');
    checks.check('mover leva a janela para outra área', dock.area(id) === 'left');
    checks.check('janelas de extensão não entram na lista de painéis fechados', !(dock.closedPanels() as string[]).includes(id));
    dock.reset();
    checks.check('restaurar o layout fecha as janelas de extensão', dock.area(id) === null);
}
panelIds();
docking();
checks.finish();
