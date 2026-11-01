export class Exception extends Error {
    readonly InnerException: Exception | null;
    constructor(message = 'Exceção do tipo ' + new.target.name + ' foi lançada.', inner: Exception | null = null) {
        super(message);
        this.name = new.target.name;
        this.InnerException = inner;
    }
    get Message(): string {
        return this.message;
    }
    get StackTrace(): string {
        return this.stack ?? '';
    }
    GetType(): {
        Name: string;
        FullName: string;
        toString(): string;
    } {
        const name = this.name;
        return { Name: name, FullName: `System.${name}`, toString: () => `System.${name}` };
    }
    ToString(): string {
        return `${this.name}: ${this.message}`;
    }
    toString(): string {
        return this.ToString();
    }
}
export class SystemException extends Exception {
}
export class ArgumentException extends SystemException {
    readonly ParamName: string | null;
    constructor(message = 'Valor não permitido.', paramName: string | null = null) {
        super(paramName ? `${message} (Parâmetro '${paramName}')` : message);
        this.ParamName = paramName;
    }
}
export class ArgumentNullException extends ArgumentException {
    constructor(paramName: string | null = null, message = 'O valor não pode ser nulo.') {
        super(message, paramName);
    }
}
export class ArgumentOutOfRangeException extends ArgumentException {
    constructor(paramName: string | null = null, message = 'O valor está fora do intervalo permitido.') {
        super(message, paramName);
    }
}
export class InvalidOperationException extends SystemException {
}
export class InvalidCastException extends SystemException {
}
export class NullReferenceException extends SystemException {
    constructor(message = 'Referência de objeto não definida para uma instância de um objeto.') {
        super(message);
    }
}
export class IndexOutOfRangeException extends SystemException {
    constructor(message = 'O índice estava fora dos limites da matriz.') {
        super(message);
    }
}
export class KeyNotFoundException extends SystemException {
    constructor(message = 'A chave dada não estava presente no dicionário.') {
        super(message);
    }
}
export class DivideByZeroException extends SystemException {
    constructor(message = 'Tentativa de dividir por zero.') {
        super(message);
    }
}
export class FormatException extends SystemException {
    constructor(message = 'A string de entrada não estava num formato correto.') {
        super(message);
    }
}
export class OverflowException extends SystemException {
}
export class NotImplementedException extends SystemException {
    constructor(message = 'O método ou operação não está implementado.') {
        super(message);
    }
}
export class NotSupportedException extends SystemException {
    constructor(message = 'O método ou operação não é suportado.') {
        super(message);
    }
}
export class TimeoutException extends SystemException {
}
export class SwitchExpressionException extends InvalidOperationException {
    constructor(value: unknown) {
        super(`Nenhum braço do switch casou com o valor (${describe(value)}).`);
    }
}
export type ExceptionClass = new (...args: never[]) => Exception;
export const EXCEPTION_TYPES: Readonly<Record<string, ExceptionClass>> = {
    Exception,
    SystemException,
    ArgumentException,
    ArgumentNullException,
    ArgumentOutOfRangeException,
    InvalidOperationException,
    InvalidCastException,
    NullReferenceException,
    IndexOutOfRangeException,
    KeyNotFoundException,
    DivideByZeroException,
    FormatException,
    OverflowException,
    NotImplementedException,
    NotSupportedException,
    TimeoutException,
    SwitchExpressionException,
};
export function wrapThrown(thrown: unknown): Exception {
    if (thrown instanceof Exception)
        return thrown;
    if (thrown instanceof Error) {
        const message = thrown.message;
        const wrapped = /null|undefined/i.test(message) && thrown instanceof TypeError ? new NullReferenceException(message) : new SystemException(message);
        wrapped.stack = thrown.stack;
        return wrapped;
    }
    return new SystemException(describe(thrown));
}
function describe(value: unknown): string {
    if (value === null)
        return 'null';
    if (value === undefined)
        return 'undefined';
    if (typeof value === 'string')
        return JSON.stringify(value);
    if (typeof value === 'object')
        return Object.prototype.toString.call(value);
    return String(value);
}
