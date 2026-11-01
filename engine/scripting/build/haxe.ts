import 'server-only';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CompileDiagnostic } from '../compiler/compile-types';
import { identifierFromName } from '../script-templates';
import { parseHaxeOutput, type HaxeDiagnostic } from './haxe-diagnostics';
import { restrictSourceMapTo, shiftGeneratedLines } from './java-source-map';
import { controlledGlobalDeclaration, shadowedGlobalsBlock } from './js-module-globals';
import { run } from './process';
import { toolchain } from './toolchains';
import { sdkSourceDir, withWorkspace } from './workspace';
export interface HaxeBuildOutput {
    readonly ok: boolean;
    readonly js: string | null;
    readonly sourceMap: string | null;
    readonly diagnostics: readonly CompileDiagnostic[];
    readonly toolchain: string;
}
export interface HaxeSibling {
    readonly file: string;
    readonly source: string;
}
const HAXE_TIMEOUT = 120000;
const BOOT_MODULE = 'HelixBoot';
const BOOT_FILE = `${BOOT_MODULE}.hx`;
const OUTPUT_FILE = 'script.js';
const GLOBAL_NAME = '__hxGlobal';
const HAXE_FLAGS = ['-D', 'js-es=6', '-D', `js-global=${GLOBAL_NAME}`, '-D', 'source-map', '-D', 'analyzer-optimize', '--dce', 'full', '-D', 'message.reporting=classic', '-D', 'message.no-color'];
export async function buildHaxe(file: string, source: string, siblings: readonly HaxeSibling[] = []): Promise<HaxeBuildOutput> {
    const haxe = await toolchain('haxe');
    const moduleName = haxeModuleFor(file);
    return withWorkspace('haxe', async (dir) => {
        const src = path.join(dir, 'src');
        const out = path.join(dir, 'out');
        await Promise.all([mkdir(src), mkdir(out)]);
        await writeFile(path.join(src, `${moduleName}.hx`), source, 'utf8');
        for (const sibling of siblings) {
            const siblingModule = haxeModuleFor(sibling.file);
            if (sibling.file !== file && siblingModule !== moduleName)
                await writeFile(path.join(src, `${siblingModule}.hx`), sibling.source, 'utf8');
        }
        await writeFile(path.join(src, BOOT_FILE), bootSource(moduleName), 'utf8');
        const result = await run(haxe.haxe, ['-cp', 'src', '-cp', sdkSourceDir('haxe'), '-main', BOOT_MODULE, '-js', path.join('out', OUTPUT_FILE), ...HAXE_FLAGS], { cwd: dir, env: haxe.env, timeoutMs: HAXE_TIMEOUT });
        const diagnostics: CompileDiagnostic[] = translateBootErrors(parseHaxeOutput(`${result.stderr}\n${result.stdout}`, `${moduleName}.hx`, { failed: result.code !== 0 }), moduleName);
        if (result.timedOut)
            diagnostics.push(toolchainError('O compilador Haxe demorou demais e foi interrompido; tente de novo.'));
        if (result.code !== 0) {
            if (!diagnostics.some((diagnostic) => diagnostic.severity === 'error'))
                diagnostics.push(toolchainError(`O compilador Haxe terminou com código ${result.code ?? result.signal}:\n${result.stderr.trim() || result.stdout.trim() || 'sem saída'}`));
            return { ok: false, js: null, sourceMap: null, diagnostics, toolchain: haxe.version };
        }
        const [js, map] = await Promise.all([readFile(path.join(out, OUTPUT_FILE), 'utf8'), readFile(path.join(out, `${OUTPUT_FILE}.map`), 'utf8').catch(() => null)]);
        const wrapped = wrapModule(js);
        return {
            ok: true,
            js: wrapped.code,
            sourceMap: map ? shiftGeneratedLines(restrictSourceMapTo(map, `${moduleName}.hx`), wrapped.prefixLines) : null,
            diagnostics,
            toolchain: haxe.version,
        };
    });
}
export function haxeModuleFor(file: string): string {
    const name = identifierFromName(file.replace(/\.[^.]+$/, ''));
    return name === BOOT_MODULE ? `${BOOT_MODULE}Script` : name;
}
function bootSource(moduleName: string): string {
    return ['// Gerado pelo serviço de build da Helix Engine.', `class ${BOOT_MODULE} {`, '\tstatic function main() {', `\t\thelix.Runtime.register(helix.Boot.module("${moduleName}"));`, '\t}', '}', ''].join('\n');
}
const SDK_FILES = new Set([BOOT_FILE, 'Boot.hx', 'Script.hx', 'Helix.hx', 'Vec3.hx', 'Runtime.hx']);
function translateBootErrors(diagnostics: HaxeDiagnostic[], moduleName: string): CompileDiagnostic[] {
    return diagnostics.map((reported) => {
        const { file, reportedLine, ...diagnostic } = reported;
        if (!SDK_FILES.has(file))
            return diagnostic;
        const message = diagnostic.message.replace(/ \(em [\w.]+\.hx\)$/, '');
        if (/does not define type|Type not found/.test(message)) {
            return { ...diagnostic, line: 1, column: 1, message: `O arquivo não declara nenhum tipo chamado ${moduleName}: a classe principal de um script Haxe tem o nome do script (class ${moduleName} extends Script).` };
        }
        return { ...diagnostic, line: 1, column: 1, message: `A engine não conseguiu ligar este script: ${message}` };
    });
}
const PRELUDE = [controlledGlobalDeclaration(GLOBAL_NAME), shadowedGlobalsBlock(GLOBAL_NAME), ''].join('\n');
const EPILOGUE = '\n}\n';
function wrapModule(js: string): {
    code: string;
    prefixLines: number;
} {
    const body = js.replace(/^\/\/# sourceMappingURL=.*$/m, '');
    return { code: `${PRELUDE}${body}${EPILOGUE}`, prefixLines: PRELUDE.split('\n').length - 1 };
}
function toolchainError(message: string): CompileDiagnostic {
    return { severity: 'error', message, line: 1, column: 1, code: 'toolchain', source: 'Haxe' };
}
