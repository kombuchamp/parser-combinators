const { digits, str, choice, sequenceOf, between, lazy } = require('./index.js');

/**
 * Language of basic arythmetic expression.
 * Parser combinators can be used to parse AST's of such languages
 *
 * *** Operations ***
 * Add: (+ num1 num2)
 * Sub: (+ num1 num2)
 * Mul: (+ num1 num2)
 * Div: (+ num1 num2)
 *
 * @example
 * (+ (* 10 2) (- 10 2)) // 28
 */

const numberParser = digits.map(x => ({
    type: 'number',
    value: Number(x),
}));

const operatorParser = choice(str('+'), str('-'), str('*'), str('/'));

const betweenBrackets = between(str('('), str(')'));

const expression = lazy(() => choice(numberParser, operationParser));

const operationParser = betweenBrackets(sequenceOf(operatorParser, str(' '), expression, str(' '), expression)).map(
    results => ({
        type: 'operation',
        value: {
            op: results[0],
            a: results[2],
            b: results[4],
        },
    })
);

const evaluate = node => {
    if (node.type === 'number') return node.value;

    if (node.type === 'operation') {
        if (node.value.op === '+') return evaluate(node.value.a) + evaluate(node.value.b);
        if (node.value.op === '-') return evaluate(node.value.a) - evaluate(node.value.b);
        if (node.value.op === '*') return evaluate(node.value.a) * evaluate(node.value.b);
        if (node.value.op === '/') return evaluate(node.value.a) / evaluate(node.value.b);
    }
};

const interpreter = program => {
    const { result: AST, isError, error } = expression.run(program);
    if (isError) throw new Error(error);

    return evaluate(AST);
};

const exp = '(+ (* 10 2) (- 10 2))';
console.log(`${exp} -> ${interpreter(exp)}`);
