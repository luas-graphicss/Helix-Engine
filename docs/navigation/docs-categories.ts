import type { DocsSectionId } from '../docs-routes';
import type { DocsIconId } from './docs-icons';
export interface DocsCategory {
    readonly id: string;
    readonly section: DocsSectionId;
    readonly title: string;
    readonly description: string;
    readonly icon: DocsIconId;
}
export const DOCS_CATEGORIES: readonly DocsCategory[] = [
    { id: 'visao-geral', section: 'manual', title: 'Visão geral', description: 'O que é a engine, o que ela exige do navegador, os conceitos que aparecem em toda parte e a tela inicial.', icon: 'compass' },
    { id: 'editor', section: 'manual', title: 'Editor', description: 'Menus, viewport, painéis, ferramentas, simulação, salvamento e os atalhos de teclado.', icon: 'layout' },
    { id: 'configuracao', section: 'manual', title: 'Configuração', description: 'As preferências da engine, as funcionalidades beta e o armazenamento local dos seus jogos.', icon: 'settings' },
    { id: 'cena', section: 'manual', title: 'Cena e atores', description: 'Atores, hierarquia, transformações, primitivas, operações booleanas e prefabs.', icon: 'boxes' },
    { id: 'renderizacao', section: 'manual', title: 'Renderização', description: 'Materiais, luzes, céu, pós-processamento, qualidade, desempenho e shaders personalizados.', icon: 'sun' },
    { id: 'fisica', section: 'manual', title: 'Física', description: 'Mundo físico, corpos rígidos, materiais físicos, juntas, campos de força, consultas e contatos.', icon: 'atom' },
    { id: 'terreno', section: 'manual', title: 'Terreno', description: 'Criar, esculpir, pintar camadas, semear grama e configurar a água.', icon: 'mountain' },
    { id: 'personagem-e-animacao', section: 'manual', title: 'Personagem e animação', description: 'O personagem jogável, a câmera em terceira pessoa, clipes, esqueletos, retarget e IK.', icon: 'person' },
    { id: 'interface', section: 'manual', title: 'Interface (GUI)', description: 'O designer de telas, os elementos, o layout, a aparência, as superfícies 3D e o HUD do jogo.', icon: 'window' },
    { id: 'audio', section: 'manual', title: 'Áudio', description: 'Mixer, fontes 3D, zonas com reverberação e o editor de clipes.', icon: 'audio' },
    { id: 'vfx', section: 'manual', title: 'Efeitos visuais', description: 'O editor de partículas, emissores, módulos e os templates prontos.', icon: 'sparkles' },
    { id: 'ativos', section: 'manual', title: 'Ativos e importação', description: 'A biblioteca, os formatos de modelo aceitos e as mídias que acompanham o jogo.', icon: 'folder' },
    { id: 'scripting', section: 'manual', title: 'Scripting', description: 'Linguagens, editor de código, ciclo de vida, modelos, módulos e multiplayer.', icon: 'code' },
    { id: 'distribuicao', section: 'manual', title: 'Compilar e distribuir', description: 'Do jogo no navegador ao executável para Windows, macOS e Linux, pronto para as lojas.', icon: 'package' },
    { id: 'primeiros-passos', section: 'tutorial', title: 'Primeiros passos', description: 'Abra a engine, crie um jogo a partir de um template e aprenda a se mover no editor.', icon: 'rocket' },
    { id: 'construindo-o-mundo', section: 'tutorial', title: 'Construindo o mundo', description: 'Monte um nível com primitivas, dê materiais e luz a ele, esculpa um terreno e coloque um personagem jogável.', icon: 'hammer' },
    { id: 'programando', section: 'tutorial', title: 'Programando', description: 'Do primeiro script a plataformas, coletáveis, eventos e um multiplayer básico.', icon: 'code' },
    { id: 'midia-e-polimento', section: 'tutorial', title: 'Mídia e polimento', description: 'HUD, som, partículas e animação: o que transforma um protótipo num jogo.', icon: 'wand' },
    { id: 'publicando', section: 'tutorial', title: 'Publicando', description: 'Compile o jogo para computador e prepare a pasta para a Steam, o itch.io ou o seu site.', icon: 'package' },
    { id: 'nucleo', section: 'referencia', title: 'Núcleo', description: 'Ciclo de vida, contexto, tempo, console, eventos, propriedades expostas, módulos e matemática.', icon: 'cpu' },
    { id: 'mundo', section: 'referencia', title: 'Mundo e cena', description: 'Cena, transformações, malhas, CSG, materiais, texturas, luzes, câmera e céu.', icon: 'boxes' },
    { id: 'graficos', section: 'referencia', title: 'Gráficos', description: 'Opções do frame, estatísticas, passes, acesso bruto ao WebGL2, pós-processamento e shaders.', icon: 'aperture' },
    { id: 'simulacao', section: 'referencia', title: 'Simulação', description: 'Física, corpos, juntas, campos de força, personagem, jogador e terreno.', icon: 'atom' },
    { id: 'midia', section: 'referencia', title: 'Interface e mídia', description: 'GUI, áudio, animação e efeitos visuais.', icon: 'window' },
    { id: 'jogo', section: 'referencia', title: 'Jogo e dados', description: 'Entrada, ativos, projeto, saves, modo play e rede.', icon: 'gamepad' },
    { id: 'ferramentas', section: 'referencia', title: 'Editor', description: 'A API disponível só dentro do editor, para scripts de ferramenta.', icon: 'wrench' },
];
export function categoriesOf(section: DocsSectionId): DocsCategory[] {
    return DOCS_CATEGORIES.filter((category) => category.section === section);
}
export function findCategory(section: DocsSectionId, id: string): DocsCategory | null {
    return DOCS_CATEGORIES.find((category) => category.section === section && category.id === id) ?? null;
}
