import { GuiFrame } from '@/engine/editor/extensions/gui/gui-frame';
import type { GuiNode } from '@/engine/editor/extensions/gui/gui-node';
import { GuiSurface } from '@/engine/editor/extensions/gui/gui-surface';
import { createCheckList } from '../../support/check-list';
const checks = createCheckList('Interface imediata das extensões');
const runAlways = (render: () => void): boolean => {
    render();
    return true;
};
function keyOf(nodes: readonly GuiNode[], index: number): string {
    return nodes[index].key;
}
function keys(): void {
    const frame = new GuiFrame(new Map());
    frame.button('Aplicar');
    frame.button('Aplicar');
    frame.button('Aplicar', { key: 'fixo' });
    frame.section('Opções', () => frame.toggle('Ligado', true));
    checks.check('rótulos repetidos ganham chaves distintas', keyOf(frame.nodes, 0) !== keyOf(frame.nodes, 1));
    checks.check('uma chave explícita não depende do rótulo', keyOf(frame.nodes, 2) === '/key:fixo', keyOf(frame.nodes, 2));
    const section = frame.nodes[3];
    checks.check('os filhos de uma seção ficam sob a chave dela', section.kind === 'section' && section.children[0].key === `${section.key}/toggle:Ligado`);
}
function values(): void {
    const pending = new Map<string, unknown>([['/slider:Força', 7.3], ['/number:Cópias', 99], ['/select:Modo', 'inexistente'], ['/toggle:Ativo', 'sim'], ['/button:Ir', true]]);
    const frame = new GuiFrame(pending);
    checks.near('slider prende ao passo e à faixa', frame.slider('Força', 1, 0, 5, { step: 0.5 }), 5);
    checks.near('number respeita o máximo', frame.number('Cópias', 3, { min: 1, max: 10 }), 10);
    checks.check('select ignora um valor fora das opções', frame.select('Modo', 'a', [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]) === 'a');
    checks.check('toggle ignora um evento de tipo errado', frame.toggle('Ativo', false) === false);
    checks.check('button desligado não dispara', frame.button('Ir', { disabled: true }) === false);
    checks.check('os eventos lidos saem da fila', pending.size === 0, String(pending.size));
    checks.check('changed acusa que um valor mudou', frame.changed);
    const idle = new GuiFrame(new Map());
    idle.slider('Força', 1, 0, 5);
    checks.check('sem eventos, changed fica falso', !idle.changed && !idle.consumedEvent);
}
function immediateMode(): void {
    const state = { count: 0, name: 'Cubo' };
    let passes = 0;
    const surface = new GuiSurface((frame) => {
        passes++;
        frame.label(`Total ${state.count}`);
        if (frame.button('Somar'))
            state.count++;
        state.name = frame.text('Nome', state.name);
    }, runAlways);
    let notifications = 0;
    surface.subscribe(() => notifications++);
    surface.repaint();
    checks.check('repaint sem eventos desenha uma vez', passes === 1 && notifications === 1, `${passes} passes`);
    surface.dispatch('/button:Somar', true);
    const label = surface.tree[0];
    checks.check('o clique chega ao script uma única vez', state.count === 1, String(state.count));
    checks.check('a árvore final já mostra o estado depois do clique', label.kind === 'label' && label.text === 'Total 1', label.kind === 'label' ? label.text : label.kind);
    checks.check('um evento gera o passe do evento e o de acomodação', passes === 3, `${passes} passes`);
    surface.dispatch('/text:Nome', 'Esfera');
    const text = surface.tree[2];
    checks.check('o campo devolve o valor digitado e a árvore o mostra', state.name === 'Esfera' && text.kind === 'text' && text.value === 'Esfera');
    surface.dispatch('/button:Sumiu', true);
    surface.dispatch('/button:Somar', true);
    checks.check('um evento de um controle que não existe mais é descartado', state.count === 2, String(state.count));
}
function failures(): void {
    let broken = true;
    let attempts = 0;
    const surface = new GuiSurface((frame) => {
        attempts++;
        if (broken)
            throw new Error('falha de propósito');
        frame.label('ok');
    }, (render) => {
        try {
            render();
            return true;
        }
        catch {
            return false;
        }
    });
    surface.repaint();
    checks.check('uma falha do script marca a superfície', surface.hasFailed && surface.tree.length === 0);
    surface.refresh();
    checks.check('refresh não insiste numa superfície que falhou', attempts === 1, String(attempts));
    broken = false;
    surface.repaint();
    checks.check('repaint tenta de novo e limpa a falha', !surface.hasFailed && surface.tree.length === 1);
    const lazy = new GuiSurface((frame) => frame.label('x'), runAlways);
    lazy.requestRepaint();
    checks.check('requestRepaint não desenha sem ninguém olhando', lazy.tree.length === 0);
}
keys();
values();
immediateMode();
failures();
checks.finish();
