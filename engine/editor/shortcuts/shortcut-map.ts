export interface ShortcutInfo {
    readonly keys: readonly string[];
    readonly label: string;
}
export interface ShortcutGroup {
    readonly title: string;
    readonly items: readonly ShortcutInfo[];
}
export const SHORTCUT_GROUPS: readonly ShortcutGroup[] = [
    {
        title: 'Arquivo',
        items: [
            { keys: ['Ctrl', 'I'], label: 'Importar modelo (glTF, GLB, OBJ, STL, FBX)' },
            { keys: ['Ctrl', 'B'], label: 'Adicionar arquivos à biblioteca de ativos' },
            { keys: ['Arrastar arquivos'], label: 'Soltar no viewport para abrir a janela de importação' },
            { keys: ['Esc'], label: 'Cancelar a importação em andamento' },
        ],
    },
    {
        title: 'Biblioteca de ativos',
        items: [
            { keys: ['Arrastar arquivos'], label: 'Soltar no painel Ativos para guardar na biblioteca' },
            { keys: ['Arrastar ativo'], label: 'Soltar no viewport: modelo entra no ponto, textura vai para o ator' },
            { keys: ['Duplo clique', 'Enter'], label: 'Colocar o modelo na cena, aplicar a textura à seleção ou ouvir o áudio' },
            { keys: ['F2'], label: 'Renomear o ativo selecionado' },
            { keys: ['Delete'], label: 'Remover o ativo selecionado (Ctrl+Z restaura, com arquivos)' },
        ],
    },
    {
        title: 'Ferramentas',
        items: [
            { keys: ['Q'], label: 'Selecionar' },
            { keys: ['W'], label: 'Mover' },
            { keys: ['E'], label: 'Rotacionar' },
            { keys: ['R'], label: 'Escalar' },
            { keys: ['T'], label: 'Terreno (esculpir e pintar)' },
            { keys: ['Ctrl', 'arrastar'], label: 'Inverte o alinhamento à grade durante o arrasto' },
        ],
    },
    {
        title: 'Terreno',
        items: [
            { keys: ['Arrastar'], label: 'Aplica a ferramenta atual sobre o terreno' },
            { keys: ['Shift', 'arrastar'], label: 'Inverte: rebaixa, subtrai ruído ou apaga a camada' },
            { keys: ['1', '…', '8'], label: 'Elevar, Suavizar, Achatar, Ruído, Terraço, Erosão, Pintar, Grama' },
            { keys: ['[', ']'], label: 'Diminui / aumenta o raio do pincel (Shift: dobra)' },
            { keys: ['C'], label: 'Copia a altura sob o cursor para a altura fixa do Achatar' },
            { keys: ['Esc'], label: 'Cancela a pincelada em andamento' },
        ],
    },
    {
        title: 'CSG',
        items: [
            { keys: ['B'], label: 'Pincel de subtração em caixa no ator selecionado (Shift: cilindro)' },
            { keys: ['Ctrl', 'Alt', 'S'], label: 'Subtrair os demais selecionados do ator principal' },
            { keys: ['Ctrl', 'Alt', 'U'], label: 'Unir os demais selecionados ao ator principal' },
            { keys: ['Ctrl', 'Alt', 'I'], label: 'Interseção do ator principal com os demais selecionados' },
            { keys: ['Ctrl', 'Alt', 'B'], label: 'Consolidar o alvo CSG selecionado (fixar o resultado)' },
            { keys: ['Ctrl', 'Alt', 'E'], label: 'Ativar / desativar os pincéis selecionados' },
            { keys: ['Ctrl', 'Alt', '↑ / ↓'], label: 'Mover o pincel selecionado na ordem das operações' },
            { keys: ['Arrastar na hierarquia'], label: 'Soltar uma malha dentro de um alvo CSG a torna pincel; a ordem dos filhos é a das operações' },
            { keys: ['Clique no furo'], label: 'A seleção atravessa recortes: o clique acerta o que está atrás, não a caixa do ator' },
        ],
    },
    {
        title: 'Materiais',
        items: [
            { keys: ['M'], label: 'Abrir o editor de materiais' },
            { keys: ['Arrastar imagens'], label: 'Soltar na janela do editor para importar um conjunto PBR' },
            { keys: ['Shift', 'arrastar'], label: 'Gira a luz principal no preview do material' },
        ],
    },
    {
        title: 'Cores',
        items: [
            { keys: ['Conta-gotas'], label: 'Colhe uma cor de qualquer ponto da tela para o campo' },
            { keys: ['Esc'], label: 'Cancela o conta-gotas' },
        ],
    },
    {
        title: 'Seleção',
        items: [
            { keys: ['Ctrl', 'clique'], label: 'Soma ou retira o ator da seleção (viewport e hierarquia)' },
            { keys: ['Shift', 'clique'], label: 'Seleciona o intervalo na hierarquia' },
            { keys: ['Ctrl', 'A'], label: 'Selecionar tudo' },
            { keys: ['F'], label: 'Enquadrar a seleção' },
            { keys: ['F2'], label: 'Renomear' },
            { keys: ['H'], label: 'Ocultar / mostrar' },
            { keys: ['Shift', 'H'], label: 'Isolar a seleção (oculta o resto)' },
            { keys: ['Alt', 'H'], label: 'Mostrar todos os ocultos' },
            { keys: ['L'], label: 'Bloquear / desbloquear (bloqueados não são selecionáveis no viewport)' },
            { keys: ['Alt', 'L'], label: 'Desbloquear todos' },
            { keys: ['Esc'], label: 'Limpar seleção' },
        ],
    },
    {
        title: 'Hierarquia',
        items: [
            { keys: ['↑ / ↓'], label: 'Navegar entre linhas (Shift estende a seleção)' },
            { keys: ['← / →'], label: 'Recolher / expandir o nó (ou ir ao pai / primeiro filho)' },
            { keys: ['Enter'], label: 'Enquadrar o ator focado' },
            { keys: ['Alt', 'N'], label: 'Nova pasta' },
            { keys: ['Arrastar'], label: 'Reorganizar; com vários selecionados, move todos juntos' },
        ],
    },
    {
        title: 'Edição',
        items: [
            { keys: ['Ctrl', 'Z'], label: 'Desfazer' },
            { keys: ['Ctrl', 'Shift', 'Z'], label: 'Refazer' },
            { keys: ['Ctrl', 'D'], label: 'Duplicar' },
            { keys: ['Ctrl', 'C'], label: 'Copiar' },
            { keys: ['Ctrl', 'V'], label: 'Colar' },
            { keys: ['Ctrl', 'G'], label: 'Agrupar' },
            { keys: ['Ctrl', 'Shift', 'G'], label: 'Desagrupar' },
            { keys: ['Delete'], label: 'Excluir' },
        ],
    },
    {
        title: 'Simulação',
        items: [
            { keys: ['Ctrl', 'P'], label: 'Simular / pausar a física' },
            { keys: ['Ctrl', 'Shift', 'P'], label: 'Parar e restaurar a cena' },
        ],
    },
    {
        title: 'Animação (com o painel focado)',
        items: [
            { keys: ['Espaço'], label: 'Reproduzir / pausar' },
            { keys: ['← / →'], label: 'Quadro anterior / seguinte (Shift: 10 quadros)' },
            { keys: ['Home / End'], label: 'Início / fim do clipe' },
            { keys: [', / .'], label: 'Chave anterior / seguinte' },
            { keys: ['K'], label: 'Inserir chave nos ossos selecionados (Shift+K: em todos)' },
            { keys: ['Delete'], label: 'Excluir as chaves selecionadas' },
            { keys: ['Ctrl', 'C / V'], label: 'Copiar / colar chaves no quadro atual' },
            { keys: ['Ctrl', 'S'], label: 'Salvar na biblioteca' },
            { keys: ['Arrastar na régua'], label: 'Percorrer o tempo' },
            { keys: ['Arrastar chaves'], label: 'Mover no tempo (dopesheet) ou mudar o valor (curvas)' },
            { keys: ['Arrastar mão / pé'], label: 'Posar o membro com IK no viewport' },
        ],
    },
    {
        title: 'Painéis',
        items: [
            { keys: ['Ctrl', 'Shift', 'E'], label: 'Abrir / fechar a Hierarquia' },
            { keys: ['Ctrl', 'Shift', 'A'], label: 'Abrir / fechar os Ativos' },
            { keys: ['Ctrl', 'Shift', 'T'], label: 'Abrir / fechar a Animação' },
            { keys: ['Ctrl', '`'], label: 'Abrir / fechar o Console' },
            { keys: ['Ctrl', 'Shift', 'Espaço'], label: 'Maximizar o viewport / restaurar os painéis' },
            { keys: ['Clique do meio'], label: 'Fecha a aba do painel' },
            { keys: ['Arrastar aba'], label: 'Encaixa o painel noutra área (zonas aparecem sobre o viewport)' },
        ],
    },
    {
        title: 'Viewport',
        items: [
            { keys: ['Arrastar'], label: 'Orbitar' },
            { keys: ['Botão direito'], label: 'Menu de contexto (clique) ou orbitar (arrasto)' },
            { keys: ['Shift', 'arrastar'], label: 'Panoramizar (ou botão do meio)' },
            { keys: ['Scroll'], label: 'Aproximar / afastar' },
            { keys: ['G'], label: 'Alternar grade' },
        ],
    },
];
