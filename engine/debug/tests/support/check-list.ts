const DEFAULT_TOLERANCE = 1e-5;
interface Check {
    name: string;
    ok: boolean;
    detail: string;
}
export interface CheckList {
    check(name: string, ok: boolean, detail?: string): void;
    near(name: string, actual: number, expected: number, tolerance?: number): void;
    nearAll(name: string, actual: ArrayLike<number>, expected: ArrayLike<number>, tolerance?: number): void;
    throws(name: string, action: () => unknown, messagePart?: string): void;
    finish(): void;
}
function describe(item: Check): string {
    return `${item.name}${item.detail ? ` · ${item.detail}` : ''}`;
}
function largestDifference(actual: ArrayLike<number>, expected: ArrayLike<number>): number {
    if (actual.length !== expected.length)
        return Infinity;
    let largest = 0;
    for (let i = 0; i < actual.length; i++) {
        const difference = Math.abs(actual[i] - expected[i]);
        if (!(difference <= largest))
            largest = difference;
    }
    return largest;
}
function thrownMessage(action: () => unknown): string | null {
    try {
        action();
    }
    catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
    return null;
}
export function createCheckList(title: string): CheckList {
    const checks: Check[] = [];
    console.log(title);
    const check = (name: string, ok: boolean, detail = ''): void => {
        const item = { name, ok, detail: ok ? '' : detail };
        checks.push(item);
        console.log(`${ok ? '  ok ' : 'FALHA'} ${describe(item)}`);
    };
    return {
        check,
        near(name, actual, expected, tolerance = DEFAULT_TOLERANCE) {
            check(name, Math.abs(actual - expected) <= tolerance, `obtido ${actual}, esperado ${expected}`);
        },
        nearAll(name, actual, expected, tolerance = DEFAULT_TOLERANCE) {
            check(name, largestDifference(actual, expected) <= tolerance, `obtido [${Array.from(actual).join(', ')}], esperado [${Array.from(expected).join(', ')}]`);
        },
        throws(name, action, messagePart = '') {
            const message = thrownMessage(action);
            if (message === null) {
                check(name, false, 'nenhum erro foi lançado');
                return;
            }
            check(name, message.includes(messagePart), `mensagem "${message}" não contém "${messagePart}"`);
        },
        finish() {
            const failed = checks.filter((item) => !item.ok);
            console.log(`\n${checks.length - failed.length}/${checks.length} verificações passaram.`);
            if (failed.length === 0)
                return;
            for (const item of failed)
                console.log(`  ✗ ${describe(item)}`);
            process.exitCode = 1;
        },
    };
}
