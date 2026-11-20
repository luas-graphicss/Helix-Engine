import { addActionMap, addCustomControl, addCustomDevice, removeActionMap, removeControlScheme, renameActionMap, setCompositePartPath, updateAction, updateBinding, updatePlayerSettings } from '@/engine/input/actions/asset-edits';
import { countActions, countBindings, findActionByPath, findBinding } from '@/engine/input/actions/asset-queries';
import { MAX_DEADZONE } from '@/engine/input/actions/binding-limits';
import { createDefaultInputAsset, GAMEPAD_SCHEME, KEYBOARD_MOUSE_SCHEME } from '@/engine/input/actions/default-input-asset';
import { ALL_MAPS, MAX_LOCAL_PLAYERS } from '@/engine/input/actions/input-asset';
import { createActionMap } from '@/engine/input/actions/input-factories';
import { normalizeInputAsset } from '@/engine/input/actions/normalize-input-asset';
import { createCheckList } from '../support/check-list';
const checks = createCheckList('Mapas de ações');
const defaults = createDefaultInputAsset();
const move = findActionByPath(defaults, 'Gameplay/Move');
checks.check('ativo padrão traz Gameplay e UI', defaults.maps.map((map) => map.name).join(',') === 'Gameplay,UI');
checks.check('Move é um vetor com composto de teclas', move?.action.type === 'vector2' && move.action.bindings[0].composite === 'vector2');
checks.check('ação com nome único é achada sem o mapa', findActionByPath(defaults, 'Jump')?.map.name === 'Gameplay');
checks.check('ação inexistente não é achada', findActionByPath(defaults, 'Gameplay/Fly') === null);
checks.check('ativo padrão cobre os cinco esquemas', defaults.schemes.length === 5);
checks.check('texto sem mapas volta ao ativo padrão', countActions(normalizeInputAsset('quebrado')) === countActions(defaults));
checks.check('objeto sem lista de mapas volta ao ativo padrão', countActions(normalizeInputAsset({ maps: 'nenhum' })) === countActions(defaults));
checks.check('ativo padrão sobrevive a gravar e ler', JSON.stringify(normalizeInputAsset(JSON.parse(JSON.stringify(defaults)))) === JSON.stringify(defaults));
const hostile = normalizeInputAsset(JSON.parse(`{
    "__proto__": { "polluted": true },
    "schemes": [{ "id": "pad", "name": "Pad", "devices": [{ "layout": "Gamepad" }, { "layout": "<script>" }] }],
    "maps": [{
        "id": "dup", "name": "Play/Now",
        "actions": [
            { "id": "dup", "name": "Jump", "type": "button", "bindings": [
                { "id": "dup", "path": "not a path", "schemes": ["pad", "ghost"], "processors": { "deadzone": 9, "scale": -3 } },
                { "id": "combo", "composite": "vector2", "parts": [] }
            ] },
            { "name": "Jump", "type": "teleport", "bindings": "none" }
        ]
    }],
    "players": { "maxPlayers": 99, "joinMode": "telepathy", "defaultMap": "ghost" }
}`));
const hostileMap = hostile.maps[0];
const hostileJump = hostileMap.actions[0];
checks.check('chave __proto__ do arquivo não contamina objetos', ({} as Record<string, unknown>).polluted === undefined);
checks.check('nome perde o separador de caminho', hostileMap.name === 'PlayNow');
checks.check('ids repetidos são trocados por ids únicos', new Set([hostileMap.id, hostileJump.id, hostileJump.bindings[0].id]).size === 3);
checks.check('caminho inválido vira vínculo sem controle', hostileJump.bindings[0].path === '');
checks.check('esquema inexistente sai do vínculo', hostileJump.bindings[0].schemes.join(',') === 'pad');
checks.near('zona morta é limitada', hostileJump.bindings[0].processors.deadzone, MAX_DEADZONE);
checks.check('escala negativa é limitada ao mínimo', hostileJump.bindings[0].processors.scale > 0);
checks.check('composto não entra em ação de botão', hostileJump.bindings.length === 1);
checks.check('ações com o mesmo nome ganham sufixo', hostileMap.actions[1].name === 'Jump 2' && hostileMap.actions[1].type === 'button');
checks.check('layout de esquema inválido é limpo', hostile.schemes[0].devices.map((device) => device.layout).join(',') === 'Gamepad,script');
checks.check('configuração de jogadores é limitada', hostile.players.maxPlayers === MAX_LOCAL_PLAYERS && hostile.players.joinMode === 'manual' && hostile.players.defaultMap === ALL_MAPS);
const withMenu = addActionMap(defaults, createActionMap('UI'));
checks.check('mapa novo com nome repetido ganha sufixo', withMenu.maps[2].name === 'UI 2');
checks.check('renomear para o mesmo nome não muda o ativo', renameActionMap(defaults, 'ui', 'UI') === defaults);
checks.check('renomear para nome ocupado ganha sufixo', renameActionMap(defaults, 'ui', 'Gameplay').maps[1].name === 'Gameplay 2');
const moveAsAxis = updateAction(defaults, 'gameplay.move', { type: 'axis' });
checks.check('trocar o tipo descarta compostos incompatíveis', findActionByPath(moveAsAxis, 'Gameplay/Move')?.action.bindings.every((binding) => binding.composite === null) === true);
const rebound = setCompositePartPath(defaults, 'gameplay.move.wasd', 'up', '<Keyboard>/KeyI');
checks.check('parte do composto recebe o caminho novo', findBinding(rebound, 'gameplay.move.wasd')?.binding.parts[0].path === '<Keyboard>/KeyI');
checks.check('o ativo original não é alterado pela edição', findBinding(defaults, 'gameplay.move.wasd')?.binding.parts[0].path === '<Keyboard>/KeyW');
const clamped = updateBinding(defaults, 'gameplay.jump.keyboard', { interaction: { kind: 'hold', duration: 60 } });
checks.check('duração da interação é limitada', (findBinding(clamped, 'gameplay.jump.keyboard')?.binding.interaction.duration ?? 60) < 60);
const withoutGamepad = removeControlScheme(defaults, GAMEPAD_SCHEME);
checks.check('remover o esquema leva os vínculos exclusivos dele', findBinding(withoutGamepad, 'gameplay.jump.gamepad') === null && findBinding(withoutGamepad, 'gameplay.jump.keyboard') !== null);
checks.check('remover o esquema reduz a contagem de vínculos', countBindings(withoutGamepad) < countBindings(defaults));
checks.check('esquema restante segue intacto', withoutGamepad.schemes.some((scheme) => scheme.id === KEYBOARD_MOUSE_SCHEME));
const startInMenu = updatePlayerSettings(defaults, { defaultMap: 'ui', maxPlayers: 2.6 });
checks.check('configuração de jogadores arredonda e aceita mapa existente', startInMenu.players.defaultMap === 'ui' && startInMenu.players.maxPlayers === 3);
checks.check('remover o mapa inicial volta para todos os mapas', removeActionMap(startInMenu, 'ui').players.defaultMap === ALL_MAPS);
checks.check('layout nativo não pode ser dispositivo customizado', addCustomDevice(defaults, 'Keyboard') === defaults);
const withMat = addCustomControl(addCustomDevice(defaults, 'Dance <Mat>'), 'Dance Mat', { id: 'up arrow', kind: 'button' });
checks.check('dispositivo customizado limpa nome e controles', withMat.customDevices[0].name === 'Dance Mat' && withMat.customDevices[0].controls[0].id === 'uparrow');
checks.finish();
