import * as vec3 from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import { Scene } from '@/engine/core/scene/scene';
import { createGizmoAxes } from '@/engine/editor/transform/gizmo/gizmo-frame';
import { resolveGizmoAxes, resolveGizmoOrigin } from '@/engine/editor/transform/selection/gizmo-pivot';
import { computeOrientedBounds, createOrientedBounds } from '@/engine/editor/transform/selection/selection-bounds';
import { resolveTransformTargets } from '@/engine/editor/transform/selection/transform-targets';
import { createBox } from '@/engine/renderer/geometry/primitives';
import { createCheckList } from '../../support/check-list';
import type { Triple } from './transform-fixture';
const TOLERANCE = 1e-4;
const checks = createCheckList('Alvos e pivô do gizmo');
function addBox(scene: Scene, name: string, position: Triple, size: Triple = [2, 2, 2], parent: Entity = scene.root): Entity {
    const entity = scene.createEntity({ name, kind: 'mesh', mesh: createBox(...size) }, parent);
    vec3.set(entity.transform.position, ...position);
    return entity;
}
function targets(): void {
    const scene = new Scene();
    const crate = addBox(scene, 'Caixote', [0, 0, 0]);
    const lid = addBox(scene, 'Tampa', [0, 1, 0], [2, 0.2, 2], crate);
    const wall = addBox(scene, 'Parede', [4, 0, 0]);
    wall.locked = true;
    const resolved = resolveTransformTargets([crate, wall], lid);
    checks.check('atores bloqueados ficam fora dos alvos', resolved?.entities.length === 1 && resolved.entities[0] === crate);
    checks.check('o ator ativo é a raiz que contém o principal', resolved?.active === crate);
    checks.check('sem principal, o ativo é a última raiz', resolveTransformTargets([crate, lid], null)?.active === lid);
    checks.check('só bloqueados não geram gizmo', resolveTransformTargets([wall], wall) === null);
    checks.check('a raiz da cena nunca é alvo', resolveTransformTargets([scene.root], scene.root) === null);
}
function origin(): void {
    const scene = new Scene();
    const first = addBox(scene, 'Primeiro', [0, 0, 0]);
    const second = addBox(scene, 'Segundo', [4, 0, 0]);
    scene.updateWorldMatrices();
    const selection = { entities: [first, second], active: second };
    checks.nearAll('Pivô usa a origem do ator ativo', resolveGizmoOrigin(vec3.create(), selection, 'pivot'), [4, 0, 0], TOLERANCE);
    checks.nearAll('Centro usa o meio dos limites da seleção', resolveGizmoOrigin(vec3.create(), selection, 'center'), [2, 0, 0], TOLERANCE);
    const empty = new Scene();
    const near = empty.createEntity({ name: 'Perto', kind: 'group' });
    const far = empty.createEntity({ name: 'Longe', kind: 'group' });
    vec3.set(far.transform.position, 4, 2, 0);
    empty.updateWorldMatrices();
    checks.nearAll('sem malha, Centro usa a média das origens', resolveGizmoOrigin(vec3.create(), { entities: [near, far], active: far }, 'center'), [2, 1, 0], TOLERANCE);
}
function orientation(): void {
    const scene = new Scene();
    const plank = addBox(scene, 'Tábua', [1, 0, 0], [2, 4, 6]);
    vec3.set(plank.transform.rotation, 0, 90, 0);
    scene.updateWorldMatrices();
    const local = resolveGizmoAxes(createGizmoAxes(), plank, 'local');
    const global = resolveGizmoAxes(createGizmoAxes(), plank, 'global');
    checks.nearAll('Local segue a rotação do ator', local[0], [0, 0, -1], TOLERANCE);
    checks.nearAll('Global ignora a rotação do ator', global[0], [1, 0, 0], TOLERANCE);
    const bounds = createOrientedBounds();
    const pivot = vec3.create(1, 0, 0);
    checks.check('um ator com malha tem limites', computeOrientedBounds(bounds, [plank], pivot, local));
    checks.nearAll('nos eixos locais os limites têm o tamanho da malha', bounds.halfExtents, [1, 2, 3], TOLERANCE);
    computeOrientedBounds(bounds, [plank], pivot, global);
    checks.nearAll('nos eixos do mundo os limites acompanham a rotação', bounds.halfExtents, [3, 2, 1], TOLERANCE);
    checks.nearAll('o centro dos limites fica no mundo', bounds.center, [1, 0, 0], TOLERANCE);
    const marker = scene.createEntity({ name: 'Marcador', kind: 'group' });
    checks.check('um ator sem malha não tem limites', !computeOrientedBounds(bounds, [marker], pivot, global));
}
targets();
origin();
orientation();
checks.finish();
