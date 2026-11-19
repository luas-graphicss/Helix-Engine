export function startupTemplateSource(tab: string): string {
    return [
        'import helix from "helix"',
        '',
        'const editor = helix.editor',
        '',
        'export function onLoad() {',
        `${tab}if (!editor) return`,
        `${tab}helix.log.info("Extensão", "Carregada com o editor.")`,
        `${tab}editor.onSelectionChanged((selection) => {`,
        `${tab}${tab}helix.log.info("Extensão", \`\${selection.length} ator(es) na seleção.\`)`,
        `${tab}})`,
        '}',
        '',
    ].join('\n');
}
