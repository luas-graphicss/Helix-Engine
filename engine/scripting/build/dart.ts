import 'server-only';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { CompileDiagnostic } from '../compiler/compile-types';
import { parseDartOutput, type DartDiagnostic } from './dart-diagnostics';
import { restrictSourceMapTo, shiftGeneratedLines } from './java-source-map';
import { controlledGlobalDeclaration, shadowedGlobalsBlock } from './js-module-globals';
import { run } from './process';
import { toolchain } from './toolchains';
import { sdkSourceDir, withWorkspace } from './workspace';
export interface DartBuildOutput {
    readonly ok: boolean;
    readonly js: string | null;
    readonly sourceMap: string | null;
    readonly diagnostics: readonly CompileDiagnostic[];
    readonly toolchain: string;
}
export interface DartSibling {
    readonly file: string;
    readonly source: string;
}
const DART2JS_TIMEOUT = 180000;
const BOOT_FILE = '__helix_boot.dart';
const OUTPUT_FILE = 'script.js';
const HOOK_NAMES = ['onLoad', 'onStart', 'onUpdate', 'onFixedUpdate', 'onLateUpdate', 'onRender', 'onEnable', 'onDisable', 'onStop', 'onDestroy', 'onBeforeHotReload', 'onHotReload', 'onCollisionBegin', 'onCollisionStay', 'onCollisionEnd', 'onTriggerEnter', 'onTriggerStay', 'onTriggerExit'];
const SCRIPT_CLASS = /\bclass\s+([A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\s+extends\s+(?:[\w$]+\.)?Script\b/;
const HOOK_DECLARATION = /\b(?:void|dynamic|Object\??|Future<\s*void\s*>|FutureOr<\s*void\s*>)\s+(on[A-Z]\w*)\s*\(/g;
const DART2JS_FLAGS = ['-O2', '--no-minify'];
export async function buildDart(file: string, source: string, siblings: readonly DartSibling[] = []): Promise<DartBuildOutput> {
    const dart = await toolchain('dart');
    const compileFile = dartFileFor(file);
    return withWorkspace('dart', async (dir) => {
        const out = path.join(dir, 'out');
        await Promise.all([mkdir(out), mkdir(path.join(dir, '.dart_tool'))]);
        await writeFile(path.join(dir, '.dart_tool', 'package_config.json'), packageConfig(), 'utf8');
        await writeFile(path.join(dir, compileFile), source, 'utf8');
        for (const sibling of siblings) {
            const siblingFile = dartFileFor(sibling.file);
            if (sibling.file !== file && siblingFile !== compileFile && siblingFile !== BOOT_FILE)
                await writeFile(path.join(dir, siblingFile), sibling.source, 'utf8');
        }
        const boot = bootSource(source, compileFile);
        await writeFile(path.join(dir, BOOT_FILE), boot.code, 'utf8');
        const result = await run(dart.dart, ['compile', 'js', ...DART2JS_FLAGS, '-o', path.join('out', OUTPUT_FILE), BOOT_FILE], { cwd: dir, env: dart.env, timeoutMs: DART2JS_TIMEOUT });
        const diagnostics: CompileDiagnostic[] = [...boot.diagnostics, ...translateBootErrors(parseDartOutput(`${result.stderr}\n${result.stdout}`, compileFile, { failed: result.code !== 0 }), boot)];
        if (result.timedOut)
            diagnostics.push(toolchainError('O dart2js demorou demais e foi interrompido; tente de novo.'));
        if (result.code !== 0) {
            if (!diagnostics.some((diagnostic) => diagnostic.severity === 'error'))
                diagnostics.push(toolchainError(`O dart2js terminou com código ${result.code ?? result.signal}:\n${result.stderr.trim() || result.stdout.trim() || 'sem saída'}`));
            return { ok: false, js: null, sourceMap: null, diagnostics, toolchain: dart.version };
        }
        const [js, map] = await Promise.all([readFile(path.join(out, OUTPUT_FILE), 'utf8'), readFile(path.join(out, `${OUTPUT_FILE}.map`), 'utf8').catch(() => null)]);
        const wrapped = wrapModule(js);
        return {
            ok: true,
            js: wrapped.code,
            sourceMap: map ? shiftGeneratedLines(restrictSourceMapTo(map, compileFile), wrapped.prefixLines) : null,
            diagnostics,
            toolchain: dart.version,
        };
    });
}
export function dartFileFor(file: string): string {
    const stem = file
        .replace(/\.[^.]+$/, '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z0-9_]/g, '_');
    const named = /^[0-9]/.test(stem) ? `_${stem}` : stem || 'script';
    return `${named.toLowerCase() === BOOT_FILE.replace(/\.dart$/, '') ? 'script' : named}.dart`;
}
function packageConfig(): string {
    const root = pathToFileURL(sdkSourceDir('dart')).href;
    return JSON.stringify({ configVersion: 2, packages: [{ name: 'helix', rootUri: root.endsWith('/') ? root : `${root}/`, packageUri: 'lib/', languageVersion: '3.3' }] });
}
interface BootExport {
    readonly name: string;
    readonly line: number;
    readonly bootLines: readonly [
        number,
        number
    ];
}
interface Boot {
    readonly code: string;
    readonly hasScript: boolean;
    readonly scriptClass: string | null;
    readonly scriptClassLine: number;
    readonly exports: readonly BootExport[];
    readonly diagnostics: readonly CompileDiagnostic[];
}
function bootSource(source: string, compileFile: string): Boot {
    const clean = blankDart(source);
    const classMatch = SCRIPT_CLASS.exec(clean);
    const scriptClass = classMatch?.[1] ?? null;
    const scriptClassLine = classMatch ? lineOf(source, classMatch.index) : 1;
    const hooks = new Set<string>();
    for (const match of clean.matchAll(HOOK_DECLARATION))
        if (HOOK_NAMES.includes(match[1]))
            hooks.add(match[1]);
    const lines = ['import \'dart:js_interop\';', 'import \'dart:js_interop_unsafe\';', 'import \'package:helix/helix.dart\' as helix;', `import '${compileFile}' as script;`, '', 'void main() {', '  final module = JSObject();'];
    if (scriptClass)
        lines.push(`  module['boot'] = ((JSObject inject) => helix.Runtime.boot(script.${scriptClass}(), inject, '${Array.from(hooks).join(',')}')).toJS;`);
    lines.push('  final exports = JSObject();');
    const exports: BootExport[] = [];
    const diagnostics: CompileDiagnostic[] = [];
    for (const declared of topLevelFunctions(clean)) {
        const generated = exportSource(declared);
        if ('problem' in generated) {
            diagnostics.push({ severity: 'warning', message: `A função ${declared.name} não fica disponível aos outros scripts: ${generated.problem}`, line: declared.line, column: 1, code: 'dart-export', source: 'Dart' });
            continue;
        }
        const first = lines.length + 1;
        lines.push(...generated.lines);
        exports.push({ name: declared.name, line: declared.line, bootLines: [first, lines.length] });
        lines.push(`  exports['${declared.name}'] = export_${declared.name}.toJS;`);
    }
    lines.push('  module[\'exports\'] = exports;', '  helix.Runtime.register(module);', '}', '');
    return { code: lines.join('\n'), hasScript: scriptClass !== null, scriptClass, scriptClassLine, exports, diagnostics };
}
function lineOf(source: string, index: number): number {
    let line = 1;
    for (let i = 0; i < index && i < source.length; i++)
        if (source.charCodeAt(i) === 10)
            line++;
    return line;
}
function translateBootErrors(diagnostics: DartDiagnostic[], boot: Boot): CompileDiagnostic[] {
    return diagnostics.map((reported) => {
        const { file, reportedLine, ...diagnostic } = reported;
        if (file !== BOOT_FILE)
            return diagnostic;
        const message = diagnostic.message.replace(/ \(em __helix_boot\.dart\)$/, '');
        const exported = boot.exports.find((entry) => reportedLine >= entry.bootLines[0] && reportedLine <= entry.bootLines[1]);
        if (exported)
            return { ...diagnostic, line: exported.line, column: 1, message: `A função ${exported.name} não pôde ser exportada para os outros scripts: ${message}` };
        if (boot.scriptClass)
            return { ...diagnostic, line: boot.scriptClassLine, column: 1, message: `A engine não conseguiu instanciar a classe ${boot.scriptClass} (ela precisa ser pública, não abstrata e ter um construtor sem parâmetros): ${message}` };
        return { ...diagnostic, message };
    });
}
interface Parameter {
    readonly type: string;
    readonly name: string;
    readonly optional: boolean;
    readonly named: boolean;
}
interface TopLevelFunction {
    readonly name: string;
    readonly returnType: string;
    readonly parameters: readonly Parameter[];
    readonly line: number;
}
const RESERVED_NAMES = new Set(['main', 'if', 'for', 'while', 'switch', 'catch', 'return', 'else', 'do', 'try', 'assert', 'throw', 'new', 'super', 'this', 'get', 'set', 'await', 'yield']);
const NOT_RETURN_TYPES = new Set(['class', 'enum', 'extension', 'mixin', 'typedef', 'get', 'set', 'const', 'final', 'var', 'late', 'new', 'return', 'throw', 'await', 'yield', 'else', 'case', 'default', 'operator', 'external', 'static', 'abstract']);
const FUNCTION_HEADER = /(^|[;}])(\s*(?:@[\w.]+(?:\([^)]*\))?\s*)*)((?:[\w$]+(?:\.[\w$]+)?(?:<[^(){};]*?>)?\??\s+)?)([A-Za-z_$][\w$]*)\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)\s*(?:async\*?|sync\*)?\s*(?:=>|\{)/gm;
export function topLevelFunctions(clean: string): TopLevelFunction[] {
    const depth = braceDepths(clean);
    const found: TopLevelFunction[] = [];
    for (const match of clean.matchAll(FUNCTION_HEADER)) {
        const namePosition = match.index + match[1].length + match[2].length + match[3].length;
        if (depth[namePosition] !== 0)
            continue;
        const name = match[4];
        const returnType = match[3].trim();
        if (RESERVED_NAMES.has(name) || name.startsWith('_') || NOT_RETURN_TYPES.has(returnType))
            continue;
        found.push({ name, returnType: returnType.replace(/\s+/g, ''), parameters: parseParameters(match[5]), line: lineOf(clean, namePosition) });
    }
    return found;
}
function braceDepths(clean: string): Int32Array {
    const depths = new Int32Array(clean.length + 1);
    let depth = 0;
    for (let i = 0; i < clean.length; i++) {
        depths[i] = depth;
        const c = clean[i];
        if (c === '{')
            depth++;
        else if (c === '}')
            depth = Math.max(0, depth - 1);
    }
    depths[clean.length] = depth;
    return depths;
}
function parseParameters(text: string): Parameter[] {
    const parameters: Parameter[] = [];
    let optional = false;
    let named = false;
    for (const piece of splitTopLevel(text)) {
        let item = piece.trim();
        if (!item)
            continue;
        if (item.startsWith('[')) {
            optional = true;
            item = item.slice(1).trim();
        }
        else if (item.startsWith('{')) {
            named = true;
            item = item.slice(1).trim();
        }
        if (item.endsWith(']') || item.endsWith('}'))
            item = item.slice(0, -1).trim();
        item = item.replace(/\s*=.*$/s, '').replace(/\b(?:required|covariant|final)\s+/g, '').trim();
        if (!item)
            continue;
        const space = item.lastIndexOf(' ');
        const type = space >= 0 ? item.slice(0, space).replace(/\s+/g, '') : '';
        const name = space >= 0 ? item.slice(space + 1).trim() : item;
        parameters.push({ type, name, optional, named });
    }
    return parameters;
}
function splitTopLevel(text: string): string[] {
    const pieces: string[] = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (c === '<' || c === '(')
            depth++;
        else if (c === '>' || c === ')')
            depth = Math.max(0, depth - 1);
        else if (c === ',' && depth === 0) {
            pieces.push(text.slice(start, i));
            start = i + 1;
        }
    }
    pieces.push(text.slice(start));
    return pieces;
}
const SCALAR_CONVERSIONS: Record<string, string> = { double: '.number', num: '.number', int: '.integer', String: '.string', bool: '.boolean', Value: '', 'helix.Value': '', Vec3: '.vec3', 'helix.Vec3': '.vec3' };
const SUPPORTED_TYPES = 'double, int, num, String, bool, Value, Vec3, dynamic, listas e mapas deles';
function conversion(type: string, expr: string): string | null {
    const nullable = type.endsWith('?');
    const base = nullable ? type.slice(0, -1) : type;
    const wrap = (inner: string): string => (nullable ? `(${expr}.isNullish ? null : ${inner})` : inner);
    if (base in SCALAR_CONVERSIONS)
        return wrap(`${expr}${SCALAR_CONVERSIONS[base]}`);
    if (base === 'dynamic' || base === '' || base === 'Object')
        return nullable || base !== 'Object' ? `${expr}.dart` : `(${expr}.dart as Object)`;
    if (base === 'List' || base === 'Iterable')
        return wrap(`${expr}.items.map((e) => e.dart).toList()`);
    const list = /^(?:List|Iterable)<(.+)>$/.exec(base);
    if (list) {
        const inner = list[1];
        if (inner === 'dynamic' || inner === 'Object?' || inner === 'Object')
            return wrap(`${expr}.items.map((e) => e.dart${inner === 'Object' ? ' as Object' : ''}).toList()`);
        const item = conversion(inner, 'e');
        return item ? wrap(`${expr}.items.map((e) => ${item}).toList()`) : null;
    }
    if (base === 'Map' || /^Map<String,\s*(?:dynamic|Object\??)>$/.test(base))
        return wrap(`((${expr}.dart as Map?) ?? const {}).cast<String, Object?>()`);
    if (/^JS[A-Z]\w*(?:<.*>)?$/.test(base))
        return wrap(`(${expr}.raw as ${type})`);
    return null;
}
