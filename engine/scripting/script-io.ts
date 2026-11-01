import { fileExtension } from '@/engine/assets/import/import-types';
import { createScriptDocument, isScriptRunContext, scriptFileName, scriptMimeType, type ScriptDocument, type ScriptRunContext } from './script-document';
import { isScriptLanguageId, scriptLanguage, scriptLanguageForExtension } from './script-languages';
export interface ScriptFileMetadata {
    readonly runContext?: ScriptRunContext | string;
    readonly entry?: boolean;
    readonly createdAt?: number;
    readonly language?: string;
}
export function normalizeLineEndings(source: string): string {
    return source.replace(/\r\n?/g, '\n');
}
export function scriptDocumentToFile(document: ScriptDocument): File {
    return new File([document.source], scriptFileName(document.name, document.language), { type: scriptMimeType(document.language) });
}
export async function readScriptDocument(file: File, metadata: ScriptFileMetadata = {}): Promise<ScriptDocument> {
    const language = isScriptLanguageId(metadata.language) ? scriptLanguage(metadata.language) : scriptLanguageForExtension(fileExtension(file.name));
    if (!language)
        throw new Error(`${file.name} não tem uma extensão de script reconhecida.`);
    const source = normalizeLineEndings(await file.text());
    const base = createScriptDocument({
        name: file.name.replace(/\.[^.]+$/, ''),
        language: language.id,
        source,
        runContext: isScriptRunContext(metadata.runContext) ? metadata.runContext : 'shared',
        entry: metadata.entry === true,
    });
    return typeof metadata.createdAt === 'number' && Number.isFinite(metadata.createdAt) ? { ...base, createdAt: metadata.createdAt } : base;
}
