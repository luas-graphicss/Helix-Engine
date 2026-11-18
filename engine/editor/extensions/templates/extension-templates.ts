import { startupTemplateSource } from './sources/startup-template';
export type ExtensionTemplateId = 'startup';
export interface ExtensionTemplate {
    readonly id: ExtensionTemplateId;
    readonly label: string;
    readonly description: string;
    readonly defaultName: string;
    readonly source: (tab: string) => string;
}
export const EXTENSION_TEMPLATES: readonly ExtensionTemplate[] = [
    { id: 'startup', label: 'Ao abrir o editor', description: 'Roda quando o projeto abre e reage à seleção.', defaultName: 'ExtensaoInicial', source: startupTemplateSource },
];
