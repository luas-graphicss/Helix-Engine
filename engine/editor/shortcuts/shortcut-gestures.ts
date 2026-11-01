export interface ShortcutGesture {
    readonly gesture: string;
    readonly label: string;
}
export interface ShortcutGestureGroup {
    readonly title: string;
    readonly items: readonly ShortcutGesture[];
}
export const SHORTCUT_GESTURE_GROUPS: readonly ShortcutGestureGroup[] = [
    {
        title: 'Viewport',
        items: [
            { gesture: 'Arrastar', label: 'Orbitar' },
            { gesture: 'Botão direito', label: 'Menu de contexto (clique) ou orbitar (arrasto)' },
            { gesture: 'Shift + arrastar', label: 'Panoramizar (ou botão do meio)' },
            { gesture: 'Rolagem', label: 'Aproximar / afastar' },
            { gesture: 'Ctrl + clique', label: 'Soma ou retira o ator da seleção (viewport e hierarquia)' },
            { gesture: 'Ctrl + arrastar', label: 'Inverte o alinhamento à grade durante o arrasto' },
            { gesture: 'Clique no furo', label: 'A seleção atravessa recortes CSG: o clique acerta o que está atrás' },
            { gesture: 'Arrastar arquivos', label: 'Soltar no viewport para abrir a janela de importação (Esc cancela)' },
        ],
    },
    {
        title: 'Hierarquia',
        items: [
            { gesture: 'Shift + clique', label: 'Seleciona o intervalo' },
            { gesture: '↑ / ↓', label: 'Navegar entre linhas (Shift estende a seleção)' },
            { gesture: '← / →', label: 'Recolher / expandir o nó (ou ir ao pai / primeiro filho)' },
            { gesture: 'Enter', label: 'Enquadrar o ator focado' },
            { gesture: 'Arrastar', label: 'Reorganizar; com vários selecionados, move todos. Uma malha solta dentro de um alvo CSG vira pincel' },
        ],
    },
    {
        title: 'Biblioteca de ativos',
        items: [
            { gesture: 'Arrastar arquivos', label: 'Soltar no painel Ativos para guardar na biblioteca' },
            { gesture: 'Arrastar ativo', label: 'Soltar no viewport: o modelo entra no ponto, a textura vai para o ator' },
            { gesture: 'Duplo clique / Enter', label: 'Colocar o modelo na cena, aplicar a textura à seleção ou abrir o áudio / a animação' },
            { gesture: 'F2 / Delete', label: 'Renomear / remover o ativo selecionado (Ctrl+Z restaura, com arquivos)' },
        ],
    },
    {
        title: 'Terreno',
        items: [
            { gesture: 'Arrastar', label: 'Aplica a ferramenta atual sobre o terreno' },
            { gesture: 'Shift + arrastar', label: 'Inverte: rebaixa, subtrai ruído ou apaga a camada' },
            { gesture: 'Esc', label: 'Cancela a pincelada em andamento' },
        ],
    },
    {
        title: 'Materiais e cores',
        items: [
            { gesture: 'Arrastar imagens', label: 'Soltar no editor de materiais para importar um conjunto PBR' },
            { gesture: 'Shift + arrastar', label: 'Gira a luz principal no preview do material' },
            { gesture: 'Conta-gotas', label: 'Colhe uma cor de qualquer ponto da tela para o campo (Esc cancela)' },
        ],
    },
    {
        title: 'Painéis',
        items: [
            { gesture: 'Clique do meio', label: 'Fecha a aba do painel' },
            { gesture: 'Arrastar aba', label: 'Encaixa o painel noutra área (as zonas aparecem sobre o viewport)' },
        ],
    },
    {
        title: 'Animação',
        items: [
            { gesture: 'Arrastar na régua', label: 'Percorrer o tempo' },
            { gesture: 'Arrastar chaves', label: 'Mover no tempo (dopesheet) ou mudar o valor (curvas)' },
            { gesture: 'Arrastar mão / pé', label: 'Posar o membro com IK no viewport' },
        ],
    },
    {
        title: 'Áudio',
        items: [
            { gesture: 'Ctrl + rolagem', label: 'Aproximar no ponteiro (a rolagem simples desloca o trecho)' },
            { gesture: 'Arrastar', label: 'Percorrer; nas abas do recorte ou do laço, mover os limites' },
            { gesture: 'Duplo clique no fader', label: 'Fader da mesa de som de volta a 0 dB' },
        ],
    },
    {
        title: 'Efeitos',
        items: [
            { gesture: 'Duplo clique', label: 'Renomear o emissor' },
            { gesture: 'Arrastar', label: 'Reordenar na pilha; na linha do tempo, percorrer o ciclo' },
        ],
    },
    {
        title: 'Interface',
        items: [
            { gesture: 'Espaço segurado', label: 'Mão temporária: arrastar a vista com qualquer ferramenta' },
            { gesture: 'Arrastar da paleta', label: 'Soltar um elemento, ícone, imagem ou fonte sobre a tela' },
            { gesture: 'Shift + arrastar', label: 'Mover em linha reta; ao redimensionar, manter a proporção' },
            { gesture: 'Alt + arrastar', label: 'Duplicar ao mover; ao redimensionar, a partir do centro' },
            { gesture: 'Ctrl + arrastar', label: 'Mover sem trocar de contêiner e sem encaixes' },
            { gesture: 'Ctrl + rolagem', label: 'Aproximar no ponteiro (a rolagem simples desloca a vista)' },
            { gesture: 'Duplo clique', label: 'Entrar no quadro ou editar o texto' },
        ],
    },
];
