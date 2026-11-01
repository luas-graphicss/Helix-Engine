import { HOOK_NAMES, hookAliases } from '../foreign-values';
export const PHP_KIND_KEY = '@hx';
export const PHP_SCRIPT_DIR = '/helix/scripts/';
export const PHP_PRELUDE_FILE = 'php-wasm run script';
const PHP_HOST_NAME = 'shared';
export const PHP_INI = ['display_errors=stderr', 'log_errors=0', 'html_errors=0', 'error_reporting=E_ALL', 'memory_limit=256M', 'max_execution_time=0', 'serialize_precision=-1', 'precision=17', 'zend.assertions=1', 'assert.exception=1'].join('\n');
export function phpPreludeSource(): string {
    const hooks = HOOK_NAMES.map((name) => `'${name}' => [${hookAliases(name)
        .map((alias) => `'${alias}'`)
        .join(', ')}]`).join(', ');
    return String.raw `<?php
`;
}
