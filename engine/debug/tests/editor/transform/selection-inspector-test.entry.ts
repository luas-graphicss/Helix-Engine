import { Scene } from '@/engine/core/scene/scene';
import { History } from '@/engine/editor/history/history';
import { editableTransformRoots, selectionEditBlock, setSelectionTransformAxis, sharedTransformAxes } from '@/engine/editor/operations/selection-transform-operations';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { createCheckList } from '../../support/check-list';

const checks = createCheckList('Transformação de vários atores no inspetor');
const scene = new Scene();
const group = scene.createEntity({ name: 'Grupo', kind: 'group' });
const child = scene.createEntity({ name: 'Filho', kind: 'mesh' }, group);
const camera = scene.createEntity({ name: 'Câmera', kind: 'camera' });
const locked = scene.createEntity({ name: 'Bloqueado', kind: 'mesh' });
const script = scene.createEntity({ name: 'Script', kind: 'script' });
locked.locked = true;
group.transform.position.set([1, 2, 3]);
camera.transform.position.set([4, 2, 6]);
child.transform.position[0] = 5;
let roots = [group, camera, locked, script];
const interceptors: EditorSession['transformInterceptors'] = new Set();
const session = {
    history: new History(() => {}),
    selectedIds: new Set([...roots, child].map((entity) => entity.id)),
    selectionRoots: () => roots,
    transformInterceptors: interceptors,
    playtest: { isRunning: false },
};
const targets = editableTransformRoots(session);
checks.check('só raízes transformáveis entram na edição', targets.length === 2 && targets[0] === group && targets[1] === camera);
const mixed = sharedTransformAxes(targets, 'position');
checks.check('cada eixo distingue valores iguais e mistos', mixed[0] === null && mixed[1] === 2 && mixed[2] === null);
checks.check('uma seleção vazia não inventa coordenadas', sharedTransformAxes([], 'position').every((value) => value === null));
setSelectionTransformAxis(session, targets, 'position', 0, 7.5);
checks.nearAll('altera só X do grupo', group.transform.position, [7.5, 2, 3]);
checks.nearAll('altera só X da câmera', camera.transform.position, [7.5, 2, 6]);
checks.nearAll('outros atores mantêm as coordenadas locais', [child, locked, script].map((entity) => entity.transform.position[0]), [5, 0, 0]);
checks.check('um único comando altera os dois atores', session.history.undoDepth === 1);
session.history.undo();
checks.nearAll('desfazer recupera valores distintos em uma etapa', [group.transform.position[0], camera.transform.position[0]], [1, 4]);
session.history.redo();
checks.nearAll('refazer reaplica a edição conjunta', [group.transform.position[0], camera.transform.position[0]], [7.5, 7.5]);
checks.check('o eixo misto passa a ser comum', sharedTransformAxes(targets, 'position')[0] === 7.5);
for (const value of [7.5, NaN, Infinity, 1e90])
    setSelectionTransformAxis(session, targets, 'position', 0, value);
checks.check('valor igual, inválido ou fora de Float32 não cria histórico', session.history.undoDepth === 1 && group.transform.position[0] === 7.5);
setSelectionTransformAxis(session, targets, 'rotation', 2, -45);
setSelectionTransformAxis(session, targets, 'scale', 1, 0.125);
checks.nearAll('rotação e escala não alteram os outros eixos', group.transform.rotation, [0, 0, -45]);
checks.nearAll('a escala fracionária vale para os dois atores', [group.transform.scale[1], camera.transform.scale[1]], [0.125, 0.125]);
const depth = session.history.undoDepth;
camera.locked = true;
setSelectionTransformAxis(session, targets, 'position', 0, 99);
checks.check('um bloqueio posterior invalida a edição em andamento', session.history.undoDepth === depth);
camera.locked = false;
roots = [camera, locked];
setSelectionTransformAxis(session, targets, 'position', 0, 99);
checks.check('uma seleção trocada não recebe o texto da seleção antiga', session.history.undoDepth === depth);
roots = [group, camera];
session.playtest.isRunning = true;
setSelectionTransformAxis(session, targets, 'position', 0, 99);
checks.check('a simulação não recebe edições de cena', selectionEditBlock(session) === 'playtest' && session.history.undoDepth === depth);
session.playtest.isRunning = false;
interceptors.add(() => true);
setSelectionTransformAxis(session, targets, 'rotation', 2, 90);
checks.check('a edição conjunta não contorna a captura da animação', selectionEditBlock(session) === 'animation' && session.history.undoDepth === depth);
checks.finish();
