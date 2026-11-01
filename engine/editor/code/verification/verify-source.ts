import type { EditorSession } from '@/engine/editor/session/editor-session';
import type { CompileDiagnostic } from '@/engine/scripting/compiler/compile-types';
import type { ScriptSourceInput } from '@/engine/scripting/compiler/script-compiler';
import { compileCss, compileHtml, compileJson, compileSvg, compileXml, type WebCompileOutput } from '@/engine/scripting/compiler/web-compiler';
import { ensureLanguageEngine, isForeignLanguage } from '@/engine/scripting/languages/language-engine';
import { compileToml } from '@/engine/scripting/languages/toml/toml-compiler';
import { scriptFileName } from '@/engine/scripting/script-document';
import { scriptLanguage, type ScriptLanguageId } from '@/engine/scripting/script-languages';
export type VerifyOutcome = {
    readonly status: 'ok';
    readonly detail: string;
    readonly diagnostics: readonly CompileDiagnostic[];
} | {
    readonly status: 'unavailable';
    readonly detail: string;
};
export type VerifierCost = 'instant' | 'heavy' | 'remote' | 'none';
const REMOTE: ReadonlySet<ScriptLanguageId> = new Set<ScriptLanguageId>(['rust', 'go', 'zig', 'java', 'kotlin', 'swift', 'dart', 'haxe']);
const HEAVY: ReadonlySet<ScriptLanguageId> = new Set<ScriptLanguageId>(['c', 'cpp']);
const WEB: ReadonlySet<ScriptLanguageId> = new Set<ScriptLanguageId>(['html', 'css', 'svg', 'json', 'toml', 'xml']);
export function verifierCost(language: ScriptLanguageId): VerifierCost {
    if (REMOTE.has(language))
        return 'remote';
    if (HEAVY.has(language))
        return 'heavy';
    if (language === 'typescript' || language === 'javascript' || WEB.has(language) || isForeignLanguage(language))
        return 'instant';
    return 'none';
}
const WEB_DETAIL: Record<string, string> = { html: 'HTML (parse5)', css: 'CSS (css-tree)', svg: 'SVG (navegador)', json: 'JSON', toml: 'TOML 1.0', xml: 'XML (navegador)' };
function verifyWeb(language: ScriptLanguageId, source: string): VerifyOutcome {
    let output: WebCompileOutput;
    switch (language) {
        case 'html':
            output = compileHtml(source);
            break;
        case 'css':
            output = compileCss(source);
            break;
        case 'svg':
            output = compileSvg(source);
            break;
        case 'json':
            output = compileJson(source);
            break;
        case 'xml':
            output = compileXml(source);
            break;
        default:
            output = compileToml(source);
    }
    return { status: 'ok', detail: WEB_DETAIL[language] ?? scriptLanguage(language).label, diagnostics: output.diagnostics };
}
async function verifyModule(session: EditorSession, input: ScriptSourceInput): Promise<VerifyOutcome> {
    const { compiler } = session.scripts;
    const project = await compiler.ensureProject();
    compiler.updateLiveSource(input);
    const check = await project.check(input.assetId);
    const diagnostics = [...check.diagnostics, ...compiler.dependencyDiagnostics(check.dependencies, input)];
    return { status: 'ok', detail: `TypeScript ${compiler.typescriptVersion ?? ''}`.trim(), diagnostics };
}
async function verifyForeign(session: EditorSession, input: ScriptSourceInput): Promise<VerifyOutcome> {
    const { compiler } = session.scripts;
    const label = scriptLanguage(input.language).label;
    let engine;
    try {
        engine = await ensureLanguageEngine(input.language);
    }
    catch (cause) {
        return { status: 'unavailable', detail: `${label}: ${cause instanceof Error ? cause.message : String(cause)}` };
    }
    compiler.updateLiveSource(input);
    const output = await engine.compile({
        assetId: input.assetId,
        name: input.name,
        file: scriptFileName(input.name, input.language),
        source: input.source,
        siblings: compiler.siblingsOf(input.assetId, engine.languages),
    });
    const diagnostics = [...output.diagnostics, ...compiler.dependencyDiagnostics(output.dependencies, input)];
    return { status: 'ok', detail: engine.version ? `${engine.label} ${engine.version}` : engine.label, diagnostics };
}
export async function verifySource(session: EditorSession, input: ScriptSourceInput): Promise<VerifyOutcome> {
    const { language } = input;
    if (WEB.has(language))
        return verifyWeb(language, input.source);
    if (language === 'typescript' || language === 'javascript')
        return verifyModule(session, input);
    if (isForeignLanguage(language))
        return verifyForeign(session, input);
    return { status: 'unavailable', detail: `${scriptLanguage(language).label} não tem verificador nesta versão da engine` };
}
