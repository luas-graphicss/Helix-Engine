const INTRINSICS = ['Object', 'Function', 'Array', 'Number', 'Boolean', 'String', 'Symbol', 'Date', 'Promise', 'RegExp', 'Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError', 'EvalError', 'URIError', 'JSON', 'Math', 'Reflect', 'Proxy', 'Map', 'Set', 'WeakMap', 'WeakSet', 'ArrayBuffer', 'DataView', 'Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array', 'encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'decodeURI', 'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'NaN', 'Infinity', 'undefined'];
const OPTIONAL_INTRINSICS = ['BigInt', 'BigInt64Array', 'BigUint64Array', 'WeakRef', 'FinalizationRegistry', 'AggregateError', 'Intl', 'TextEncoder', 'TextDecoder', 'structuredClone', 'performance', 'crypto', 'URL', 'URLSearchParams'];
const SANDBOX_GLOBALS = ['console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame'];
const HIDDEN_GLOBALS = ['document', 'navigator', 'location', 'MutationObserver', 'setImmediate'];
export function controlledGlobalDeclaration(name: string): string {
    const fields = [
        ...INTRINSICS.map((intrinsic) => `${intrinsic}: ${intrinsic}`),
        ...OPTIONAL_INTRINSICS.map((intrinsic) => `${intrinsic}: typeof ${intrinsic} !== "undefined" ? ${intrinsic} : undefined`),
        ...SANDBOX_GLOBALS.map((global) => `${global}: ${global}`),
        ...HIDDEN_GLOBALS.map((global) => `${global}: undefined`),
    ];
    return `var ${name} = { ${fields.join(', ')} };\n${name}.self = ${name}; ${name}.globalThis = ${name}; ${name}.window = ${name};`;
}
export function shadowedGlobalsBlock(name: string): string {
    return `{\n  const self = ${name}, window = ${name}, globalThis = ${name}, global = ${name}, document = undefined, navigator = undefined, location = undefined;`;
}
