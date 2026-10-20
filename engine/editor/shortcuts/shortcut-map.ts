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
            { keys: ['Arrastar arquivos'], label: 'Soltar no viewport para abrir a janela de importação' },
            { keys: ['Esc'], label: 'Cancelar a importação em andamento' },
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
            { keys: ['1', '…', '7'], label: 'Elevar, Suavizar, Achatar, Ruído, Terraço, Erosão, Pintar' },
            { keys: ['[', ']'], label: 'Diminui / aumenta o raio do pincel (Shift: dobra)' },
            { keys: ['Esc'], label: 'Cancela a pincelada em andamento' },
        ],
    },
    {
        title: 'Seleção',
        items: [
            { keys: ['F'], label: 'Enquadrar a seleção' },
            { keys: ['F2'], label: 'Renomear' },
            { keys: ['H'], label: 'Ocultar / mostrar' },
            { keys: ['Esc'], label: 'Limpar seleção' },
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
