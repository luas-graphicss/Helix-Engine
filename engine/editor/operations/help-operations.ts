import { docsHomePath, docsSectionPath } from '@/docs/docs-routes';
function openHelpTab(path: string): void {
    window.open(path, '_blank', 'noopener,noreferrer');
}
export function openDocumentation(): void {
    openHelpTab(docsHomePath());
}
export function openTutorial(): void {
    openHelpTab(docsSectionPath('tutorial'));
}
export function openApiReference(): void {
    openHelpTab(docsSectionPath('referencia'));
}
