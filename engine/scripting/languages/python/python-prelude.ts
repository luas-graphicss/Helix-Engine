import { HOOK_NAMES, hookAliases } from '../foreign-values';
export const PYTHON_PRELUDE_FILE = '<helix>';
export const PYTHON_KIND_KEY = '@hx';
const BLOCKED_MODULES = ['os', 'sys', 'js', 'pyodide', '_pyodide', '__main__', 'subprocess', 'importlib', 'ctypes', 'socket', 'threading', 'multiprocessing', 'signal', 'micropip', 'pathlib', 'shutil', 'tempfile', 'webbrowser', 'builtins', 'gc', 'code', 'codeop', 'pdb', 'runpy', 'pkgutil', 'zipimport', 'sysconfig', 'site'];
const BLOCKED_BUILTINS = ['input', 'open', 'exit', 'quit', 'help', 'breakpoint', 'copyright', 'credits', 'license'];
export function pythonPreludeSource(): string {
    const hooks = HOOK_NAMES.map((name) => `("${name}", (${hookAliases(name)
        .map((alias) => `"${alias}"`)
        .join(', ')}))`).join(', ');
    const blockedModules = BLOCKED_MODULES.map((name) => `"${name}"`).join(', ');
    const blockedBuiltins = BLOCKED_BUILTINS.map((name) => `"${name}"`).join(', ');
    return String.raw `
`;
}
