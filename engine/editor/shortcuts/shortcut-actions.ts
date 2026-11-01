export type ShortcutScope = 'editor' | 'gui' | 'code' | 'animation' | 'audio' | 'vfx';
export const SHORTCUT_SCOPE_LABELS: Record<ShortcutScope, string> = {
    editor: 'Editor',
    gui: 'Interface',
    code: 'Código',
    animation: 'Animação',
    audio: 'Áudio',
    vfx: 'Efeitos',
};
export interface ShortcutActionDefinition {
    readonly id: string;
    readonly label: string;
    readonly defaults: readonly string[];
    readonly hint?: string;
}
export interface ShortcutAction extends ShortcutActionDefinition {
    readonly scope: ShortcutScope;
}
export interface ShortcutActionGroup {
    readonly title: string;
    readonly scope: ShortcutScope;
    readonly actions: readonly ShortcutActionDefinition[];
}
function action<const Id extends string>(id: Id, label: string, defaults: readonly string[], hint?: string) {
    return hint === undefined ? ({ id, label, defaults } as const) : ({ id, label, defaults, hint } as const);
}
export const SHORTCUT_ACTION_GROUPS = [
    {
        title: 'Helix',
        scope: 'editor',
        actions: [
            action('helix.newProject', 'Novo jogo', ['ctrl alt n'], 'Guarda o jogo atual e abre um template novo'),
            action('helix.closeProject', 'Fechar jogo', ['ctrl alt w'], 'Volta à tela inicial'),
            action('helix.download', 'Baixar cópia do jogo', ['ctrl shift s']),
            action('helix.build', 'Compilar jogo para computador', ['ctrl shift d'], 'Executável para Windows, macOS ou Linux'),
            action('helix.autosaves', 'Abrir salvamentos automáticos', ['ctrl alt h']),
            action('helix.shortcuts', 'Personalizar atalhos', ['ctrl alt k']),
            action('helix.settings', 'Configuração da Helix Engine', ['ctrl ,']),
            action('helix.beta', 'Funcionalidades beta', []),
            action('helix.about', 'Sobre a Helix Engine', []),
            action('helix.exit', 'Sair', []),
        ],
    },
    {
        title: 'Arquivo',
        scope: 'editor',
        actions: [
            action('file.save', 'Salvar agora', ['ctrl s'], 'A cena também é salva sozinha após cada pausa'),
            action('file.import', 'Importar modelo', ['ctrl i'], 'glTF, GLB, OBJ, STL, FBX'),
            action('file.addToLibrary', 'Adicionar arquivos à biblioteca', ['ctrl b']),
        ],
    },
    {
        title: 'Edição',
        scope: 'editor',
        actions: [
            action('edit.undo', 'Desfazer', ['ctrl z']),
            action('edit.redo', 'Refazer', ['ctrl shift z', 'ctrl y']),
            action('edit.duplicate', 'Duplicar', ['ctrl d']),
            action('edit.copy', 'Copiar', ['ctrl c']),
            action('edit.paste', 'Colar', ['ctrl v']),
            action('edit.group', 'Agrupar', ['ctrl g']),
            action('edit.ungroup', 'Desagrupar', ['ctrl shift g']),
            action('edit.selectAll', 'Selecionar tudo', ['ctrl a']),
            action('edit.newFolder', 'Nova pasta', ['alt n']),
            action('edit.rename', 'Renomear', ['f2']),
            action('edit.delete', 'Excluir', ['delete', 'backspace'], 'Com o editor de animação aberto, apaga chaves'),
        ],
    },
    {
        title: 'Seleção',
        scope: 'editor',
        actions: [
            action('selection.clear', 'Limpar seleção', ['escape']),
            action('selection.focus', 'Enquadrar a seleção', ['f']),
            action('selection.toggleVisibility', 'Ocultar / mostrar a seleção', ['h']),
            action('selection.isolate', 'Isolar a seleção', ['shift h'], 'Oculta o resto'),
            action('selection.showAll', 'Mostrar todos os ocultos', ['alt h']),
            action('selection.toggleLock', 'Bloquear / desbloquear a seleção', ['l'], 'Bloqueados não são selecionáveis no viewport'),
            action('selection.unlockAll', 'Desbloquear todos', ['alt l']),
        ],
    },
    {
        title: 'Ferramentas',
        scope: 'editor',
        actions: [
            action('tool.select', 'Selecionar', ['q']),
            action('tool.translate', 'Mover', ['w']),
            action('tool.rotate', 'Rotacionar', ['e']),
            action('tool.scale', 'Escalar', ['r']),
            action('tool.terrain', 'Terreno', ['t'], 'Esculpir e pintar'),
        ],
    },
    {
        title: 'Terreno',
        scope: 'editor',
        actions: [
            action('terrain.tool.raise', 'Elevar', ['1'], 'Com a ferramenta Terreno ativa'),
            action('terrain.tool.smooth', 'Suavizar', ['2'], 'Com a ferramenta Terreno ativa'),
            action('terrain.tool.flatten', 'Achatar', ['3'], 'Com a ferramenta Terreno ativa'),
            action('terrain.tool.noise', 'Ruído', ['4'], 'Com a ferramenta Terreno ativa'),
            action('terrain.tool.terrace', 'Terraço', ['5'], 'Com a ferramenta Terreno ativa'),
            action('terrain.tool.erode', 'Erosão', ['6'], 'Com a ferramenta Terreno ativa'),
            action('terrain.tool.paint', 'Pintar', ['7'], 'Com a ferramenta Terreno ativa'),
            action('terrain.tool.grass', 'Grama', ['8'], 'Com a ferramenta Terreno ativa'),
            action('terrain.sampleHeight', 'Copiar a altura sob o cursor para o Achatar', ['c'], 'Com a ferramenta Terreno ativa'),
            action('terrain.brushSmaller', 'Diminuir o raio do pincel', ['[', 'shift ['], 'Shift: divide ao meio'),
            action('terrain.brushLarger', 'Aumentar o raio do pincel', [']', 'shift ]'], 'Shift: dobra'),
        ],
    },
    {
        title: 'Exibir',
        scope: 'editor',
        actions: [
            action('view.toggleGrid', 'Alternar a grade', ['g']),
            action('view.perfHud', 'Mostrar / esconder o HUD de orçamento do frame', ['f3'], 'CPU por faixa, GPU por etapa, governador e pendências'),
            action('view.materialEditor', 'Abrir o editor de materiais', ['m']),
            action('view.code', 'Abrir / fechar o editor de código', ['ctrl alt c'], 'Vale em qualquer área de trabalho'),
        ],
    },
    {
        title: 'CSG',
        scope: 'editor',
        actions: [
            action('csg.addBoxBrush', 'Pincel de subtração em caixa', ['b'], 'No ator selecionado'),
            action('csg.addCylinderBrush', 'Pincel de subtração em cilindro', ['shift b'], 'No ator selecionado'),
            action('csg.subtract', 'Subtrair os demais selecionados do principal', ['ctrl alt s']),
            action('csg.union', 'Unir os demais selecionados ao principal', ['ctrl alt u']),
            action('csg.intersect', 'Interseção do principal com os demais', ['ctrl alt i']),
            action('csg.consolidate', 'Consolidar o alvo CSG selecionado', ['ctrl alt b'], 'Fixa o resultado'),
            action('csg.toggleBrushes', 'Ativar / desativar os pincéis selecionados', ['ctrl alt e']),
            action('csg.brushUp', 'Subir o pincel na ordem das operações', ['ctrl alt arrowup']),
            action('csg.brushDown', 'Descer o pincel na ordem das operações', ['ctrl alt arrowdown']),
        ],
    },
    {
        title: 'Simulação',
        scope: 'editor',
        actions: [action('simulation.playPause', 'Simular / pausar a física', ['ctrl p']), action('simulation.stop', 'Parar e restaurar a cena', ['ctrl shift p'])],
    },
    {
        title: 'Painéis',
        scope: 'editor',
        actions: [
            action('panel.hierarchy', 'Abrir / fechar a Hierarquia', ['ctrl shift e'], 'Camadas, na Interface'),
            action('panel.assets', 'Abrir / fechar os Ativos', ['ctrl shift a']),
            action('panel.animation', 'Abrir / fechar a Animação', ['ctrl shift t']),
            action('panel.audio', 'Abrir / fechar o Áudio', ['ctrl shift u']),
            action('panel.vfx', 'Abrir / fechar os Efeitos', ['ctrl shift x']),
            action('panel.lights', 'Abrir / fechar as Luzes', ['ctrl shift l']),
            action('panel.interface', 'Abrir / fechar a paleta Interface', ['ctrl shift f']),
            action('panel.scripts', 'Abrir / fechar os Scripts', ['ctrl shift y']),
            action('panel.console', 'Abrir / fechar o Console', ['ctrl `']),
            action('panel.maximize', 'Maximizar o viewport / restaurar os painéis', ['ctrl shift space']),
        ],
    },
    {
        title: 'Ajuda',
        scope: 'editor',
        actions: [action('help.documentation', 'Abrir a documentação', ['f1'], 'Numa aba nova, ao lado do editor'), action('help.tutorial', 'Abrir os tutoriais', ['shift f1'], 'Numa aba nova, ao lado do editor')],
    },
    {
        title: 'Interface: ferramentas',
        scope: 'gui',
        actions: [
            action('gui.tool.select', 'Selecionar', ['v']),
            action('gui.tool.hand', 'Mão', ['h'], 'Arrastar a vista'),
            action('gui.tool.frame', 'Quadro', ['f']),
            action('gui.tool.text', 'Texto', ['t']),
            action('gui.tool.image', 'Imagem', ['i']),
            action('gui.tool.icon', 'Ícone', ['o']),
            action('gui.tool.button', 'Botão', ['b']),
            action('gui.element.toggle', 'Alternador', ['shift k']),
            action('gui.element.slider', 'Controle deslizante', ['shift s']),
            action('gui.element.progress', 'Progresso', ['shift p']),
            action('gui.element.input', 'Campo de texto', ['shift i']),
            action('gui.element.scroll', 'Área rolável', ['shift c']),
            action('gui.element.divider', 'Divisor', ['shift d']),
            action('gui.element.video', 'Vídeo', ['shift v']),
            action('gui.element.viewport', 'Visão', ['shift w']),
        ],
    },
    {
        title: 'Interface: edição',
        scope: 'gui',
        actions: [
            action('gui.save', 'Salvar a tela na biblioteca', ['ctrl s']),
            action('gui.duplicate', 'Duplicar', ['ctrl d']),
            action('gui.copy', 'Copiar', ['ctrl c']),
            action('gui.cut', 'Recortar', ['ctrl x']),
            action('gui.paste', 'Colar', ['ctrl v']),
            action('gui.selectAll', 'Selecionar tudo', ['ctrl a']),
            action('gui.group', 'Agrupar em quadro', ['ctrl g']),
            action('gui.ungroup', 'Desagrupar', ['ctrl shift g']),
            action('gui.bringForward', 'Avançar na ordem', ['ctrl ]']),
            action('gui.bringToFront', 'Trazer para a frente', ['ctrl shift ]']),
            action('gui.sendBackward', 'Recuar na ordem', ['ctrl [']),
            action('gui.sendToBack', 'Enviar para trás', ['ctrl shift [']),
            action('gui.alignLeft', 'Alinhar à esquerda', ['alt a']),
            action('gui.alignHCenter', 'Alinhar ao centro', ['alt h']),
            action('gui.alignRight', 'Alinhar à direita', ['alt d']),
            action('gui.alignTop', 'Alinhar ao topo', ['alt w']),
            action('gui.alignVCenter', 'Alinhar ao meio', ['alt v']),
            action('gui.alignBottom', 'Alinhar à base', ['alt s']),
            action('gui.distributeH', 'Distribuir na horizontal', ['alt shift h']),
            action('gui.distributeV', 'Distribuir na vertical', ['alt shift v']),
            action('gui.nudgeLeft', 'Mover 1 px para a esquerda', ['arrowleft', 'shift arrowleft'], 'Shift: 10 px'),
            action('gui.nudgeRight', 'Mover 1 px para a direita', ['arrowright', 'shift arrowright'], 'Shift: 10 px'),
            action('gui.nudgeUp', 'Mover 1 px para cima', ['arrowup', 'shift arrowup'], 'Shift: 10 px'),
            action('gui.nudgeDown', 'Mover 1 px para baixo', ['arrowdown', 'shift arrowdown'], 'Shift: 10 px'),
            action('gui.enter', 'Editar o texto ou entrar nos filhos', ['enter']),
            action('gui.selectParent', 'Selecionar o pai', ['shift enter']),
            action('gui.rename', 'Renomear o elemento', ['f2']),
            action('gui.toggleVisibility', 'Ocultar / mostrar a seleção', ['shift h']),
            action('gui.toggleLock', 'Bloquear / desbloquear a seleção', ['shift l']),
            action('gui.delete', 'Excluir a seleção', ['delete', 'backspace']),
            action('gui.escape', 'Sair do texto, voltar à seleção, limpar a seleção ou sair do teste', ['escape']),
        ],
    },
    {
        title: 'Interface: vista e teste',
        scope: 'gui',
        actions: [
            action('gui.togglePreview', 'Alternar entre Design e Testar', ['ctrl enter']),
            action('gui.zoomIn', 'Aproximar', ['ctrl =']),
            action('gui.zoomOut', 'Afastar', ['ctrl -']),
            action('gui.zoomReset', 'Zoom 100 %', ['ctrl 0', 'shift 0']),
            action('gui.fitAll', 'Enquadrar a tela', ['shift 1']),
            action('gui.fitSelection', 'Enquadrar a seleção', ['shift 2']),
            action('gui.toggleGrid', 'Grade', ["ctrl '"]),
            action('gui.toggleSnapGrid', 'Encaixar na grade', ["ctrl shift '"]),
            action('gui.toggleRulers', 'Réguas', ['shift r']),
            action('gui.toggleOutlines', 'Contorno de todos os elementos', ['shift o']),
            action('gui.toggleSafeArea', 'Área segura do aparelho', ['shift a']),
        ],
    },
    {
        title: 'Interface: aparelho emulado',
        scope: 'gui',
        actions: [
            action('gui.rotateDevice', 'Girar o aparelho', ['alt r'], 'Alterna entre retrato e paisagem'),
            action('gui.toggleDeviceFrame', 'Moldura do aparelho', ['alt m'], 'Corpo, cantos, recorte e indicadores'),
            action('gui.zoomDevicePixels', 'Zoom nos pixels do aparelho', [], 'Um pixel do aparelho por pixel do monitor'),
            action('gui.zoomPhysicalSize', 'Zoom no tamanho real', [], 'A tela com as dimensões físicas do aparelho'),
        ],
    },
    {
        title: 'Código',
        scope: 'code',
        actions: [
            action('code.newScript', 'Novo script', ['alt n'], 'Na linguagem base do jogo'),
            action('code.save', 'Salvar o script', ['ctrl s'], 'Dentro do texto a mesma tecla vale'),
            action('code.saveAll', 'Salvar todos os scripts', ['ctrl alt s']),
            action('code.closeTab', 'Fechar a aba', ['alt w']),
            action('code.run', 'Executar o script', ['ctrl enter', 'f5'], 'Salva antes, se houver alterações'),
            action('code.compile', 'Compilar o projeto', ['ctrl shift b']),
            action('code.find', 'Buscar no script', ['ctrl f']),
            action('code.replace', 'Buscar e substituir', ['ctrl h']),
            action('code.nextTab', 'Aba seguinte', ['ctrl pagedown']),
            action('code.previousTab', 'Aba anterior', ['ctrl pageup']),
            action('code.focusCommandBar', 'Ir à barra de comando', ['ctrl k']),
            action('code.toggleCommandBar', 'Mostrar / ocultar a barra de comando', ['ctrl shift k']),
            action('code.escape', 'Fechar a busca ou voltar à cena', ['escape']),
        ],
    },
    {
        title: 'Animação',
        scope: 'animation',
        actions: [
            action('animation.togglePlay', 'Reproduzir / pausar', ['space']),
            action('animation.stepBack', 'Quadro anterior', ['arrowleft', 'shift arrowleft'], 'Shift: 10 quadros'),
            action('animation.stepForward', 'Quadro seguinte', ['arrowright', 'shift arrowright'], 'Shift: 10 quadros'),
            action('animation.goToStart', 'Início do clipe', ['home']),
            action('animation.goToEnd', 'Fim do clipe', ['end']),
            action('animation.previousKey', 'Chave anterior', [',']),
            action('animation.nextKey', 'Chave seguinte', ['.']),
            action('animation.keySelected', 'Inserir chave nos ossos selecionados', ['k']),
            action('animation.keyAll', 'Inserir chave em todos os ossos', ['shift k']),
            action('animation.copyKeys', 'Copiar chaves', ['ctrl c']),
            action('animation.pasteKeys', 'Colar chaves no quadro atual', ['ctrl v']),
            action('animation.selectAllKeys', 'Selecionar todas as chaves', ['ctrl a']),
            action('animation.deleteKeys', 'Excluir as chaves selecionadas', ['delete', 'backspace']),
            action('animation.save', 'Salvar na biblioteca', ['ctrl s']),
            action('animation.escape', 'Limpar a seleção de chaves', ['escape']),
        ],
    },
    {
        title: 'Áudio',
        scope: 'audio',
        actions: [
            action('audio.togglePlay', 'Reproduzir / pausar', ['space']),
            action('audio.stepBack', 'Recuar 0,1 s', ['arrowleft', 'shift arrowleft'], 'Shift: 1 s'),
            action('audio.stepForward', 'Avançar 0,1 s', ['arrowright', 'shift arrowright'], 'Shift: 1 s'),
            action('audio.goToStart', 'Início do recorte', ['home']),
            action('audio.goToEnd', 'Fim do recorte', ['end']),
            action('audio.trimStart', 'Início do recorte no cursor', ['[']),
            action('audio.trimEnd', 'Fim do recorte no cursor', [']']),
            action('audio.bypass', 'Ouvir o original (A/B)', ['b']),
            action('audio.zoomIn', 'Aproximar a forma de onda', ['=', 'shift =', '+']),
            action('audio.zoomOut', 'Afastar a forma de onda', ['-']),
            action('audio.zoomAll', 'Ver o arquivo inteiro', ['0']),
        ],
    },
    {
        title: 'Efeitos',
        scope: 'vfx',
        actions: [
            action('vfx.togglePlay', 'Tocar / congelar o efeito', ['space']),
            action('vfx.stepBack', 'Recuar um quadro', ['arrowleft', 'shift arrowleft'], 'Shift: 10 quadros'),
            action('vfx.stepForward', 'Avançar um quadro', ['arrowright', 'shift arrowright'], 'Shift: 10 quadros'),
            action('vfx.goToStart', 'Início do ciclo', ['home']),
            action('vfx.goToEnd', 'Fim do ciclo', ['end']),
            action('vfx.duplicate', 'Duplicar o emissor ou módulo', ['ctrl d']),
            action('vfx.moveUp', 'Subir na pilha', ['alt arrowup']),
            action('vfx.moveDown', 'Descer na pilha', ['alt arrowdown']),
            action('vfx.delete', 'Remover o emissor ou módulo', ['delete', 'backspace']),
            action('vfx.save', 'Salvar o efeito na biblioteca', ['ctrl s']),
            action('vfx.escape', 'Voltar do módulo ao emissor, do emissor ao efeito', ['escape']),
        ],
    },
] as const satisfies readonly ShortcutActionGroup[];
export type ShortcutActionId = (typeof SHORTCUT_ACTION_GROUPS)[number]['actions'][number]['id'];
export const SHORTCUT_ACTIONS: readonly ShortcutAction[] = SHORTCUT_ACTION_GROUPS.flatMap((group) => group.actions.map((definition) => ({ ...definition, scope: group.scope })));
const ACTIONS_BY_ID = new Map<string, ShortcutAction>(SHORTCUT_ACTIONS.map((entry) => [entry.id, entry]));
export function shortcutAction(id: ShortcutActionId): ShortcutAction {
    const found = ACTIONS_BY_ID.get(id);
    if (!found)
        throw new Error(`Ação de atalho desconhecida: ${id}`);
    return found;
}
export function isShortcutActionId(value: unknown): value is ShortcutActionId {
    return typeof value === 'string' && ACTIONS_BY_ID.has(value);
}
