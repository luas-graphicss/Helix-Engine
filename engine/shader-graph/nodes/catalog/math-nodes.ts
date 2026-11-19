import type { NodeDefinition } from '../node-definition';
import { autoInput, floatInput, output } from '../socket-builders';
const RESULT = [output('value', 'Resultado', 'auto')];
function unary(type: string, label: string, description: string, build: (x: string) => string): NodeDefinition {
    return {
        type,
        label,
        category: 'math',
        description,
        inputs: [autoInput('x', 'X')],
        outputs: RESULT,
        emit: (context) => ({ value: build(context.input('x')) }),
    };
}
function binary(type: string, label: string, description: string, fallbackB: number, build: (a: string, b: string) => string): NodeDefinition {
    return {
        type,
        label,
        category: 'math',
        description,
        inputs: [autoInput('a', 'A'), autoInput('b', 'B', fallbackB)],
        outputs: RESULT,
        emit: (context) => ({ value: build(context.input('a'), context.input('b')) }),
    };
}
export const MATH_NODES: readonly NodeDefinition[] = [
    binary('math-add', 'Somar', 'A + B.', 0, (a, b) => `${a} + ${b}`),
    binary('math-subtract', 'Subtrair', 'A − B.', 0, (a, b) => `${a} - ${b}`),
    binary('math-multiply', 'Multiplicar', 'A × B.', 1, (a, b) => `${a} * ${b}`),
    binary('math-divide', 'Dividir', 'A ÷ B.', 1, (a, b) => `${a} / ${b}`),
    binary('math-power', 'Potência', 'A elevado a B.', 2, (a, b) => `pow(max(${a}, 0.0), ${b})`),
    binary('math-min', 'Mínimo', 'O menor entre A e B.', 0, (a, b) => `min(${a}, ${b})`),
    binary('math-max', 'Máximo', 'O maior entre A e B.', 0, (a, b) => `max(${a}, ${b})`),
    unary('math-abs', 'Absoluto', 'Valor sem sinal.', (x) => `abs(${x})`),
    unary('math-saturate', 'Saturar', 'Limita entre 0 e 1.', (x) => `clamp(${x}, 0.0, 1.0)`),
    unary('math-one-minus', 'Um menos', '1 − X.', (x) => `1.0 - ${x}`),
    unary('math-negate', 'Negar', 'Troca o sinal.', (x) => `-(${x})`),
    unary('math-fract', 'Fração', 'Parte fracionária, repete entre 0 e 1.', (x) => `fract(${x})`),
    unary('math-floor', 'Piso', 'Arredonda para baixo.', (x) => `floor(${x})`),
    unary('math-sine', 'Seno', 'Onda entre −1 e 1.', (x) => `sin(${x})`),
    unary('math-cosine', 'Cosseno', 'Onda entre −1 e 1, defasada do seno.', (x) => `cos(${x})`),
    unary('math-sqrt', 'Raiz', 'Raiz quadrada.', (x) => `sqrt(max(${x}, 0.0))`),
    {
        type: 'math-lerp',
        label: 'Interpolar',
        category: 'math',
        description: 'Mistura A e B pelo fator: 0 devolve A, 1 devolve B.',
        inputs: [autoInput('a', 'A', 0), autoInput('b', 'B', 1), floatInput('t', 'Fator', 0.5)],
        outputs: RESULT,
        emit: (context) => ({ value: `mix(${context.input('a')}, ${context.input('b')}, ${context.input('t')})` }),
    },
    {
        type: 'math-clamp',
        label: 'Limitar',
        category: 'math',
        description: 'Mantém X entre o mínimo e o máximo.',
        inputs: [autoInput('x', 'X'), floatInput('min', 'Mínimo', 0), floatInput('max', 'Máximo', 1)],
        outputs: RESULT,
        emit: (context) => ({ value: `clamp(${context.input('x')}, ${context.input('min')}, ${context.input('max')})` }),
    },
    {
        type: 'math-step',
        label: 'Degrau',
        category: 'math',
        description: '1 quando X alcança o limite, senão 0.',
        inputs: [floatInput('edge', 'Limite', 0.5), autoInput('x', 'X')],
        outputs: RESULT,
        emit: (context) => ({ value: `step(${context.input('edge')}, ${context.input('x')})` }),
    },
    {
        type: 'math-smoothstep',
        label: 'Degrau suave',
        category: 'math',
        description: 'Transição suave de 0 a 1 entre os dois limites.',
        inputs: [floatInput('edge0', 'Início', 0), floatInput('edge1', 'Fim', 1), autoInput('x', 'X')],
        outputs: RESULT,
        emit: (context) => ({ value: `smoothstep(${context.input('edge0')}, ${context.input('edge1')}, ${context.input('x')})` }),
    },
    {
        type: 'math-remap',
        label: 'Remapear',
        category: 'math',
        description: 'Leva X de uma faixa de entrada para uma faixa de saída.',
        inputs: [autoInput('x', 'X'), floatInput('inMin', 'Entrada mín.', 0), floatInput('inMax', 'Entrada máx.', 1), floatInput('outMin', 'Saída mín.', 0), floatInput('outMax', 'Saída máx.', 1)],
        outputs: RESULT,
        emit: (context) => {
            const inMin = context.input('inMin');
            const outMin = context.input('outMin');
            return { value: `${outMin} + (${context.input('x')} - ${inMin}) * (${context.input('outMax')} - ${outMin}) / (${context.input('inMax')} - ${inMin})` };
        },
    },
];
