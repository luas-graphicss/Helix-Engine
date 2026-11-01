import type { ScriptLanguageEngine } from '../language-engine';
import { NativeWasmEngine } from '../native/native-wasm-engine';
import { requireSpecifiers } from '../native/source-scan';
import { RUST_FLAVOR } from '../native/wasm-flavors';
const REQUIRE_CALL = /(?:helix::)?require/;
export function rustDependencies(source: string): string[] {
    return requireSpecifiers(source, REQUIRE_CALL);
}
let shared: NativeWasmEngine | null = null;
export function rustEngine(): ScriptLanguageEngine {
    if (!shared)
        shared = new NativeWasmEngine({ language: 'rust', label: 'Rust', flavor: RUST_FLAVOR, dependenciesOf: rustDependencies });
    return shared;
}
