// string:hello
// number:42
// diceroll:2d8

// results:
// { type: 'string', value: 'hello' }
// { type: 'string', value: 42 }
// { type: 'diceroll', value: [2, 8]}

const stringParser = letters.map(result => ({
    type: 'string',
    value: result,
}));

const numberParser = digits.map(result => ({
    type: 'number',
    value: Number(result),
}));

const diceRollParser = sequenceOf(digits, str('d'), digits).map(([count, , rank]) => ({
    type: 'diceroll',
    value: [count, rank],
}));

const parser = sequenceOf(letters, str(':'))
    .map(results => results[0])
    .chain(type => {
        if (type === 'string') return stringParser;
        else if (type === 'number') return numberParser;
        return diceRollParser;
    });

console.log(parser.run('dffceroll:1d20'));

// Parse array
const foo = '[1,2,3,4,5]';
const betweenSquareBrackets = between(str('['), str(']'));
const commaSeparated = sepBy(str(','));

// Parse nested array
const exampleString = '[1,[2,[3],4],5]';
const valueParser = lazy(() => choice(digits, arrayParser)); // Recursive parsing, woo
const arrayParser = betweenSquareBrackets(commaSeparated(valueParser));

console.log(valueParser.run(exampleString));
