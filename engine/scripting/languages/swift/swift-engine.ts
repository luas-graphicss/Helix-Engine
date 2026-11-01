import type { ScriptLanguageEngine } from '../language-engine';
import { NativeWasmEngine } from '../native/native-wasm-engine';
import { requireSpecifiers } from '../native/source-scan';
import { SWIFT_FLAVOR } from '../native/wasm-flavors';
const REQUIRE_CALL = /(?:Helix\.)?require/;
export function swiftDependencies(source: string): string[] {
    return requireSpecifiers(source, REQUIRE_CALL);
}
let shared: NativeWasmEngine | null = null;
export function swiftEngine(): ScriptLanguageEngine {
    if (!shared)
        shared = new NativeWasmEngine({ language: 'swift', label: 'Swift', flavor: SWIFT_FLAVOR, dependenciesOf: swiftDependencies });
    return shared;
}
