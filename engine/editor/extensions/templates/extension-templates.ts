import { startupTemplateSource } from './sources/startup-template';
import { windowTemplateSource } from './sources/window-template';
export type ExtensionTemplateId = 'startup' | 'window';
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
];
