import type { DocsSectionId } from '../docs-routes';
import type { DocsIconId } from './docs-icons';
export interface DocsSection {
    readonly id: DocsSectionId;
    readonly label: string;
    readonly title: string;
    readonly description: string;
    readonly icon: DocsIconId;
    readonly folder: string;
}
export const DOCS_SECTIONS: readonly DocsSection[] = [
    {
        id: 'manual',
        label: 'Manual',
        title: 'Documentação da Helix Engine',
        description: 'Tudo o que a engine faz, sistema por sistema: o editor, a cena, a renderização, a física, o terreno, a interface, o áudio, os efeitos e o scripting.',
        icon: 'book',
        folder: 'manual',
    },
    {
        id: 'tutorial',
        label: 'Tutoriais',
        title: 'Tutoriais',
        description: 'Aprenda fazendo: do primeiro jogo em dez minutos até compilar e distribuir, em capítulos curtos que constroem um sobre o outro.',
        icon: 'graduation',
        folder: 'tutorial',
    },
    {
        id: 'referencia',
        label: 'Referência da API',
        title: 'Referência da API',
        description: 'O namespace `helix` membro a membro: assinaturas, campos, eventos e o que cada um faz, igual em todas as linguagens.',
        icon: 'braces',
        folder: 'referencia',
    },
];
export function docsSection(id: DocsSectionId): DocsSection {
    const found = DOCS_SECTIONS.find((section) => section.id === id);
    if (!found)
        throw new Error(`Seção da documentação desconhecida: ${id}`);
    return found;
}
