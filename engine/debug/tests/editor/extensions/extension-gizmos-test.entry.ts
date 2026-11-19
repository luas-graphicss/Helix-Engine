import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import type { Entity, EntityKind } from '@/engine/core/scene/entity';
import type { GizmoContribution, GizmoVisibility } from '@/engine/editor/extensions/gizmos/gizmo-contribution';
import { GizmoPainter } from '@/engine/editor/extensions/gizmos/gizmo-painter';
import { paintGizmos, type GizmoScene } from '@/engine/editor/extensions/gizmos/paint-gizmos';
import { createCheckList } from '../../support/check-list';
const checks = createCheckList('Gizmos das extensões');
const ORIGIN = vec3.create();
const translation = (x: number, y: number, z: number) => mat4.fromTranslationRotationScale(mat4.create(), vec3.create(x, y, z), vec3.create(), vec3.create(1, 1, 1));
function shapes(): void {
    const painter = new GizmoPainter(1000);
    painter.box(ORIGIN, vec3.create(2, 4, 6));
    checks.check('uma caixa tem doze arestas', painter.lines.length === 12, String(painter.lines.length));
    const lengths = painter.lines.map((line) => vec3.distance(line.a, line.b)).sort((a, b) => a - b);
    checks.check('as arestas da caixa têm os três tamanhos pedidos', lengths[0] === 2 && lengths[4] === 4 && lengths[11] === 6, lengths.join(','));
    painter.reset();
    painter.circle(vec3.create(1, 2, 3), vec3.create(0, 1, 0), 2);
    checks.check('um círculo fecha em 32 segmentos', painter.lines.length === 32 && vec3.distance(painter.lines[0].a, painter.lines[31].b) < 1e-5);
    checks.check('os pontos do círculo ficam no raio e no plano', painter.lines.every((line) => Math.abs(vec3.distance(line.a, vec3.create(1, 2, 3)) - 2) < 1e-5 && Math.abs(line.a[1] - 2) < 1e-5));
    painter.reset();
    painter.circle(ORIGIN, vec3.create(0, 0, 0), 1);
    checks.check('uma normal nula cai no plano horizontal', painter.lines.every((line) => Math.abs(line.a[1]) < 1e-5));
    painter.reset();
    painter.sphere(ORIGIN, 1);
    checks.check('uma esfera são três círculos', painter.lines.length === 96, String(painter.lines.length));
    painter.reset();
    painter.arrow(ORIGIN, vec3.create(0, 0, -2));
    checks.check('uma seta tem a haste e quatro linhas na ponta', painter.lines.length === 5 && painter.lines.slice(1).every((line) => line.a[2] === -2), String(painter.lines.length));
    painter.reset();
    painter.arrow(ORIGIN, ORIGIN);
    checks.check('uma seta sem comprimento fica só com a haste', painter.lines.length === 1);
    painter.reset();
    painter.polyline([ORIGIN, vec3.create(1, 0, 0), vec3.create(1, 1, 0)], true);
    checks.check('uma polilinha fechada volta ao primeiro ponto', painter.lines.length === 3 && vec3.distance(painter.lines[2].b, ORIGIN) === 0);
    painter.reset();
    painter.ray(ORIGIN, vec3.create(0, 5, 0), 3);
    checks.nearAll('um raio normaliza a direção', painter.lines[0].b, [0, 3, 0]);
}
function state(): void {
    const painter = new GizmoPainter(3);
    const red = vec3.create(1, 0, 0);
    painter.setColor(red, 4);
    painter.line(ORIGIN, vec3.create(1, 0, 0));
    checks.check('a cor vale para as linhas seguintes e a opacidade fica entre 0 e 1', painter.lines[0].color === red && painter.lines[0].alpha === 1);
    painter.resetStyle();
    painter.withMatrix(translation(10, 0, 0), () => {
        painter.withMatrix(translation(0, 5, 0), () => painter.line(ORIGIN, ORIGIN));
        painter.line(ORIGIN, ORIGIN);
    });
    checks.nearAll('matrizes aninhadas se compõem', painter.lines[1].a, [10, 5, 0]);
    checks.nearAll('ao sair, vale a matriz de fora', painter.lines[2].a, [10, 0, 0]);
    checks.check('resetStyle devolve a cor padrão', painter.lines[1].color !== red);
    painter.line(ORIGIN, ORIGIN);
    checks.check('o limite de linhas barra o excesso', painter.isFull && painter.lines.length === 3);
    const source = vec3.create(1, 2, 3);
    const copy = new GizmoPainter(10);
    copy.line(source, source);
    source[0] = 99;
    checks.check('a linha guarda uma cópia dos pontos', copy.lines[0].a[0] === 1);
    let failed = false;
    try {
        copy.withMatrix(translation(1, 0, 0), () => {
            throw new Error('falha de propósito');
        });
    }
    catch {
        failed = true;
    }
    copy.line(ORIGIN, ORIGIN);
    checks.check('uma falha no desenho não deixa a matriz presa', failed && copy.lines[1].a[0] === 0);
}
interface GizmoSetup {
    readonly visibility?: GizmoVisibility;
    readonly kinds?: readonly EntityKind[] | null;
    readonly scene?: boolean;
    readonly actors?: boolean;
}
function actor(kind: EntityKind, name: string, visible = true): Entity {
    return { kind, name, visible, parent: {} } as Entity;
}
function sceneOf(actors: readonly Entity[], selection: readonly Entity[]): GizmoScene {
    return {
        selection,
        isSelected: (entity) => selection.includes(entity),
        forEachVisibleActor: (visit) => actors.filter((entity) => entity.visible).forEach(visit),
    };
}
function painting(): void {
    const calls: string[] = [];
    const gizmo = (id: string, setup: GizmoSetup = {}): GizmoContribution => ({
        id,
        kinds: setup.kinds ?? null,
        applies: () => true,
        visibility: setup.visibility ?? 'always',
        drawsActors: setup.actors !== false,
        paintActor: (painter, entity, selected) => {
            calls.push(`${id}:${entity.name}${selected ? '*' : ''}`);
            painter.line(ORIGIN, ORIGIN);
        },
        paintScene: () => {
            if (setup.scene)
                calls.push(`${id}:cena`);
        },
    });
    const box = actor('mesh', 'caixa');
    const lamp = actor('light', 'luz');
    const hidden = actor('mesh', 'oculta', false);
    const run = (gizmos: GizmoContribution[], scene: GizmoScene, painter = new GizmoPainter(100)): string => {
        calls.length = 0;
        paintGizmos(gizmos, scene, painter);
        return calls.join(' ');
    };
    checks.check('um gizmo "always" passa por todos os atores visíveis', run([gizmo('a')], sceneOf([box, lamp, hidden], [lamp])) === 'a:caixa a:luz*', calls.join(' '));
    checks.check('um gizmo "selected" só desenha a seleção visível', run([gizmo('s', { visibility: 'selected' })], sceneOf([box, lamp, hidden], [lamp, hidden])) === 's:luz*', calls.join(' '));
    checks.check('kinds filtra os atores do gizmo', run([gizmo('m', { kinds: ['mesh'] })], sceneOf([box, lamp], [])) === 'm:caixa', calls.join(' '));
    checks.check('misturados, cada gizmo segue a própria visibilidade', run([gizmo('a'), gizmo('s', { visibility: 'selected' })], sceneOf([box, lamp], [lamp])) === 'a:caixa a:luz* s:luz*', calls.join(' '));
    checks.check('o desenho da cena roda uma vez, antes dos atores', run([gizmo('c', { scene: true })], sceneOf([box, lamp], [])) === 'c:cena c:caixa c:luz', calls.join(' '));
    checks.check('um gizmo só de cena não percorre os atores', run([gizmo('c', { scene: true, actors: false })], sceneOf([box, lamp], [])) === 'c:cena', calls.join(' '));
    checks.check('com o limite atingido, os atores seguintes não são desenhados', run([gizmo('a')], sceneOf([box, lamp], []), new GizmoPainter(1)) === 'a:caixa', calls.join(' '));
}
shapes();
state();
painting();
checks.finish();
