import * as vec3 from '@/engine/core/math/vec3';
import type { GizmoPainter } from '@/engine/editor/extensions/gizmos/gizmo-painter';
import { ViewportOverlay } from '@/engine/editor/extensions/overlay/viewport-overlay';
import type { ToolContribution } from '@/engine/editor/extensions/tools/tool-contribution';
import { ToolController } from '@/engine/editor/extensions/tools/tool-controller';
import { findToolByShortcut } from '@/engine/editor/extensions/tools/tool-shortcuts';
import { createCheckList } from '../../support/check-list';
const checks = createCheckList('Ferramentas das extensões');
const ORIGIN = vec3.create();
interface ToolSetup {
    readonly action?: boolean;
    readonly shortcut?: string | null;
}
function createBench() {
    const log: string[] = [];
    const registered = new Map<string, ToolContribution>();
    const tool = (id: string, setup: ToolSetup = {}): ToolContribution => {
        const contribution: ToolContribution = {
            id,
            title: id,
            icon: null,
            shortcut: setup.shortcut ?? null,
            cursor: null,
            isAction: setup.action === true,
            handlesPointer: false,
            surface: null,
            run: () => log.push(`${id}.run`),
            activate: () => log.push(`${id}.on`),
            deactivate: () => log.push(`${id}.off`),
            pointer: () => undefined,
            paint: (painter) => {
                log.push(`${id}.paint`);
                painter.line(ORIGIN, ORIGIN);
            },
        };
        registered.set(id, contribution);
        return contribution;
    };
    const controller = new ToolController({ selectBuiltInTool: () => log.push('select'), notifyToolChanged: () => log.push('notify') }, { get: (id) => registered.get(id) ?? null });
    const take = (): string => log.splice(0).join(' ');
    return { controller, tool, take, registered };
}
function activating(): void {
    const { controller, tool, take } = createBench();
    const brush = tool('pincel');
    const ruler = tool('regua');
    const bake = tool('assar', { action: true });
    controller.trigger(bake);
    checks.check('uma ferramenta de ação roda e não fica ativa', take() === 'assar.run' && controller.active === null);
    controller.activate(bake);
    checks.check('activate ignora uma ferramenta de ação', take() === '' && controller.active === null);
    controller.trigger(brush);
    checks.check('ativar volta o editor para Selecionar e avisa depois de ligar', take() === 'select pincel.on notify' && controller.active === brush);
    controller.activate(brush);
    checks.check('ativar a ferramenta já ativa não faz nada', take() === '');
    controller.trigger(ruler);
    checks.check('trocar desliga a anterior antes de ligar a nova', take() === 'select pincel.off regua.on notify' && controller.active === ruler);
    controller.trigger(ruler);
    checks.check('acionar a ferramenta ativa a desliga', take() === 'regua.off notify' && controller.active === null);
    checks.check('deactivate sem ferramenta ativa devolve falso e não avisa', controller.deactivate() === false && take() === '');
}
function reloading(): void {
    const { controller, tool, take, registered } = createBench();
    const old = tool('pincel');
    controller.activate(old);
    take();
    const reloaded = tool('pincel');
    controller.handleRemoved(old);
    checks.check('a versão recarregada assume no lugar da antiga', take() === 'pincel.off pincel.on notify' && controller.active === reloaded);
    controller.handleRemoved(old);
    checks.check('remover uma ferramenta que não está ativa não muda nada', take() === '' && controller.active === reloaded);
    registered.delete('pincel');
    controller.handleRemoved(reloaded);
    checks.check('remover a ferramenta ativa sem substituta desliga e avisa', take() === 'pincel.off notify' && controller.active === null);
    const mode = tool('medir');
    controller.activate(mode);
    take();
    tool('medir', { action: true });
    controller.handleRemoved(mode);
    checks.check('uma substituta de ação não é ativada', take() === 'medir.off notify' && controller.active === null);
}
function painting(): void {
    const { controller, tool, take } = createBench();
    const brush = tool('pincel');
    tool('regua');
    const red = vec3.create(1, 0, 0);
    const tint = { paintInto: (painter: GizmoPainter) => painter.setColor(red) };
    const overlay = new ViewportOverlay([tint, controller]);
    checks.check('sem ferramenta ativa, a camada não desenha', overlay.paint().length === 0 && take() === '');
    controller.activate(brush);
    take();
    const lines = overlay.paint();
    checks.check('só a ferramenta ativa desenha', take() === 'pincel.paint' && lines.length === 1);
    checks.check('cada camada começa com o estilo padrão', lines[0].color !== red);
    checks.check('o overlay recomeça vazio a cada quadro', overlay.paint().length === 1);
}
function keyEvent(code: string, key: string, modifiers: Partial<Pick<KeyboardEvent, 'ctrlKey' | 'shiftKey' | 'altKey' | 'metaKey'>> = {}): KeyboardEvent {
    return { code, key, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, ...modifiers } as KeyboardEvent;
}
function shortcuts(): void {
    const { tool } = createBench();
    const tools = [tool('pincel', { shortcut: 'shift b' }), tool('regua', { shortcut: 'm' }), tool('solta')];
    checks.check('o atalho encontra a ferramenta', findToolByShortcut(tools, keyEvent('KeyB', 'B', { shiftKey: true }))?.id === 'pincel');
    checks.check('uma tecla sem modificador também vale', findToolByShortcut(tools, keyEvent('KeyM', 'm'))?.id === 'regua');
    checks.check('uma tecla sem dono não encontra nada', findToolByShortcut(tools, keyEvent('KeyB', 'b')) === null);
    checks.check('pressionar só o modificador não encontra nada', findToolByShortcut(tools, keyEvent('ShiftLeft', 'Shift', { shiftKey: true })) === null);
}
activating();
reloading();
painting();
shortcuts();
checks.finish();
