import { Scene } from '@/engine/core/scene/scene';
import { cloneEntity } from '@/engine/core/scene/entity-utils';
import { readEntityTransform, writeEntityTransform } from '@/engine/net/scene/entity-transform';
import { createNetworkObjectSettings, createPlayerObjectSettings, normalizeNetworkObjectSettings, relevanceOf } from '@/engine/net/scene/network-object-settings';
import { planSceneNetwork, templateEntity } from '@/engine/net/scene/scene-network-plan';
import { createMultiplayerSettings, normalizeMultiplayerSettings } from '@/engine/net/settings/multiplayer-settings';
import { createTransformState } from '@/engine/net/sync/transform-state';
import { createCheckList } from '../support/check-list';
const checks = createCheckList('Cena em rede: componentes, plano e esquema');
const scene = new Scene();
const door = scene.createEntity({ name: 'Porta', kind: 'group', networkObject: { ...createNetworkObjectSettings(), transferable: true, variables: [{ name: 'open', initial: false, writer: 'server' }] } });
const hero = scene.createEntity({ name: 'Heroi', kind: 'group', networkObject: createPlayerObjectSettings() });
const bullet = scene.createEntity({ name: 'Projetil', kind: 'group', networkObject: { ...createNetworkObjectSettings(), spawn: 'template', relevance: 'distance', relevanceRadius: 25 } });
const scenery = scene.createEntity({ name: 'Cenario', kind: 'group' });
door.transform.position.set([1, 2, 3]);
door.transform.rotation.set([10, 40, -25]);
const plan = planSceneNetwork(scene);
checks.check('objeto da cena vira semente com o id do ator', plan.sceneObjects.length === 1 && plan.sceneObjects[0].sceneId === door.id && plan.sceneObjects[0].kind === String(door.id));
checks.check('a semente leva a pose e as variáveis do ator', plan.sceneObjects[0].transform?.position.join(',') === '1,2,3' && plan.sceneObjects[0].variables?.[0].name === 'open');
checks.check('personagem por jogador vira modelo do dono', plan.playerTemplates.length === 1 && plan.playerTemplates[0].kind === String(hero.id) && plan.playerTemplates[0].authority === 'owner' && plan.playerTemplates[0].observer === true);
checks.check('modelo sob demanda leva a relevância por distância', plan.spawnTemplates.length === 1 && plan.spawnTemplates[0].kind === String(bullet.id) && JSON.stringify(plan.spawnTemplates[0].relevance) === JSON.stringify({ mode: 'distance', radius: 25 }));
checks.check('só os objetos transferíveis aceitam pedido de posse', plan.transferableKinds.join(',') === String(door.id));
checks.check('o modelo é achado pelo tipo e atores comuns não', templateEntity(scene, String(hero.id)) === hero && templateEntity(scene, String(scenery.id)) === null && templateEntity(scene, 'x') === null);
door.transform.position.set([9, 9, 9]);
checks.check('mover um ator não muda o esquema', planSceneNetwork(scene).schema === plan.schema && plan.schema.length === 16);
door.networkObject?.variables.push({ name: 'locked', initial: true, writer: 'server' });
const changed = planSceneNetwork(scene).schema;
checks.check('mudar as variáveis muda o esquema', changed !== plan.schema);
hero.networkObject = { ...createPlayerObjectSettings(), authority: 'server' };
checks.check('mudar a autoridade muda o esquema', planSceneNetwork(scene).schema !== changed);
const state = readEntityTransform(door, createTransformState());
const mirror = scene.createEntity({ name: 'Espelho', kind: 'group' });
mirror.transform.rotation.set([8, 35, -20]);
writeEntityTransform(mirror, state, false);
checks.nearAll('a pose volta igual depois de passar pela rede', mirror.transform.rotation, [10, 40, -25], 1e-3);
checks.nearAll('a posição acompanha a pose', mirror.transform.position, [9, 9, 9]);
mirror.transform.scale.set([2, 2, 2]);
writeEntityTransform(mirror, state, false);
checks.nearAll('a escala só muda quando é sincronizada', mirror.transform.scale, [2, 2, 2]);
writeEntityTransform(mirror, state, true);
checks.nearAll('a escala sincronizada segue a origem', mirror.transform.scale, [1, 1, 1]);
const copy = cloneEntity(scene, door, scene.root);
checks.check('duplicar o ator copia o componente sem dividir as variáveis', copy.networkObject !== null && copy.networkObject !== door.networkObject && copy.networkObject.variables.length === 2 && copy.networkObject.variables[0] !== door.networkObject?.variables[0]);
const normalized = normalizeNetworkObjectSettings({
    ...createNetworkObjectSettings(),
    spawn: 'nowhere' as never,
    relevanceRadius: -5,
    maxSpeed: 1e9,
    variables: [
        { name: 'hp', initial: 100, writer: 'owner' },
        { name: 'hp', initial: 5, writer: 'server' },
        { name: 'bad name!', initial: 'x', writer: 'server' },
        { name: '!!!', initial: 1, writer: 'server' },
    ],
});
checks.check('valores fora da faixa voltam para dentro', normalized.spawn === 'scene' && normalized.relevanceRadius === 1 && normalized.maxSpeed === 1000);
checks.check('variáveis repetidas ou sem nome são descartadas', normalized.variables.map((variable) => variable.name).join(',') === 'hp,badname' && normalized.variables[0].writer === 'owner');
checks.check('relevância sem distância não leva raio', JSON.stringify(relevanceOf(normalized)) === JSON.stringify({ mode: 'always' }));
const settings = normalizeMultiplayerSettings({
    ...createMultiplayerSettings(),
    rpcs: [
        { name: 'fire', audience: 'others', requireOwnership: true, reliable: false, perSecond: 9999 },
        { name: 'fire', audience: 'all', requireOwnership: false, reliable: true, perSecond: 5 },
        { name: 'cha t!', audience: 'everyone' as never, requireOwnership: false, reliable: true, perSecond: 0 },
    ],
});
checks.check('RPCs declarados são únicos e têm limite válido', settings.rpcs.map((rpc) => `${rpc.name}:${rpc.audience}:${rpc.perSecond}`).join('|') === 'fire:others:240|chat:others:1');
checks.finish();
