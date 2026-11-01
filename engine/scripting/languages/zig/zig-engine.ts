import type { ScriptLanguageEngine } from '../language-engine';
import { NativeWasmEngine } from '../native/native-wasm-engine';
import { requireSpecifiers } from '../native/source-scan';
import { ZIG_FLAVOR } from '../native/wasm-flavors';
const REQUIRE_CALL = /(?:helix\.)?require/;
export function zigDependencies(source: string): string[] {
    return requireSpecifiers(source, REQUIRE_CALL);
}
let shared: NativeWasmEngine | null = null;
export function zigEngine(): ScriptLanguageEngine {
    if (!shared)
        shared = new NativeWasmEngine({ language: 'zig', label: 'Zig', flavor: ZIG_FLAVOR, dependenciesOf: zigDependencies });
    return shared;
}
