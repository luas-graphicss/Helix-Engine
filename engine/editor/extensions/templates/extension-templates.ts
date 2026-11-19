import { gizmoTemplateSource } from './sources/gizmo-template';
import { inspectorTemplateSource } from './sources/inspector-template';
import { menuTemplateSource } from './sources/menu-template';
import { startupTemplateSource } from './sources/startup-template';
import { toolTemplateSource } from './sources/tool-template';
import { windowTemplateSource } from './sources/window-template';
export type ExtensionTemplateId = 'startup' | 'window' | 'menu' | 'inspector' | 'gizmo' | 'tool';
export interface ExtensionTemplate {
    readonly id: ExtensionTemplateId;
    readonly label: string;
    readonly description: string;
    readonly defaultName: string;
    readonly source: (tab: string) => string;
}
export const EXTENSION_TEMPLATES: readonly ExtensionTemplate[] = [
    { id: 'startup', label: 'Ao abrir o editor', description: 'Roda quando o projeto abre e reage à seleção.', defaultName: 'ExtensaoInicial', source: startupTemplateSource },
    { id: 'window', label: 'Janela', description: 'Um painel encaixável com campos e botões desenhados pelo script.', defaultName: 'JanelaFileira', source: windowTemplateSource },
    { id: 'menu', label: 'Item de menu', description: 'Comandos no menu principal e no menu de contexto dos atores, com atalho.', defaultName: 'MenuApoiarNoChao', source: menuTemplateSource },
    { id: 'inspector', label: 'Seção do inspetor', description: 'Campos próprios no Inspetor para os atores que você escolher.', defaultName: 'InspetorAltura', source: inspectorTemplateSource },
    { id: 'gizmo', label: 'Gizmo', description: 'Linhas e formas desenhadas no viewport para os atores ou para a cena.', defaultName: 'GizmoFrente', source: gizmoTemplateSource },
    { id: 'tool', label: 'Ferramenta do viewport', description: 'Um botão no trilho de ferramentas que recebe os cliques, desenha no viewport e mostra opções.', defaultName: 'FerramentaCarimbo', source: toolTemplateSource },
];
