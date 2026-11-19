import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import type { Entity } from '@/engine/core/scene/entity';
import { createMaterial, type Material } from '@/engine/core/scene/material';
import { Scene } from '@/engine/core/scene/scene';
import { byStateThenNearest, byVariantThenNearest, ShaderVariantRegistry } from '@/engine/renderer/batching/batch-order';
import { DynamicBatchSet, fitsDynamicBatch, type DynamicBatch, type DynamicBatchSource } from '@/engine/renderer/batching/dynamic/dynamic-batch-set';
import { MaterialStateRegistry } from '@/engine/renderer/batching/material-state';
import { MaterialValueRegistry } from '@/engine/renderer/batching/merged/material-values';
import { createMergedMeshData, MergedMeshBuilder } from '@/engine/renderer/batching/merged/merged-mesh-builder';
import { StaticBatchSet, type StaticBatchView } from '@/engine/renderer/batching/static/static-batch-set';
import type { MeshData } from '@/engine/renderer/geometry/mesh-data';
import { transformMeshData } from '@/engine/renderer/geometry/mesh-transform';
import { createBox, createCone, createCylinder, createSphere } from '@/engine/renderer/geometry/primitives';
import { createCheckList } from '../support/check-list';
const SETTLE_MS = 500;
const EVICT_MS = 250;
const BOX_VERTICES = 24;
const checks = createCheckList('Lotes de desenho');
const states = new MaterialStateRegistry();
function placed(scene: Scene, name: string, mesh: MeshData, material: Material, x: number): Entity {
    const entity = scene.createEntity({ name, kind: 'mesh', mesh, material });
    vec3.set(entity.transform.position, x, 0, 0);
    return entity;
}
function mergedMeshes(): void {
    const box = createBox(1, 2, 3);
    const world = mat4.fromTranslationRotationScale(mat4.create(), vec3.create(4, 5, 6), vec3.create(30, 45, 60), vec3.create(1, 1, 1));
    const builder = new MergedMeshBuilder();
    builder.append(box, world);
    builder.append(box, mat4.create());
    const merged = createMergedMeshData('merged');
    builder.writeTo(merged);
    const expected = transformMeshData(box, world);
    checks.check('a malha fundida soma os vértices e os índices das partes', merged.positions.length === BOX_VERTICES * 6 && merged.indices.length === box.indices.length * 2);
    checks.nearAll('as posições da primeira parte vão para o espaço do mundo', merged.positions.subarray(0, BOX_VERTICES * 3), expected.positions);
    checks.nearAll('as normais da primeira parte giram com a matriz', merged.normals.subarray(0, BOX_VERTICES * 3), expected.normals);
    checks.nearAll('a segunda parte, sem transformação, fica como a original', merged.positions.subarray(BOX_VERTICES * 3), box.positions);
    checks.check('os índices da segunda parte apontam para os vértices dela', merged.indices[box.indices.length] === box.indices[0] + BOX_VERTICES);
    checks.check('cada vértice ganha uma tangente', merged.tangents.length === BOX_VERTICES * 2 * 4);
}
interface StaticScene {
    scene: Scene;
    material: Material;
    entities: Entity[];
    batches: StaticBatchSet;
    selection: Set<number>;
    hidden: Set<Entity>;
    now: number;
}
function createStaticScene(meshes: readonly MeshData[]): StaticScene {
    const scene = new Scene();
    const material = createMaterial();
    const entities = meshes.map((mesh, index) => placed(scene, `prop ${index}`, mesh, material, index * 2));
    scene.updateWorldMatrices();
    return { scene, material, entities, batches: new StaticBatchSet(new MaterialValueRegistry(), SETTLE_MS, EVICT_MS), selection: new Set(), hidden: new Set(), now: 0 };
}
function drawView(setup: StaticScene, elapsedMs: number): number {
    setup.now += elapsedMs;
    setup.scene.updateWorldMatrices();
    const view: StaticBatchView = {
        isRenderable: (entity) => !setup.hidden.has(entity),
        resolveState: (material) => states.resolve(material),
        selection: setup.selection,
        now: setup.now,
    };
    setup.batches.beginView(view);
    let claimed = 0;
    for (const entity of setup.entities) {
        if (setup.hidden.has(entity) || !entity.mesh || !entity.material)
            continue;
        if (setup.batches.claim({ entity, distance: 10 }, entity.mesh, entity.material, states.resolve(entity.material)))
            claimed++;
    }
    setup.batches.endView();
    return claimed;
}
function settle(setup: StaticScene): number {
    drawView(setup, 0);
    drawView(setup, SETTLE_MS);
    return drawView(setup, 16);
}
function staticBatches(): void {
    const setup = createStaticScene([createBox(), createSphere(), createCylinder()]);
    checks.check('malhas recém-vistas ainda não entram num lote', drawView(setup, 0) === 0);
    checks.check('antes do tempo de repouso nada é fundido', drawView(setup, SETTLE_MS / 2) === 0);
    drawView(setup, SETTLE_MS);
    checks.check('paradas pelo tempo de repouso, as três malhas saem num lote', drawView(setup, 16) === 3 && setup.batches.drawn.length === 1 && setup.batches.stats.batches === 1);
    const [chunk] = setup.batches.drawn;
    const vertices = setup.entities.reduce((sum, entity) => sum + (entity.mesh as MeshData).positions.length / 3, 0);
    checks.check('o lote contém a geometria de todas elas', chunk.meshes.length === 1 && chunk.meshes[0].positions.length === vertices * 3);
    setup.selection.add(setup.entities[0].id);
    checks.check('com uma malha selecionada, o lote não é usado', drawView(setup, 16) === 0);
    setup.selection.clear();
    checks.check('ao limpar a seleção, o mesmo lote volta sem ser refeito', drawView(setup, 16) === 3);
    vec3.set(setup.entities[1].transform.position, 2, 5, 0);
    checks.check('quando uma malha se move, o lote deixa de ser usado', drawView(setup, 16) === 0);
    checks.check('refeito sem a malha que se moveu, o lote volta com as outras duas', drawView(setup, 16) === 2);
    drawView(setup, SETTLE_MS);
    checks.check('a malha que se moveu volta ao lote depois de repousar', drawView(setup, 16) === 3);
    setup.hidden.add(setup.entities[2]);
    checks.check('uma malha que deixou de ser desenhável suspende o lote', drawView(setup, 16) === 0);
    drawView(setup, EVICT_MS * 2);
    checks.check('passado o prazo, o lote é refeito sem ela', drawView(setup, 16) === 2);
    setup.material.roughness = 0.2;
    checks.check('mudar o material desfaz o lote', drawView(setup, 16) === 0);
    setup.material.roughness = 0.3;
    drawView(setup, SETTLE_MS / 2);
    checks.check('um material que continua mudando não refaz o lote', drawView(setup, 16) === 0);
    drawView(setup, SETTLE_MS);
    checks.check('com o material estável de novo, o lote volta', drawView(setup, 16) === 2);
}
function staticExclusions(): void {
    const shared = createBox();
    const instanced = createStaticScene([shared, shared, shared, shared]);
    checks.check('malhas iguais ficam com o instanciamento', settle(instanced) === 0);
    const translucent = createStaticScene([createBox(), createSphere()]);
    translucent.material.alphaMode = 'blend';
    checks.check('materiais com mistura não entram em lote estático', settle(translucent) === 0);
    const dense = createStaticScene([createSphere(0.5, 96, 48), createSphere(0.5, 96, 48)]);
    checks.check('malhas densas não entram em lote estático', settle(dense) === 0);
    const cleared = createStaticScene([createBox(), createSphere()]);
    settle(cleared);
    cleared.batches.clear();
    checks.check('limpar os lotes exige um novo repouso', drawView(cleared, 16) === 0);
}
interface TestSource extends DynamicBatchSource {
    readonly name: string;
}
function dynamicBatches(): void {
    const batches = new DynamicBatchSet<TestSource>();
    const values = new MaterialValueRegistry();
    const stone = createMaterial();
    const metal = createMaterial({ metallic: 1 });
    const source = (name: string, mesh: MeshData, distance: number): TestSource => ({ name, mesh, worldMatrix: mat4.create(), distance });
    const merged: DynamicBatch[] = [];
    const rejected: string[] = [];
    batches.begin();
    batches.add(source('box', createBox(), 8), states.resolve(stone), stone, values.resolve(stone), true);
    batches.add(source('cone', createCone(0.5, 1, 12), 3), states.resolve(stone), stone, values.resolve(stone), true);
    batches.add(source('lone', createBox(), 5), states.resolve(metal), metal, values.resolve(metal), true);
    batches.flush((batch) => merged.push(batch), (item) => rejected.push(item.name));
    checks.check('fontes com o mesmo material saem num lote só', merged.length === 1 && batches.stats.batches === 1 && batches.stats.meshes === 2);
    checks.check('o lote fica à distância da fonte mais próxima', merged[0]?.nearest === 3);
    checks.check('uma fonte sozinha no seu material volta ao caminho normal', rejected.join() === 'lone');
    checks.check('uma caixa cabe num lote dinâmico e uma esfera densa não', fitsDynamicBatch(createBox()) && !fitsDynamicBatch(createSphere(0.5, 64, 32)));
    const sameValues = createMaterial();
    checks.check('materiais com os mesmos valores têm a mesma chave', values.resolve(stone) === values.resolve(sameValues) && values.resolve(stone) !== values.resolve(metal));
    stone.roughness = 0.1;
    checks.check('mudar um valor do material muda a chave', values.resolve(stone) !== values.resolve(sameValues));
}
function ordering(): void {
    const variants = new ShaderVariantRegistry();
    const opaque = states.resolve(createMaterial());
    const masked = states.resolve(createMaterial({ alphaMode: 'mask' }));
    const doubleSided = states.resolve(createMaterial({ doubleSided: true }));
    const batches = [masked, opaque, doubleSided].map((state, index) => ({ state, nearest: index, variant: variants.resolve(state) }));
    const byVariant = [...batches].sort(byVariantThenNearest).map((batch) => batch.state);
    const byState = [...batches].sort(byStateThenNearest).map((batch) => batch.state);
    checks.check('por variante, os lotes do mesmo shader ficam juntos', byVariant[0] === opaque && byVariant[1] === doubleSided && byVariant[2] === masked);
    checks.check('por estado, vale a ordem em que os materiais apareceram', byState[0] === opaque && byState[1] === masked && byState[2] === doubleSided);
}
mergedMeshes();
staticBatches();
staticExclusions();
dynamicBatches();
ordering();
checks.finish();
