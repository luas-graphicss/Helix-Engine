import { booleanSetting, numberSetting, selectSetting, textSetting, type SelectOption } from './setting-definitions';
const RENDER_BUDGET_OPTIONS = [
    { value: 'auto', label: 'Automático', hint: 'Pelo perfil de qualidade' },
    { value: 'low', label: 'Baixo' },
    { value: 'mid', label: 'Médio' },
    { value: 'high', label: 'Alto' },
] as const satisfies readonly SelectOption<string>[];
export const UI_SCALE_BASE_PX = 14.5;
export type UiScaleValue = '80' | '90' | '100' | '110' | '120' | '135' | '150';
export const UI_SCALE_OPTIONS: readonly SelectOption<UiScaleValue>[] = [
    { value: '80', label: '80%', hint: 'Telas 4K ou escala do sistema alta' },
    { value: '90', label: '90%' },
    { value: '100', label: '100%', hint: 'Densidade de ferramenta de desktop' },
    { value: '110', label: '110%' },
    { value: '120', label: '120%' },
    { value: '135', label: '135%', hint: 'Telas pequenas ou vistas de longe' },
    { value: '150', label: '150%' },
];
export function uiScaleRootFontPx(scale: string): number {
    const percent = Number(scale);
    return Number.isFinite(percent) && percent > 0 ? (UI_SCALE_BASE_PX * percent) / 100 : UI_SCALE_BASE_PX;
}
export const ENGINE_SETTINGS = {
    'editor.camera.orbitSpeed': numberSetting({
        label: 'Velocidade de órbita',
        description: 'Quanto a câmera gira por pixel arrastado com o botão direito ou do meio.',
        default: 1,
        min: 0.2,
        max: 3,
        step: 0.1,
        unit: '×',
    }),
    'editor.camera.panSpeed': numberSetting({
        label: 'Velocidade de movimento',
        description: 'Quanto a câmera se desloca ao panoramizar (Shift+arrastar ou botão do meio).',
        default: 1,
        min: 0.2,
        max: 3,
        step: 0.1,
        unit: '×',
    }),
    'editor.camera.zoomSpeed': numberSetting({
        label: 'Velocidade de rolagem',
        description: 'Quanto a câmera aproxima ou afasta por passo da roda do mouse.',
        default: 1,
        min: 0.2,
        max: 3,
        step: 0.1,
        unit: '×',
    }),
    'editor.camera.invertZoom': booleanSetting({
        label: 'Inverter a rolagem',
        description: 'Rolar para cima afasta a câmera em vez de aproximar.',
        default: false,
    }),
    'editor.camera.invertOrbitY': booleanSetting({
        label: 'Inverter o eixo vertical da órbita',
        description: 'Arrastar para cima inclina a câmera para baixo, como em simuladores de voo.',
        default: false,
    }),
    'editor.camera.fov': numberSetting({
        label: 'Campo de visão',
        description: 'Abertura vertical da câmera do editor. Valores altos mostram mais cena com perspectiva mais forte; a câmera do jogo tem o seu próprio valor.',
        default: 60,
        min: 35,
        max: 110,
        step: 1,
        unit: '°',
    }),
    'editor.gizmo.size': numberSetting({
        label: 'Tamanho do gizmo',
        description: 'Escala das alças de mover, rotacionar e escalar em relação à tela.',
        default: 1,
        min: 0.5,
        max: 2,
        step: 0.1,
        unit: '×',
    }),
    'editor.open.tool': selectSetting({
        label: 'Ferramenta inicial',
        description: 'Ferramenta do viewport ativa ao abrir um jogo.',
        default: 'select',
        options: [
            { value: 'select', label: 'Selecionar' },
            { value: 'translate', label: 'Mover' },
            { value: 'rotate', label: 'Rotacionar' },
            { value: 'scale', label: 'Escalar' },
        ],
    }),
    'editor.open.space': selectSetting({
        label: 'Espaço de transformação inicial',
        description: 'Se o gizmo começa alinhado ao mundo ou ao ator selecionado.',
        default: 'global',
        options: [
            { value: 'global', label: 'Global' },
            { value: 'local', label: 'Local' },
        ],
    }),
    'editor.open.grid': booleanSetting({
        label: 'Grade do editor ao abrir',
        description: 'Mostra a grade complementar do viewport assim que o jogo abre (G alterna depois).',
        default: false,
    }),
    'editor.open.shadows': booleanSetting({
        label: 'Sombras ao abrir',
        description: 'Começa com as sombras do viewport ligadas.',
        default: true,
    }),
    'editor.open.perfHud': booleanSetting({
        label: 'HUD de desempenho ao abrir',
        description: 'O painel de orçamento do frame (F3) já aparece sobre o viewport: CPU, etapas de GPU, degrau de qualidade e classe da placa.',
        default: false,
    }),
    'editor.ui.scale': selectSetting({
        label: 'Tamanho da interface',
        description: 'Escala de textos, controles e painéis da engine inteira, inclusive a tela inicial. 100% é a densidade de uma ferramenta de desktop; reduza em telas grandes ou com a escala do sistema acima de 125%.',
        default: '100',
        options: UI_SCALE_OPTIONS,
    }),
    'editor.ui.statusBar': booleanSetting({
        label: 'Exibir barra de diagnóstico',
        description: 'A barra inferior com o último evento, o salvamento, a hora do céu, a simulação e os quadros por segundo.',
        default: true,
    }),
    'editor.ui.menuShortcuts': booleanSetting({
        label: 'Mostrar atalhos nos menus',
        description: 'Exibe a combinação de teclas em vigor ao lado de cada item de menu.',
        default: true,
    }),
    'editor.ui.reduceMotion': booleanSetting({
        label: 'Reduzir animações da interface',
        description: 'Remove transições e animações dos painéis, menus e diálogos.',
        default: false,
    }),
    'editor.hierarchy.kindLabels': booleanSetting({
        label: 'Mostrar o tipo dos atores na Hierarquia',
        description: 'A coluna à direita de cada linha (Malha, Luz, Pasta…). Desligada, sobra mais espaço para os nomes.',
        default: true,
    }),
    'editor.console.order': selectSetting({
        label: 'Organização da saída',
        description: 'Ordem em que as mensagens do console são listadas.',
        default: 'oldest-first',
        options: [
            { value: 'oldest-first', label: 'Cronológica (mais recente embaixo)' },
            { value: 'newest-first', label: 'Mais recente primeiro' },
        ],
    }),
    'editor.console.limit': numberSetting({
        label: 'Mensagens retidas',
        description: 'Quantas mensagens o console guarda antes de descartar as mais antigas.',
        default: 500,
        min: 100,
        max: 5000,
        step: 100,
    }),
    'editor.console.revealOnError': booleanSetting({
        label: 'Abrir o console ao registrar um erro',
        description: 'Traz o painel Console para a frente sempre que um subsistema reporta um erro.',
        default: false,
    }),
    'editor.import.placement': selectSetting({
        label: 'Pivô das partes importadas',
        description: 'Onde a raiz de um modelo importado é colocada na cena.',
        default: 'target',
        options: [
            { value: 'target', label: 'No alvo da câmera', hint: 'Ou no ponto em que o arquivo foi solto no viewport' },
            { value: 'origin', label: 'Na origem do mundo' },
            { value: 'keep', label: 'Como está no arquivo' },
        ],
    }),
    'editor.import.frameAfterImport': booleanSetting({
        label: 'Enquadrar depois de importar',
        description: 'A câmera enquadra o modelo recém-importado.',
        default: true,
    }),
    'editor.import.saveToLibrary': booleanSetting({
        label: 'Guardar os arquivos na biblioteca',
        description: 'Os arquivos de origem entram na biblioteca de ativos do projeto ao importar.',
        default: true,
    }),
    'editor.import.convertUnits': booleanSetting({
        label: 'Converter unidades do arquivo',
        description: 'Aplica a escala de unidades declarada no arquivo (FBX em centímetros vira metros).',
        default: true,
    }),
    'project.autosave.enabled': booleanSetting({
        label: 'Recuperação automática',
        description: 'Grava a cena no banco do projeto depois de cada pausa na edição. Desligada, só Salvar (Ctrl+S) e sair do jogo gravam.',
        default: true,
    }),
    'project.autosave.delay': numberSetting({
        label: 'Pausa antes de gravar',
        description: 'Tempo sem edições que a engine espera antes de salvar; arrastar um objeto gera dezenas de comandos e uma só gravação.',
        default: 1.5,
        min: 0.5,
        max: 10,
        step: 0.5,
        unit: ' s',
    }),
    'project.autosave.maxWait': numberSetting({
        label: 'Espera máxima em edição contínua',
        description: 'Mesmo sem pausa, uma gravação acontece ao menos a cada tanto tempo.',
        default: 20,
        min: 5,
        max: 120,
        step: 5,
        unit: ' s',
    }),
    'project.snapshots.interval': numberSetting({
        label: 'Intervalo entre instantâneos',
        description: 'Idade mínima que a versão gravada precisa ter para virar um salvamento automático restaurável.',
        default: 10,
        min: 1,
        max: 60,
        step: 1,
        unit: ' min',
    }),
    'project.snapshots.max': numberSetting({
        label: 'Instantâneos guardados por jogo',
        description: 'Além deste número, os salvamentos automáticos mais antigos são descartados.',
        default: 12,
        min: 3,
        max: 50,
        step: 1,
    }),
    'project.thumbnail.enabled': booleanSetting({
        label: 'Atualizar a miniatura ao salvar',
        description: 'O último quadro do viewport vira a capa do jogo na tela inicial e no menu Recentes. Desligada, a capa fica como está.',
        default: true,
    }),
    'project.new.template': selectSetting({
        label: 'Template de "Novo"',
        description: 'O que o jogo criado pelo menu Helix ▸ Novo traz ao abrir.',
        default: 'empty',
        options: [
            { value: 'empty', label: 'Vazio', hint: 'Só céu, luzes e câmera' },
            { value: 'baseplate', label: 'Baseplate', hint: 'Plataforma, objetos de referência e manequim' },
            { value: 'terrain', label: 'Terreno', hint: 'Relevo gerado e pintado' },
        ],
    }),
    'selection.focusPadding': numberSetting({
        label: 'Folga ao enquadrar',
        description: 'Quanto a câmera recua além do necessário ao enquadrar a seleção (F).',
        default: 1.1,
        min: 1,
        max: 3,
        step: 0.05,
        unit: '×',
    }),
    'snap.enabled': booleanSetting({
        label: 'Alinhar à grade ao abrir',
        description: 'O encaixe de transformação começa ligado (Ctrl durante o arrasto inverte).',
        default: false,
    }),
    'snap.translate': numberSetting({
        label: 'Passo de translação',
        description: 'Incremento do encaixe ao mover, em metros.',
        default: 0.5,
        min: 0.05,
        max: 5,
        step: 0.05,
        unit: ' m',
    }),
    'snap.rotate': numberSetting({
        label: 'Passo de rotação',
        description: 'Incremento do encaixe ao rotacionar, em graus.',
        default: 15,
        min: 1,
        max: 90,
        step: 1,
        unit: '°',
    }),
    'snap.scale': numberSetting({
        label: 'Passo de escala',
        description: 'Incremento do encaixe ao escalar, como fator.',
        default: 0.1,
        min: 0.01,
        max: 1,
        step: 0.01,
        unit: '×',
    }),
    'gui.snapGuides': booleanSetting({
        label: 'Mostrar alvo de encaixe',
        description: 'Guias que aparecem quando um elemento se alinha a outro ao arrastar na área de trabalho Interface.',
        default: true,
    }),
    'gui.grid': booleanSetting({
        label: 'Grade da tela',
        description: 'Desenha a grade de pixels de referência sobre a tela em edição.',
        default: false,
    }),
    'gui.gridSize': numberSetting({
        label: 'Tamanho da grade',
        description: 'Espaçamento da grade da tela, em pixels de referência.',
        default: 8,
        min: 2,
        max: 64,
        step: 1,
        unit: ' px',
    }),
    'gui.snapGrid': booleanSetting({
        label: 'Encaixar na grade',
        description: 'Mover e redimensionar elementos salta de célula em célula da grade.',
        default: false,
    }),
    'gui.rulers': booleanSetting({
        label: 'Réguas',
        description: 'Réguas horizontais e verticais ao redor do canvas.',
        default: true,
    }),
    'gui.outlines': booleanSetting({
        label: 'Contorno de todos os elementos',
        description: 'Desenha o limite de cada elemento, mesmo dos não selecionados.',
        default: false,
    }),
    'gui.safeArea': booleanSetting({
        label: 'Área segura',
        description: 'Marca a região da tela que fica fora de recortes, cantos arredondados e barras do sistema do aparelho emulado.',
        default: false,
    }),
    'gui.checkerboard': booleanSetting({
        label: 'Xadrez de transparência',
        description: 'Fundo quadriculado atrás da tela, para distinguir o transparente do preto.',
        default: true,
    }),
    'gui.deviceFrame': booleanSetting({
        label: 'Moldura do aparelho',
        description: 'Desenha o corpo, os cantos arredondados, o recorte e os indicadores do aparelho emulado em volta da tela.',
        default: true,
    }),
    'gui.devicePixels': booleanSetting({
        label: 'Pixels do aparelho',
        description: 'Rasteriza a tela na grade de pixels do aparelho emulado (viewport × densidade), e não na do monitor do editor.',
        default: true,
    }),
    'simulation.pauseOnBlur': booleanSetting({
        label: 'Pausar a simulação ao perder o foco',
        description: 'A física para quando a janela do navegador deixa de estar em primeiro plano e continua ao voltar.',
        default: false,
    }),
    'simulation.timeScale': numberSetting({
        label: 'Velocidade inicial da simulação',
        description: 'Escala de tempo com que a simulação começa ao abrir um jogo (1× é tempo real).',
        default: 1,
        min: 0.1,
        max: 4,
        step: 0.1,
        unit: '×',
    }),
    'simulation.physics.backend': selectSetting({
        label: 'Onde a física é simulada',
        description: 'Num worker, os passos da física rodam noutro núcleo e nunca disputam o frame com o renderizador nem com os scripts; as poses chegam com um frame de atraso. Com a página isolada (COOP/COEP) o worker lê e escreve na mesma memória; sem isolamento, copia um buffer por frame. O HUD (F3) mostra o modo em vigor.',
        default: 'auto',
        options: [
            { value: 'auto', label: 'Worker', hint: 'Noutra thread sempre que o navegador tem Web Workers' },
            { value: 'local', label: 'Nesta thread', hint: 'Sem o atraso de um frame; a física disputa o frame com o render' },
        ],
    }),
    'simulation.playMaximized': booleanSetting({
        label: 'Jogar com o viewport maximizado',
        description: 'Ao iniciar o jogo os painéis saem da tela (Ctrl+Shift+Espaço restaura); num notebook isso devolve vários milissegundos por frame ao compositor do navegador. Voltam sozinhos ao parar.',
        default: false,
    }),
    'simulation.physics.quality': selectSetting({
        label: 'Qualidade da física em jogos novos',
        description: 'Subpassos e iterações do solver com que um jogo recém-criado nasce; cada jogo pode mudar a sua no painel Física.',
        default: 'medium',
        options: [
            { value: 'low', label: 'Baixa', hint: '2 subpassos' },
            { value: 'medium', label: 'Média', hint: '4 subpassos' },
            { value: 'high', label: 'Alta', hint: '8 subpassos, 2 iterações' },
        ],
    }),
    'simulation.physics.stepRate': selectSetting({
        label: 'Passo fixo em jogos novos',
        description: 'Quantas vezes por segundo a física avança num jogo recém-criado. 60 Hz é o padrão dos jogos; 120 Hz deixa colisões rápidas mais precisas ao dobro do custo; 30 Hz serve a protótipos leves.',
        default: '60',
        options: [
            { value: '30', label: '30 Hz' },
            { value: '60', label: '60 Hz' },
            { value: '120', label: '120 Hz' },
        ],
    }),
    'simulation.physics.sleep': booleanSetting({
        label: 'Permitir modo descanso em jogos novos',
        description: 'Corpos parados adormecem e deixam de custar tempo de simulação até algo os tocar.',
        default: true,
    }),
    'simulation.physics.warmStarting': booleanSetting({
        label: 'Reaproveitar impulsos em jogos novos',
        description: 'O solver parte dos impulsos do passo anterior; desligar serve só para depuração.',
        default: true,
    }),
    'simulation.net.server': selectSetting({
        label: 'Servidor do playtest',
        description: 'Onde o servidor autoritativo roda enquanto você testa. Simulado: dentro do editor, com os scripts de Servidor deste projeto e a ligação degradada abaixo. Hospedado: o playtest abre um WebSocket no endereço de Código ▸ Servidor do jogo e os scripts de Servidor não rodam nesta máquina, só no servidor.',
        default: 'simulated',
        options: [
            { value: 'simulated', label: 'Simulado', hint: 'Dentro do editor' },
            { value: 'hosted', label: 'Hospedado', hint: 'No endereço do projeto' },
        ],
    }),
    'simulation.net.room': textSetting({
        label: 'Sala de teste',
        description: 'Nome da sala que o playtest pede ao servidor hospedado (`?room=`). Duas abas na mesma sala se veem; salas diferentes não.',
        default: 'principal',
        maxLength: 64,
        placeholder: 'principal',
        monospace: true,
    }),
    'simulation.net.ticket': textSetting({
        label: 'Bilhete de teste',
        description: 'Enviado no `hello` ao servidor hospedado, para exercitar `helix.net.authenticate`. Fica só nesta máquina; nunca é salvo no projeto nem vai para o jogo exportado.',
        default: '',
        maxLength: 512,
        placeholder: 'vazio: entra anônimo',
        monospace: true,
    }),
    'simulation.net.latency': numberSetting({
        label: 'Latência simulada',
        description: 'Atraso de ida aplicado a cada mensagem entre o cliente e o servidor simulado do playtest, nos jogos com servidor autoritativo. 0 entrega no mesmo frame; 40 a 80 ms imita uma conexão comum e revela o que o código esconde quando tudo é instantâneo.',
        default: 0,
        min: 0,
        max: 1000,
        step: 10,
        unit: 'ms',
    }),
    'simulation.net.jitter': numberSetting({
        label: 'Variação da latência',
        description: 'Quanto a latência oscila de uma mensagem para outra (mais ou menos este valor). Mensagens continuam chegando na ordem em que saíram.',
        default: 0,
        min: 0,
        max: 500,
        step: 5,
        unit: 'ms',
    }),
    'simulation.net.loss': numberSetting({
        label: 'Perda de pacotes simulada',
        description: 'Fração de mensagens descartadas no caminho. Chamadas (`helix.net.call`) e eventos confiáveis são reenviados pela engine; só os pacotes "sem garantia" se perdem de vez. Serve para testar o que o jogo faz quando a rede falha.',
        default: 0,
        min: 0,
        max: 50,
        step: 1,
        unit: '%',
    }),
    'render.profile': selectSetting({
        label: 'Perfil de qualidade',
        description: 'Orçamentos de sombras, nuvens, bloom e terreno. Em Automático, a engine classifica a GPU; forçar um perfil ajuda a testar como o jogo fica noutras máquinas.',
        default: 'auto',
        requiresReopen: true,
        options: [
            { value: 'auto', label: 'Automático', hint: 'Detectado pela placa de vídeo' },
            { value: 'high', label: 'Alto' },
            { value: 'mid', label: 'Médio' },
            { value: 'low', label: 'Baixo' },
        ],
    }),
    'render.gpuBenchmark': selectSetting({
        label: 'Como a GPU é classificada',
        description: 'Em Automático a engine mede a placa com um micro-benchmark na primeira abertura (sob a tela de carregamento) e guarda o resultado para este dispositivo. "Só a medição guardada" nunca mede de novo; "Pelo nome da placa" usa só a heurística do driver. O HUD (F3) mostra a origem da classe em vigor. Sem efeito com um perfil forçado.',
        default: 'auto',
        requiresReopen: true,
        options: [
            { value: 'auto', label: 'Medir', hint: 'Micro-benchmark na primeira abertura, depois a medição guardada' },
            { value: 'cached', label: 'Só a medição guardada', hint: 'Sem medição guardada, cai na heurística do nome' },
            { value: 'off', label: 'Pelo nome da placa', hint: 'Só a heurística do driver' },
        ],
    }),
    'render.maxPixelRatio': selectSetting({
        label: 'Resolução máxima do viewport',
        description: 'Teto da densidade de pixels do canvas em telas de alta resolução; menos pixels, mais quadros por segundo. Em Automático segue o perfil: 1× no Baixo, 1,5× no Médio e 2× no Alto.',
        default: 'auto',
        options: [
            { value: 'auto', label: 'Automático', hint: 'Pelo perfil de qualidade' },
            { value: '1', label: '1× (nativa baixa)' },
            { value: '1.5', label: '1,5×' },
            { value: '2', label: '2× (nítida)' },
        ],
    }),
    'render.dynamicResolution': selectSetting({
        label: 'Qualidade adaptativa',
        description: 'Quando os quadros estouram o orçamento, a engine desce uma escada de cinco degraus: a cena 3D encolhe (até 60%), as sombras distantes, as faces de sombra local e os tiles de terreno são refeitos com menos frequência, as nuvens e o bloom marcham em alvos menores e, nos dois degraus mais fundos, só as luzes mais importantes projetam sombra, a grama fica mais rala e os efeitos de lente e o SMAA saem; sobra tempo, ela volta a subir por sondas. Em Automático a escada só desce em jogo: no viewport do editor, a imagem em movimento é a mesma do repouso. A interface do editor nunca muda. O HUD (F3) mostra o degrau em vigor.',
        default: 'auto',
        options: [
            { value: 'auto', label: 'Automático', hint: 'Só em jogo, em todos os perfis; no degrau 0 não custa nada' },
            { value: 'on', label: 'Ligada', hint: 'Também no viewport do editor, enquanto a câmera ou o mouse se movem' },
            { value: 'off', label: 'Desligada' },
        ],
    }),
    'render.editorLite': selectSetting({
        label: 'Viewport leve no editor',
        description: 'Fora do jogo, o viewport deixa de desenhar profundidade de campo, granulado, aberração cromática e vinheta. Os ajustes da cena e o jogo exportado não mudam. Em Automático liga nos perfis Baixo e Médio.',
        default: 'auto',
        options: [
            { value: 'auto', label: 'Automático', hint: 'Ligado no Baixo e no Médio' },
            { value: 'on', label: 'Ligado' },
            { value: 'off', label: 'Desligado' },
        ],
    }),
    'render.onDemand': booleanSetting({
        label: 'Render sob demanda',
        description: 'Com tudo parado, o viewport deixa de redesenhar e a GPU descansa. Desligue para medir o custo real de um quadro.',
        default: true,
    }),
    'render.fpsLimit': selectSetting({
        label: 'Limite de quadros por segundo',
        description: 'Teto de quadros do viewport. Útil em notebooks e telas de 120 Hz ou mais, para gastar menos bateria e GPU enquanto se edita. Em Automático segue o perfil: 60 fps no Baixo, sem limite nos demais.',
        default: 'auto',
        options: [
            { value: 'auto', label: 'Automático', hint: 'Pelo perfil de qualidade' },
            { value: 'unlimited', label: 'Sem limite', hint: 'A taxa da tela' },
            { value: '120', label: '120 fps' },
            { value: '60', label: '60 fps' },
            { value: '30', label: '30 fps' },
        ],
    }),
    'render.lod.enabled': booleanSetting({
        label: 'Níveis de detalhe (LOD)',
        description: 'Malhas distantes trocam para versões reduzidas.',
        default: true,
    }),
    'render.lod.bias': numberSetting({
        label: 'Viés de LOD',
        description: 'Cada +1 troca de nível com o dobro do tamanho em tela (mais agressivo); −1 com a metade.',
        default: 0,
        min: -2,
        max: 2,
        step: 0.5,
    }),
    'render.culling.frustum': booleanSetting({
        label: 'Descarte fora do campo de visão',
        description: 'Não desenha o que está fora da pirâmide da câmera.',
        default: true,
    }),
    'render.culling.minPixelSize': numberSetting({
        label: 'Tamanho mínimo em tela',
        description: 'Malhas com diâmetro projetado abaixo disto deixam de ser desenhadas.',
        default: 2,
        min: 0,
        max: 8,
        step: 0.5,
        unit: ' px',
    }),
    'render.myriad.enabled': booleanSetting({
        label: 'Geometria virtual (Myriad)',
        description: 'Malhas densas são desenhadas por clusters refinados por pixel em vez de LODs fixos.',
        default: true,
    }),
    'render.myriad.pixelError': numberSetting({
        label: 'Erro tolerado do Myriad',
        description: 'Erro geométrico máximo em tela; valores menores refinam mais e custam mais.',
        default: 1,
        min: 0.25,
        max: 16,
        step: 0.25,
        unit: ' px',
        scale: 'log',
    }),
    'render.myriad.occlusion': booleanSetting({
        label: 'Culling de oclusão por cluster',
        description: 'Clusters escondidos atrás de outros não são desenhados (dois passes contra a pirâmide de profundidade).',
        default: true,
    }),
    'render.myriad.shadowClusters': booleanSetting({
        label: 'Sombras por cluster',
        description: 'As cascatas de sombra também usam a geometria virtual.',
        default: true,
    }),
    'render.budget.shadows': selectSetting({
        label: 'Sombras do sol',
        description: 'Resolução das cascatas, ritmo de atualização das distantes e escala da máscara de sombra em tela. Baixo: 1024 px, cascatas distantes a cada 4 frames, máscara a meia resolução. Alto: 2048 px, tudo por frame, máscara inteira.',
        default: 'auto',
        requiresReopen: true,
        options: RENDER_BUDGET_OPTIONS,
    }),
    'render.budget.localLights': selectSetting({
        label: 'Luzes locais e suas sombras',
        description: 'Quantas luzes pontuais e cônicas projetam sombra, o tamanho de cada face do atlas e quantas faces são refeitas por frame. Baixo: 16 luzes, 256 px, 2 faces por frame. Alto: 96 luzes, 1024 px, 30 faces.',
        default: 'auto',
        requiresReopen: true,
        options: RENDER_BUDGET_OPTIONS,
    }),
    'render.budget.clouds': selectSetting({
        label: 'Nuvens volumétricas',
        description: 'Passos da marcha de raios por frame e entrelaçamento 2×2 (um quarto dos pixels por frame, o resto reprojetado). Menos passos convergem mais devagar, nunca com outro resultado. Baixo: 12 passos entrelaçados. Alto: 40 passos, sem entrelaçar.',
        default: 'auto',
        requiresReopen: true,
        options: RENDER_BUDGET_OPTIONS,
    }),
    'render.budget.terrainCache': selectSetting({
        label: 'Cache de material do terreno',
        description: 'Níveis e tamanho do clipmap em que o material do terreno é assado, e quantos tiles são refeitos por frame. Baixo: 6 níveis de 512 px, 8 tiles. Alto: 7 níveis de 2048 px, 64 tiles.',
        default: 'auto',
        requiresReopen: true,
        options: RENDER_BUDGET_OPTIONS,
    }),
    'render.budget.post': selectSetting({
        label: 'Bloom, profundidade de campo e SMAA',
        description: 'Níveis da pirâmide do bloom e a escala do primeiro, amostras do desfoque de profundidade de campo e o stencil do SMAA (o passe caro só nas bordas). Baixo: 3 níveis a um quarto, 12 amostras. Alto: 7 níveis a meia resolução, 48 amostras.',
        default: 'auto',
        requiresReopen: true,
        options: RENDER_BUDGET_OPTIONS,
    }),
    'render.budget.myriad': selectSetting({
        label: 'Ativação da geometria virtual',
        description: 'A partir de quantos triângulos do caminho clássico o Myriad compensa o seu custo fixo e assume a cena. Baixo: 400 mil. Médio: 1 milhão. Alto: 1,5 milhão.',
        default: 'auto',
        requiresReopen: true,
        options: RENDER_BUDGET_OPTIONS,
    }),
    'render.hdrFormat': selectSetting({
        label: 'Precisão do alvo HDR',
        description: 'Formato em que a cena é desenhada antes do pós-processo. RG11B10F move metade dos bytes de RGBA16F em toda leitura e escrita (numa GPU integrada o frame é limitado pela banda de memória); RGBA16F preserva mais gradação nas sombras profundas e no bloom. Em Automático segue o perfil: compacto no Baixo e no Médio.',
        default: 'auto',
        requiresReopen: true,
        options: [
            { value: 'auto', label: 'Automático', hint: 'Pelo perfil de qualidade' },
            { value: 'rg11b10f', label: 'Compacto (RG11B10F)', hint: 'Metade da banda de memória' },
            { value: 'rgba16f', label: 'Preciso (RGBA16F)', hint: 'Mais gradação em HDR' },
        ],
    }),
    'render.terrainCache': booleanSetting({
        label: 'Usar o cache de material do terreno',
        description: 'Lê o material do terreno do clipmap em cache; desligado, avalia as camadas em todo pixel (comparação A/B).',
        default: true,
    }),
    'render.csgGhosts': booleanSetting({
        label: 'Fantasmas dos pincéis CSG',
        description: 'Desenha os pincéis de subtração como volumes translúcidos no viewport.',
        default: true,
    }),
    'render.helpers.lights': selectSetting({
        label: 'Marcadores de luz',
        description: 'Quais luzes ganham o desenho do emissor e do alcance no viewport.',
        default: 'all',
        options: [
            { value: 'all', label: 'Todas' },
            { value: 'selected', label: 'Só a selecionada' },
            { value: 'off', label: 'Nenhuma' },
        ],
    }),
    'render.helpers.sounds': selectSetting({
        label: 'Marcadores de som',
        description: 'Quais fontes e zonas de som ganham marcador e alcances no viewport.',
        default: 'all',
        options: [
            { value: 'all', label: 'Todos' },
            { value: 'selected', label: 'Só o selecionado' },
            { value: 'off', label: 'Nenhum' },
        ],
    }),
    'render.helpers.vfx': selectSetting({
        label: 'Marcadores de efeito',
        description: 'Quais atores de efeito ganham marcador e formas de emissão no viewport.',
        default: 'all',
        options: [
            { value: 'all', label: 'Todos' },
            { value: 'selected', label: 'Só o selecionado' },
            { value: 'off', label: 'Nenhum' },
        ],
    }),
    'code.fontSize': numberSetting({
        label: 'Tamanho da fonte',
        description: 'Fonte do código, em pixels. Ctrl + e Ctrl − também mudam enquanto você digita; Ctrl 0 volta ao padrão.',
        default: 13,
        min: 10,
        max: 20,
        step: 1,
        unit: ' px',
    }),
    'code.lineHeight': selectSetting({
        label: 'Altura das linhas',
        description: 'Espaço vertical de cada linha em relação à fonte.',
        default: 'normal',
        options: [
            { value: 'compact', label: 'Compacta', hint: '1,35× a fonte: mais linhas na tela' },
            { value: 'normal', label: 'Normal', hint: '1,55× a fonte' },
            { value: 'relaxed', label: 'Arejada', hint: '1,8× a fonte: mais confortável em sessões longas' },
        ],
    }),
    'code.lineNumbers': booleanSetting({
        label: 'Números de linha',
        description: 'A calha à esquerda com o número de cada linha.',
        default: true,
    }),
    'code.highlightLine': booleanSetting({
        label: 'Destacar a linha do cursor',
        description: 'Um fundo sutil na linha em que o cursor está, no texto e na calha.',
        default: true,
    }),
    'code.indentGuides': booleanSetting({
        label: 'Guias de indentação',
        description: 'Linhas verticais finas em cada nível de indentação; a do bloco atual fica mais forte.',
        default: true,
    }),
    'code.folding': booleanSetting({
        label: 'Dobrar blocos',
        description: 'Marcadores na calha para recolher funções, blocos e objetos (aparecem ao passar o mouse).',
        default: true,
    }),
    'code.minimap': booleanSetting({
        label: 'Minimapa',
        description: 'Miniatura do arquivo inteiro à direita, com a janela visível marcada; clique para rolar até um ponto.',
        default: true,
    }),
    'code.whitespace': booleanSetting({
        label: 'Mostrar espaços e tabulações',
        description: 'Pontos nos espaços e setas nas tabulações; espaços sobrando no fim da linha ficam em vermelho.',
        default: false,
    }),
    'code.wordWrap': booleanSetting({
        label: 'Quebrar linhas longas',
        description: 'Linhas maiores que o editor continuam embaixo em vez de pedir rolagem horizontal.',
        default: false,
    }),
    'code.cursorBlink': booleanSetting({
        label: 'Cursor piscante',
        description: 'Desligado, o cursor fica fixo: alguns preferem para não distrair.',
        default: true,
    }),
    'code.autoSuggest': booleanSetting({
        label: 'Sugestões automáticas',
        description: 'A lista de sugestões aparece sozinha ao digitar. Desligada, só com Ctrl Espaço.',
        default: true,
    }),
    'code.autoCloseBrackets': booleanSetting({
        label: 'Fechar parênteses e aspas',
        description: 'Digitar ( [ { " ou \' insere o par e deixa o cursor no meio; digitar o fechamento pula por cima dele.',
        default: true,
    }),
    'code.selectionMatches': booleanSetting({
        label: 'Destacar ocorrências da seleção',
        description: 'Selecionar uma palavra marca, em cinza, todos os lugares em que ela aparece no arquivo.',
        default: true,
    }),
    'code.liveVerify': booleanSetting({
        label: 'Verificar enquanto digita',
        description: 'O compilador da linguagem confere o texto a cada pausa e sublinha os problemas. Desligada, só Compilar e Executar apontam erros.',
        default: true,
    }),
    'code.verifyDelay': selectSetting({
        label: 'Pausa antes de verificar',
        description: 'Quanto tempo sem digitar a engine espera antes de conferir. Cada linguagem tem a sua base (TypeScript é leve; C++ e Rust pesam); isto a multiplica.',
        default: 'normal',
        options: [
            { value: 'fast', label: 'Curta', hint: 'Metade da pausa: conferências mais frequentes' },
            { value: 'normal', label: 'Normal' },
            { value: 'relaxed', label: 'Longa', hint: 'O dobro da pausa: menos trabalho em máquinas modestas' },
        ],
    }),
    'code.presentation': selectSetting({
        label: 'Onde o editor abre',
        description: 'Apresentação do editor de código ao abrir um jogo. Dá para trocar a qualquer momento pelo menu da barra do editor.',
        default: 'workspace',
        options: [
            { value: 'workspace', label: 'Área de trabalho', hint: 'No centro, no lugar do viewport' },
            { value: 'window', label: 'Janela flutuante', hint: 'Sobre a cena, para programar olhando o viewport' },
            { value: 'tab', label: 'Aba do navegador', hint: 'Para um segundo monitor' },
        ],
    }),
    'code.openOnCreate': booleanSetting({
        label: 'Abrir o script ao criar',
        description: 'Um script recém-criado já abre numa aba fixa do editor. Desligada, ele só entra na biblioteca e na hierarquia.',
        default: true,
    }),
    'code.previewTabs': booleanSetting({
        label: 'Abas de visualização',
        description: 'Um clique abre o script numa aba em itálico que a próxima abertura substitui; editar ou dar duplo clique a fixa. Desligada, todo script abre numa aba própria.',
        default: true,
    }),
    'code.commandBar': booleanSetting({
        label: 'Barra de comando ao abrir',
        description: 'A linha de comando do editor de código começa visível ao abrir um jogo; o atalho de mostrar / ocultar a alterna depois.',
        default: true,
    }),
    'code.statusStrip': booleanSetting({
        label: 'Faixa de status',
        description: 'O rodapé do editor com a posição do cursor, o tamanho do arquivo, a linguagem e o estado do compilador.',
        default: true,
    }),
    'audio.onlyWhenFocused': booleanSetting({
        label: 'Executar áudio somente com a janela em foco',
        description: 'Silencia a engine quando a aba perde o foco e retoma ao voltar.',
        default: false,
    }),
    'audio.monitorVolume': numberSetting({
        label: 'Volume de monitoração',
        description: 'Volume geral do áudio dentro do editor; não altera a mesa de som do jogo.',
        default: 100,
        min: 0,
        max: 100,
        step: 5,
        unit: '%',
    }),
} as const;
export type SettingId = keyof typeof ENGINE_SETTINGS;
export type SettingValue<K extends SettingId> = (typeof ENGINE_SETTINGS)[K]['default'];
export const SETTING_IDS = Object.keys(ENGINE_SETTINGS) as SettingId[];
export type SettingPanelId = 'gameLanguage';
export interface SettingGroup {
    readonly title: string;
    readonly description?: string;
    readonly settings: readonly SettingId[];
    readonly panel?: SettingPanelId;
}
export interface SettingSection {
    readonly id: string;
    readonly title: string;
    readonly description: string;
    readonly groups: readonly SettingGroup[];
}
export const ENGINE_SETTING_SECTIONS: readonly SettingSection[] = [
    {
        id: 'editor',
        title: 'Editor',
        description: 'Câmera, estado inicial do viewport, interface do editor, console e importação.',
        groups: [
            { title: 'Câmera', settings: ['editor.camera.orbitSpeed', 'editor.camera.panSpeed', 'editor.camera.zoomSpeed', 'editor.camera.fov', 'editor.camera.invertZoom', 'editor.camera.invertOrbitY'] },
            { title: 'Ao abrir um jogo', settings: ['editor.open.tool', 'editor.open.space', 'editor.open.grid', 'editor.open.shadows', 'editor.open.perfHud'] },
            { title: 'Interface do editor', settings: ['editor.ui.scale', 'editor.ui.statusBar', 'editor.ui.menuShortcuts', 'editor.hierarchy.kindLabels', 'editor.ui.reduceMotion'] },
            { title: 'Console', settings: ['editor.console.order', 'editor.console.limit', 'editor.console.revealOnError'] },
            { title: 'Importação de modelos', settings: ['editor.import.placement', 'editor.import.frameAfterImport', 'editor.import.saveToLibrary', 'editor.import.convertUnits'] },
        ],
    },
    {
        id: 'project',
        title: 'Projeto e salvamento',
        description: 'Recuperação automática, instantâneos restauráveis e o template de um jogo novo.',
        groups: [
            {
                title: 'Recuperação automática',
                description: 'A engine grava a cena sozinha para nada se perder por fechar a aba ou por uma falha de persistência.',
                settings: ['project.autosave.enabled', 'project.autosave.delay', 'project.autosave.maxWait'],
            },
            { title: 'Salvamentos automáticos restauráveis', settings: ['project.snapshots.interval', 'project.snapshots.max'] },
            { title: 'Capa e jogo novo', settings: ['project.thumbnail.enabled', 'project.new.template'] },
        ],
    },
    {
        id: 'selection',
        title: 'Seleção e encaixe',
        description: 'Enquadramento, gizmo e o encaixe de transformação da cena 3D.',
        groups: [
            { title: 'Seleção e gizmo', settings: ['selection.focusPadding', 'editor.gizmo.size'] },
            { title: 'Encaixe de transformação', settings: ['snap.enabled', 'snap.translate', 'snap.rotate', 'snap.scale'] },
        ],
    },
    {
        id: 'gui',
        title: 'Interface',
        description: 'Opções do canvas da área de trabalho Interface com que cada jogo abre.',
        groups: [
            { title: 'Encaixe', settings: ['gui.snapGuides', 'gui.snapGrid', 'gui.grid', 'gui.gridSize'] },
            { title: 'Vista', settings: ['gui.rulers', 'gui.outlines', 'gui.safeArea', 'gui.checkerboard'] },
            { title: 'Emulação de aparelho', settings: ['gui.deviceFrame', 'gui.devicePixels'] },
        ],
    },
    {
        id: 'simulation',
        title: 'Física e simulação',
        description: 'Comportamento do playtest e os padrões de física com que jogos novos nascem.',
        groups: [
            { title: 'Simulação', settings: ['simulation.pauseOnBlur', 'simulation.timeScale', 'simulation.playMaximized'] },
            {
                title: 'Desempenho',
                description: 'Onde os passos da física rodam. Vale para o próximo jogo iniciado.',
                settings: ['simulation.physics.backend'],
            },
            {
                title: 'Padrões de física para jogos novos',
                description: 'A física faz parte de cada jogo e é salva com ele; estes valores só definem como um jogo recém-criado começa.',
                settings: ['simulation.physics.quality', 'simulation.physics.stepRate', 'simulation.physics.sleep', 'simulation.physics.warmStarting'],
            },
            {
                title: 'Servidor no playtest',
                description: 'Nos jogos com servidor autoritativo (Código ▸ Servidor do jogo), o playtest pode subir um servidor simulado dentro do editor ou conectar ao servidor que você já hospedou.',
                settings: ['simulation.net.server', 'simulation.net.room', 'simulation.net.ticket'],
            },
            {
                title: 'Ligação simulada',
                description: 'Com o servidor simulado, estes valores degradam a ligação entre ele e o cliente para testar o jogo como se estivesse na internet. Com o servidor hospedado, a rede é a de verdade.',
                settings: ['simulation.net.latency', 'simulation.net.jitter', 'simulation.net.loss'],
            },
        ],
    },
    {
        id: 'render',
        title: 'Renderização',
        description: 'Perfil de qualidade, classificação da GPU, orçamentos por subsistema, níveis de detalhe, geometria virtual e marcadores do viewport.',
        groups: [
            {
                title: 'Perfil e classificação da GPU',
                description: 'Como a engine decide a classe da placa e o perfil que ela aplica. Valem ao reabrir o jogo: o renderer nasce com estes orçamentos.',
                settings: ['render.profile', 'render.gpuBenchmark'],
            },
            { title: 'Resolução e ritmo', settings: ['render.maxPixelRatio', 'render.dynamicResolution', 'render.editorLite', 'render.fpsLimit', 'render.onDemand'] },
            {
                title: 'Orçamentos por subsistema',
                description: 'Cada orçamento segue o perfil em Automático; forçado, toma os valores de outra classe só para aquele subsistema. Nenhum muda o resultado convergido, só quanto trabalho é feito por frame e em que resolução. Valem ao reabrir o jogo.',
                settings: ['render.budget.shadows', 'render.budget.localLights', 'render.budget.clouds', 'render.budget.terrainCache', 'render.budget.post', 'render.budget.myriad', 'render.hdrFormat'],
            },
            { title: 'Níveis de detalhe e descarte', settings: ['render.lod.enabled', 'render.lod.bias', 'render.culling.frustum', 'render.culling.minPixelSize'] },
            { title: 'Geometria virtual', settings: ['render.myriad.enabled', 'render.myriad.pixelError', 'render.myriad.occlusion', 'render.myriad.shadowClusters'] },
            { title: 'Terreno e CSG', settings: ['render.terrainCache', 'render.csgGhosts'] },
            { title: 'Marcadores do editor', settings: ['render.helpers.lights', 'render.helpers.sounds', 'render.helpers.vfx'] },
        ],
    },
    {
        id: 'code',
        title: 'Código',
        description: 'A linguagem do jogo aberto e as preferências do editor de código: aparência, edição, verificação ao vivo e comportamento.',
        groups: [
            {
                title: 'Linguagem do jogo',
                description: 'Cada jogo é programado numa só linguagem: todo script nasce nela e só ela compila. A escolha é do jogo aberto, salva com ele, e pode mudar a qualquer momento.',
                settings: [],
                panel: 'gameLanguage',
            },
            { title: 'Aparência', settings: ['code.fontSize', 'code.lineHeight', 'code.lineNumbers', 'code.highlightLine', 'code.indentGuides', 'code.folding', 'code.minimap', 'code.whitespace', 'code.wordWrap', 'code.cursorBlink'] },
            {
                title: 'Edição',
                description: 'A indentação (tab ou espaços, e quantos) segue a convenção de cada linguagem, não uma preferência.',
                settings: ['code.autoSuggest', 'code.autoCloseBrackets', 'code.selectionMatches'],
            },
            { title: 'Verificação ao vivo', settings: ['code.liveVerify', 'code.verifyDelay'] },
            { title: 'Comportamento', settings: ['code.presentation', 'code.openOnCreate', 'code.previewTabs', 'code.commandBar', 'code.statusStrip'] },
        ],
    },
    {
        id: 'audio',
        title: 'Áudio',
        description: 'Como a engine toca som enquanto você edita.',
        groups: [{ title: 'Monitoração', settings: ['audio.onlyWhenFocused', 'audio.monitorVolume'] }],
    },
];
export function settingSection(id: SettingId): SettingSection {
    const section = ENGINE_SETTING_SECTIONS.find((candidate) => candidate.groups.some((group) => group.settings.includes(id)));
    if (!section)
        throw new Error(`A preferência ${id} não está em nenhuma seção.`);
    return section;
}
