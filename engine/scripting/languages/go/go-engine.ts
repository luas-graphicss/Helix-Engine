import type { ScriptLanguageEngine } from '../language-engine';
import { NativeWasmEngine } from '../native/native-wasm-engine';
import { requireSpecifiers } from '../native/source-scan';
import { GO_FLAVOR } from '../native/wasm-flavors';
const REQUIRE_CALL = /helix\.Require/;
export function goDependencies(source: string): string[] {
    return requireSpecifiers(source, REQUIRE_CALL);
}
let shared: NativeWasmEngine | null = null;
export function goEngine(): ScriptLanguageEngine {
    if (!shared)
        shared = new NativeWasmEngine({ language: 'go', label: 'Go', flavor: GO_FLAVOR, dependenciesOf: goDependencies });
    return shared;
}
