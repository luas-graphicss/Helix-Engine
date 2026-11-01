import { SCRIPT_LANGUAGES, type ScriptLanguage, type ScriptLanguageId } from '@/engine/scripting/script-languages';
import { cGame } from './languages/c';
import { cppGame } from './languages/cpp';
import { csharpGame } from './languages/csharp';
import { dartGame } from './languages/dart';
import { gdscriptGame } from './languages/gdscript';
import { goGame } from './languages/go';
import { haxeGame } from './languages/haxe';
import { javaGame } from './languages/java';
import { jsLikeGame } from './languages/javascript';
import { kotlinGame } from './languages/kotlin';
import { luaGame } from './languages/lua';
import { phpGame } from './languages/php';
import { pythonGame } from './languages/python';
import { rubyGame } from './languages/ruby';
import { rustGame } from './languages/rust';
import { swiftGame } from './languages/swift';
import { watGame } from './languages/wat';
import { zigGame } from './languages/zig';
import { POST_GLSL, POST_WGSL, SURFACE_GLSL, SURFACE_WGSL } from './shaders';
import { CONFIG_TOML, HUD_CSS, HUD_HTML, ICON_SVG } from './shared-assets';
import { DEBUG_NAMES, type DebugScriptSpec, type GameSources } from './types';
export type ShaderLanguageId = 'glsl' | 'wgsl';
export const SHADER_LANGUAGES: readonly ShaderLanguageId[] = ['glsl', 'wgsl'];
const GAMES: Partial<Record<ScriptLanguageId, () => GameSources>> = {
    javascript: () => jsLikeGame(false),
    typescript: () => jsLikeGame(true),
    lua: () => luaGame(false),
    luau: () => luaGame(true),
    python: () => pythonGame(),
    ruby: () => rubyGame(),
    php: () => phpGame(),
    gdscript: () => gdscriptGame(),
    csharp: () => csharpGame(),
    haxe: () => haxeGame(),
    c: () => cGame(),
    cpp: () => cppGame(),
    wat: () => watGame(),
    rust: () => rustGame(),
    go: () => goGame(),
    zig: () => zigGame(),
    swift: () => swiftGame(),
    java: () => javaGame(),
    kotlin: () => kotlinGame(),
    dart: () => dartGame(),
};
export function hasGame(language: ScriptLanguageId): boolean {
    return language in GAMES;
}
export function testableLanguages(): ScriptLanguage[] {
    return SCRIPT_LANGUAGES.filter((language) => hasGame(language.id) && language.compiler !== 'pending');
}
export function isShaderLanguage(language: ScriptLanguageId): language is ShaderLanguageId {
    return (SHADER_LANGUAGES as readonly string[]).includes(language);
}
export function otherShaderLanguage(language: ShaderLanguageId): ShaderLanguageId {
    return language === 'glsl' ? 'wgsl' : 'glsl';
}
export function shaderScripts(language: ShaderLanguageId): DebugScriptSpec[] {
    const glsl = language === 'glsl';
    return [
        { name: DEBUG_NAMES.post, language, role: 'shader', source: glsl ? POST_GLSL : POST_WGSL },
        { name: DEBUG_NAMES.surface, language, role: 'shader', source: glsl ? SURFACE_GLSL : SURFACE_WGSL },
    ];
}
export function gameScripts(language: ScriptLanguageId, shaders: ShaderLanguageId): DebugScriptSpec[] | null {
    const factory = GAMES[language];
    if (!factory)
        return null;
    const sources = factory();
    return [
        { name: DEBUG_NAMES.entry, language, role: 'entry', source: sources.entry },
        { name: DEBUG_NAMES.actor, language, role: 'actor', source: sources.actor },
        { name: DEBUG_NAMES.module, language, role: 'module', source: sources.module },
        { name: DEBUG_NAMES.hud, language: 'html', role: 'asset', source: HUD_HTML },
        { name: DEBUG_NAMES.style, language: 'css', role: 'asset', source: HUD_CSS },
        { name: DEBUG_NAMES.icon, language: 'svg', role: 'asset', source: ICON_SVG },
        { name: DEBUG_NAMES.config, language: 'toml', role: 'asset', source: CONFIG_TOML },
        ...shaderScripts(shaders),
    ];
}
