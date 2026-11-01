import { countScriptLines, scriptByteLength, type ScriptDocument } from '@/engine/scripting/script-document';
import type { ScriptAssetDetails } from './asset-types';
export function scriptAssetDetails(document: ScriptDocument): ScriptAssetDetails {
    return {
        kind: 'script',
        language: document.language,
        lines: countScriptLines(document.source),
        bytes: scriptByteLength(document.source),
        runContext: document.runContext,
        entry: document.entry,
        createdAt: document.createdAt,
    };
}
