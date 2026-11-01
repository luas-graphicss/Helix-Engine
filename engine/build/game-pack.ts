import JSZip from 'jszip';
import { PROJECT_STORES } from '@/engine/core/storage/project-database';
import { saveProjectNow } from '@/engine/editor/operations/project-operations';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { projectRecordOf } from '@/engine/project/project-context';
import { exportProjectFile } from '@/engine/project/project-file';
import type { CompiledScript } from '@/engine/scripting/compiler/compile-types';
import { collectScriptSources } from '@/engine/scripting/compiler/project-sources';
import type { ScriptLanguageId } from '@/engine/scripting/script-languages';
export interface GamePack {
    readonly blob: Blob;
    readonly removedServerScripts: readonly string[];
    readonly assetCount: number;
    readonly referenceText: string;
}
interface PackedAssetRecord {
    id?: string;
    name?: string;
    kind?: string;
    details?: {
        runContext?: string;
    };
}
interface PackedAssetFileRecord {
    assetId?: string;
}
function indexOf(path: string): string {
    return path.replace(/\.json$/, '');
}
export async function buildGamePack(session: EditorSession, onProgress: (label: string, fraction: number) => void): Promise<GamePack> {
    const record = projectRecordOf(session.project);
    if (!record)
        throw new Error('O projeto aberto não está no registro deste navegador.');
    onProgress('Salvando o projeto', 0.05);
    await saveProjectNow(session);
    const exported = await exportProjectFile(record, (label, fraction) => onProgress(label, 0.1 + fraction * 0.5));
    onProgress('Removendo o lado do servidor', 0.65);
    const zip = await JSZip.loadAsync(exported);
    const serverIds = new Set<string>();
    const removedServerScripts: string[] = [];
    const referenceParts: string[] = [];
    let assetCount = 0;
    const assetPattern = new RegExp(`^${PROJECT_STORES.assets}/\\d+\\.json$`);
    const filePattern = new RegExp(`^${PROJECT_STORES.assetFiles}/\\d+\\.json$`);
    const materialPattern = new RegExp(`^${PROJECT_STORES.materials}/\\d+\\.json$`);
    for (const [path, file] of Object.entries(zip.files)) {
        if (!assetPattern.test(path))
            continue;
        const text = await file.async('string');
        const asset = JSON.parse(text) as PackedAssetRecord;
        if (asset.kind === 'script' && asset.details?.runContext === 'server') {
            if (asset.id)
                serverIds.add(asset.id);
            removedServerScripts.push(asset.name ?? asset.id ?? path);
            zip.remove(path);
            zip.remove(indexOf(path));
            continue;
        }
        assetCount++;
        referenceParts.push(text);
    }
    for (const [path, file] of Object.entries(zip.files)) {
        if (!filePattern.test(path))
            continue;
        const fileRecord = JSON.parse(await file.async('string')) as PackedAssetFileRecord;
        if (fileRecord.assetId && serverIds.has(fileRecord.assetId)) {
            zip.remove(path);
            zip.remove(indexOf(path));
        }
    }
    for (const [path, file] of Object.entries(zip.files)) {
        if (materialPattern.test(path))
            referenceParts.push(await file.async('string'));
    }
    const scene = zip.file('scene/scene.json');
    if (scene)
        referenceParts.push(await scene.async('string'));
    onProgress('Gravando o pacote do jogo', 0.85);
    const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/x-helix-project' });
    onProgress('Pacote pronto', 1);
    return { blob, removedServerScripts, assetCount, referenceText: referenceParts.join('\n') };
}
export interface PrecompiledScripts {
    readonly scripts: readonly CompiledScript[];
    readonly skipped: number;
    readonly withErrors: readonly string[];
    readonly durationMs: number;
}
export async function precompileClientScripts(session: EditorSession): Promise<PrecompiledScripts> {
    const { inputs, skipped } = await collectScriptSources(session);
    const result = await session.scripts.compiler.compile(inputs);
    const scripts = result.compiled.filter((script) => script.runContext !== 'server');
    return {
        scripts,
        skipped: skipped.length,
        withErrors: scripts.filter((script) => script.errorCount > 0).map((script) => script.name),
        durationMs: result.durationMs,
    };
}
const VENDOR_BY_LANGUAGE: Partial<Record<ScriptLanguageId, string>> = {
    lua: 'vendor/wasmoon/',
    python: 'vendor/pyodide/',
    ruby: 'vendor/ruby/',
    php: 'vendor/php/',
    c: 'vendor/clang/',
    cpp: 'vendor/clang/',
    wgsl: 'vendor/naga/',
    glsl: 'vendor/naga/',
};
export interface RuntimeAssetSelection {
    readonly paths: readonly string[];
    readonly bytes: number;
    readonly vendors: readonly string[];
}
export function selectRuntimeAssets(publicAssets: Record<string, number>, referenceText: string, scripts: readonly CompiledScript[]): RuntimeAssetSelection {
    const prefixes = new Set<string>(['smaa/']);
    const references = new Set<string>();
    for (const match of referenceText.matchAll(/\/(models|textures)\/[A-Za-z0-9_./-]+/g))
        references.add(match[0].slice(1));
    if (/xbot|"character"|"player"/i.test(referenceText))
        prefixes.add('models/xbot.glb');
    const vendors = new Set<string>();
    for (const script of scripts) {
        if (script.errorCount > 0 || (script.kind !== 'foreign' && script.kind !== 'shader'))
            continue;
        const vendor = VENDOR_BY_LANGUAGE[script.language];
        if (vendor)
            vendors.add(vendor);
    }
    for (const vendor of vendors)
        prefixes.add(vendor);
    const paths: string[] = [];
    let bytes = 0;
    for (const [path, size] of Object.entries(publicAssets)) {
        let wanted = false;
        for (const prefix of prefixes) {
            if (path === prefix || path.startsWith(prefix)) {
                wanted = true;
                break;
            }
        }
        if (!wanted) {
            for (const reference of references) {
                if (path === reference || path.startsWith(reference.endsWith('/') ? reference : `${reference}/`) || path.startsWith(reference.replace(/\.[a-z0-9]+$/i, '') + '.')) {
                    wanted = true;
                    break;
                }
            }
        }
        if (wanted) {
            paths.push(path);
            bytes += size;
        }
    }
    return { paths, bytes, vendors: Array.from(vendors, (vendor) => vendor.replace(/^vendor\/|\/$/g, '')) };
}
